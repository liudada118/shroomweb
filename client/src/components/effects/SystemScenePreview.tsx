import { useEffect, useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";

export type SystemSceneKey = "shroom" | "care" | "chair" | "robot";
export type SystemSceneFraming = "home" | "preview" | "focused";

type SystemScenePreviewProps = {
  activeScene: SystemSceneKey;
  host: HTMLElement | null;
  framing?: SystemSceneFraming;
  onRootReady?: (root: HTMLDivElement | null) => void;
};

type ModelSpec = {
  key: SystemSceneKey;
  label: string;
  url: string;
  loader: "gltf" | "fbx";
  color: string;
  targetSize: number;
  rotation: [number, number, number];
  offset?: [number, number, number];
};

type SampledTarget = {
  key: SystemSceneKey | "loading";
  positions: Float32Array;
  colors: Float32Array;
  sweepWeights: Float32Array;
  center: [number, number, number];
};

type CameraFramingTransitionDetail = {
  framing: SystemSceneFraming;
  from: { x: number; y: number; width: number; height: number };
  to: { x: number; y: number; width: number; height: number };
  duration?: number;
};

type CameraBridge = {
  elapsed: number;
  duration: number;
  startFov: number;
  startViewOffsetX: number;
  startViewOffsetY: number;
};

const CAMERA_FRAMING_EVENT = "system-scene:framing-transition";
const CAMERA_FRAMING_CAPTURE_EVENT = "system-scene:framing-capture";

const SHROOM_MODEL_URL = new URL(
  "../../../../model/shroom.glb",
  import.meta.url
).href;
const BED_MODEL_URL = new URL("../../../../model/bed.glb", import.meta.url)
  .href;
const CHAIR_MODEL_URL = new URL("../../../../model/chair3.glb", import.meta.url)
  .href;
const ROBOT_MODEL_URL = new URL(
  "../../../../model/jiqirenGggg.fbx",
  import.meta.url
).href;

const PARTICLE_COUNT = 3600;
const AMBIENT_PARTICLE_COUNT = 720;
const SWEEP_EDGE_WIDTH = 0.42;

const MODEL_SPECS: ModelSpec[] = [
  {
    key: "shroom",
    label: "SHROOM",
    url: SHROOM_MODEL_URL,
    loader: "gltf",
    color: "#7dd3fc",
    targetSize: 4.45,
    rotation: [-0.08, 0.2, 0],
  },
  {
    key: "care",
    label: "BED",
    url: BED_MODEL_URL,
    loader: "gltf",
    color: "#8bd8ff",
    targetSize: 4.7,
    rotation: [0.36, -0.64, 0.04],
  },
  {
    key: "chair",
    label: "CHAIR",
    url: CHAIR_MODEL_URL,
    loader: "gltf",
    color: "#d9f2ff",
    targetSize: 4.1,
    rotation: [-0.08, 0.42, 0],
  },
  {
    key: "robot",
    label: "ROBOT",
    url: ROBOT_MODEL_URL,
    loader: "fbx",
    color: "#83d3ff",
    targetSize: 3.95,
    rotation: [-0.1, -0.2, 0],
    offset: [-0.72, 0.08, 0],
  },
];

function smoothstep(start: number, end: number, value: number) {
  const t = THREE.MathUtils.clamp((value - start) / (end - start), 0, 1);
  return t * t * (3 - 2 * t);
}

function allocateCounts(weights: number[], total: number) {
  const sum = weights.reduce((acc, value) => acc + value, 0) || 1;
  const counts = weights.map(weight => Math.floor((weight / sum) * total));
  let remainder = total - counts.reduce((acc, value) => acc + value, 0);
  let index = 0;

  while (remainder > 0) {
    counts[index % counts.length] += 1;
    remainder -= 1;
    index += 1;
  }

  return counts;
}

function createParticleTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Unable to create preview particle texture");
  }

  const gradient = context.createRadialGradient(64, 64, 5, 64, 64, 64);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.28, "rgba(255,255,255,0.9)");
  gradient.addColorStop(0.62, "rgba(255,255,255,0.28)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");

  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function createAmbientDustPositions() {
  const positions = new Float32Array(AMBIENT_PARTICLE_COUNT * 3);
  const random = (index: number, salt: number) => {
    const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
    return value - Math.floor(value);
  };

  for (let index = 0; index < AMBIENT_PARTICLE_COUNT; index += 1) {
    const stride = index * 3;
    positions[stride] = (random(index, 1) - 0.5) * 15;
    positions[stride + 1] = (random(index, 2) - 0.5) * 8.5;
    positions[stride + 2] = -0.8 - random(index, 3) * 5.4;
  }

  return positions;
}

function normalizeModel(root: THREE.Object3D, spec: ModelSpec) {
  const wrapper = new THREE.Group();
  wrapper.add(root);
  wrapper.rotation.set(spec.rotation[0], spec.rotation[1], spec.rotation[2]);

  wrapper.updateMatrixWorld(true);
  const initialBox = new THREE.Box3().setFromObject(wrapper);
  const initialSize = new THREE.Vector3();
  initialBox.getSize(initialSize);
  const maxDimension =
    Math.max(initialSize.x, initialSize.y, initialSize.z) || 1;

  wrapper.scale.setScalar(spec.targetSize / maxDimension);
  wrapper.updateMatrixWorld(true);

  const scaledBox = new THREE.Box3().setFromObject(wrapper);
  const center = new THREE.Vector3();
  scaledBox.getCenter(center);
  wrapper.position.sub(center);
  if (spec.offset) {
    wrapper.position.add(new THREE.Vector3(...spec.offset));
  }
  wrapper.updateMatrixWorld(true);

  return wrapper;
}

function extractMeshes(root: THREE.Object3D) {
  const meshes: THREE.Mesh[] = [];

  root.traverse(child => {
    const candidate = child as THREE.Mesh;
    const geometry = candidate.geometry as THREE.BufferGeometry | undefined;

    if (!candidate.isMesh || !geometry?.attributes?.position) {
      return;
    }

    meshes.push(candidate);
  });

  return meshes;
}

function createSweepWeights(positions: Float32Array) {
  const weights = new Float32Array(positions.length / 3);
  let minX = Infinity;
  let maxX = -Infinity;

  for (let index = 0; index < positions.length; index += 3) {
    minX = Math.min(minX, positions[index]);
    maxX = Math.max(maxX, positions[index]);
  }

  const spanX = Math.max(maxX - minX, 0.001);

  for (let index = 0; index < weights.length; index += 1) {
    const stride = index * 3;
    const x = positions[stride];
    const y = positions[stride + 1];
    const z = positions[stride + 2];
    weights[index] = THREE.MathUtils.clamp(
      (x - minX) / spanX + Math.sin(y * 1.1 + z * 1.4) * 0.055,
      0,
      1
    );
  }

  return weights;
}

function getTargetCenter(positions: Float32Array): [number, number, number] {
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  for (let index = 0; index < positions.length; index += 3) {
    minX = Math.min(minX, positions[index]);
    minY = Math.min(minY, positions[index + 1]);
    minZ = Math.min(minZ, positions[index + 2]);
    maxX = Math.max(maxX, positions[index]);
    maxY = Math.max(maxY, positions[index + 1]);
    maxZ = Math.max(maxZ, positions[index + 2]);
  }

  return [(minX + maxX) * 0.5, (minY + maxY) * 0.5, (minZ + maxZ) * 0.5];
}

function sampleTarget(root: THREE.Object3D, spec: ModelSpec): SampledTarget {
  const normalizedRoot = normalizeModel(root, spec);
  const meshes = extractMeshes(normalizedRoot);

  if (meshes.length === 0) {
    throw new Error(`No mesh geometry found in ${spec.label}`);
  }

  const counts = allocateCounts(
    meshes.map(
      mesh =>
        (mesh.geometry as THREE.BufferGeometry).getAttribute("position").count
    ),
    PARTICLE_COUNT
  );
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const colors = new Float32Array(PARTICLE_COUNT * 3);
  const point = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const baseColor = new THREE.Color(spec.color);
  const highlight = baseColor.clone().offsetHSL(0.04, 0.1, 0.16);
  let cursor = 0;

  normalizedRoot.updateMatrixWorld(true);
  meshes.forEach((mesh, meshIndex) => {
    mesh.updateWorldMatrix(true, false);
    const sampler = new MeshSurfaceSampler(mesh).build();

    for (let index = 0; index < counts[meshIndex]; index += 1) {
      sampler.sample(point, normal);
      mesh.localToWorld(point);
      normal.transformDirection(mesh.matrixWorld).normalize();
      point.addScaledVector(normal, (Math.random() - 0.5) * 0.018);

      const stride = cursor * 3;
      positions[stride] = point.x;
      positions[stride + 1] = point.y;
      positions[stride + 2] = point.z;

      const color = baseColor.clone().lerp(highlight, Math.random() * 0.55);
      colors[stride] = color.r;
      colors[stride + 1] = color.g;
      colors[stride + 2] = color.b;
      cursor += 1;
    }
  });

  return {
    key: spec.key,
    positions,
    colors,
    sweepWeights: createSweepWeights(positions),
    center: getTargetCenter(positions),
  };
}

function loadModel(
  spec: ModelSpec,
  gltfLoader: GLTFLoader,
  fbxLoader: FBXLoader
) {
  return new Promise<THREE.Object3D>((resolve, reject) => {
    if (spec.loader === "gltf") {
      gltfLoader.load(
        spec.url,
        result => resolve(result.scene),
        undefined,
        reject
      );
      return;
    }

    fbxLoader.load(spec.url, resolve, undefined, reject);
  });
}

function createLoadingTarget() {
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const colors = new Float32Array(PARTICLE_COUNT * 3);
  const sweepWeights = new Float32Array(PARTICLE_COUNT);
  const colorA = new THREE.Color("#0ea5e9");
  const colorB = new THREE.Color("#e0f2fe");

  for (let index = 0; index < PARTICLE_COUNT; index += 1) {
    const stride = index * 3;
    const angle = index * 0.08;
    const radius = 0.5 + (index / PARTICLE_COUNT) * 2.8;
    positions[stride] = Math.cos(angle) * radius * 0.52;
    positions[stride + 1] = Math.sin(index * 0.033) * 0.9;
    positions[stride + 2] = Math.sin(angle) * radius * 0.35;
    sweepWeights[index] = index / PARTICLE_COUNT;

    const color = colorA.clone().lerp(colorB, Math.random() * 0.8);
    colors[stride] = color.r;
    colors[stride + 1] = color.g;
    colors[stride + 2] = color.b;
  }

  return {
    key: "loading" as const,
    positions,
    colors,
    sweepWeights,
    center: getTargetCenter(positions),
  };
}

export default function SystemScenePreview({
  activeScene,
  host,
  framing = "home",
  onRootReady,
}: SystemScenePreviewProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const onRootReadyRef = useRef(onRootReady);
  const activeSceneRef = useRef<SystemSceneKey>(activeScene);
  const framingRef = useRef<SystemSceneFraming>(framing);

  if (rootRef.current === null && typeof document !== "undefined") {
    const root = document.createElement("div");
    root.className = "system-scene-particle-root";
    root.setAttribute("aria-hidden", "true");
    rootRef.current = root;
  }

  useEffect(() => {
    onRootReadyRef.current = onRootReady;
  }, [onRootReady]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || !host) return;

    host.appendChild(root);

    return () => {
      if (root.parentElement === host) root.remove();
    };
  }, [host]);

  useEffect(() => {
    activeSceneRef.current = activeScene;
  }, [activeScene]);

  useEffect(() => {
    framingRef.current = framing;
  }, [framing]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    onRootReadyRef.current?.(root);

    const scene = new THREE.Scene();
    scene.background = null;
    scene.fog = new THREE.Fog(0x050912, 6, 22);

    const camera = new THREE.PerspectiveCamera(
      34,
      root.clientWidth / Math.max(root.clientHeight, 1),
      0.1,
      70
    );
    camera.position.set(0, 0.25, 8.15);
    const cameraLookAt = new THREE.Vector3(0, 0.25, 0);
    const cameraDesiredPosition = new THREE.Vector3();
    const cameraDesiredLookAt = new THREE.Vector3();
    const morphCenter = new THREE.Vector3();
    camera.lookAt(cameraLookAt);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
    renderer.setSize(root.clientWidth, root.clientHeight);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    root.appendChild(renderer.domElement);

    const reduceMotionQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    );
    let reduceMotion = reduceMotionQuery.matches;
    const handleMotionPreference = (event: MediaQueryListEvent) => {
      reduceMotion = event.matches;
    };
    reduceMotionQuery.addEventListener("change", handleMotionPreference);

    const texture = createParticleTexture();
    const ambientDustGeometry = new THREE.BufferGeometry();
    ambientDustGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(createAmbientDustPositions(), 3)
    );
    const ambientDustMaterial = new THREE.PointsMaterial({
      size: 0.052,
      map: texture,
      color: "#72c7ff",
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      sizeAttenuation: true,
    });
    const ambientDust = new THREE.Points(
      ambientDustGeometry,
      ambientDustMaterial
    );
    ambientDust.frustumCulled = false;
    scene.add(ambientDust);

    const timer = new THREE.Timer();
    timer.connect(document);
    const gltfLoader = new GLTFLoader();
    const fbxLoader = new FBXLoader();
    const loadingTarget = createLoadingTarget();
    const targetMap = new Map<SystemSceneKey, SampledTarget>();
    const pendingTargets = new Map<SystemSceneKey, Promise<void>>();
    const failedTargets = new Set<SystemSceneKey>();
    const livePositions = new Float32Array(loadingTarget.positions);
    const renderPositions = new Float32Array(loadingTarget.positions);
    const liveColors = new Float32Array(loadingTarget.colors);
    const noiseSeeds = Float32Array.from(
      Array.from({ length: PARTICLE_COUNT }, () => Math.random() * Math.PI * 2)
    );
    const revealJitter = Float32Array.from(
      Array.from({ length: PARTICLE_COUNT }, () => Math.random() * 0.12)
    );

    let currentTarget: SampledTarget = loadingTarget;
    let fromTarget: SampledTarget = loadingTarget;
    let toTarget: SampledTarget = loadingTarget;
    let transitionProgress = 1;
    let sweepDirection: 1 | -1 = 1;
    let shroomIntroduced = false;
    let shroomHoldUntil = 0;
    let cameraBridge: CameraBridge | null = null;
    let cameraCapture: {
      screenX: number;
      screenY: number;
      height: number;
      fov: number;
      worldCenter: [number, number, number];
    } | null = null;
    let animationFrame = 0;
    let disposed = false;

    const handleCameraFramingTransition = (event: Event) => {
      const { detail } = event as CustomEvent<CameraFramingTransitionDetail>;
      if (!detail) return;

      framingRef.current = detail.framing;
      if (reduceMotion) {
        cameraBridge = null;
        camera.clearViewOffset();
        return;
      }

      const capture = cameraCapture;
      const fromHeight = Math.max(capture?.height ?? detail.from.height, 1);
      const toWidth = Math.max(detail.to.width, 1);
      const toHeight = Math.max(detail.to.height, 1);
      const currentFov = THREE.MathUtils.degToRad(capture?.fov ?? camera.fov);
      const compensatedFov = THREE.MathUtils.radToDeg(
        2 * Math.atan((toHeight / fromHeight) * Math.tan(currentFov * 0.5))
      );
      const startFov = THREE.MathUtils.clamp(compensatedFov, 16, 58);
      const worldCenter = new THREE.Vector3(
        ...(capture?.worldCenter ?? [
          morphCenter.x,
          morphCenter.y,
          morphCenter.z,
        ])
      );

      camera.clearViewOffset();
      camera.aspect = toWidth / toHeight;
      camera.fov = startFov;
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld(true);

      const projectedCenter = worldCenter.clone().project(camera);
      const projectedScreenX =
        detail.to.x + (projectedCenter.x + 1) * 0.5 * toWidth;
      const projectedScreenY =
        detail.to.y + (1 - projectedCenter.y) * 0.5 * toHeight;
      const capturedScreenX =
        capture?.screenX ?? detail.from.x + detail.from.width * 0.5;
      const capturedScreenY =
        capture?.screenY ?? detail.from.y + detail.from.height * 0.5;

      cameraBridge = {
        elapsed: 0,
        duration: detail.duration ?? 1.08,
        startFov,
        startViewOffsetX: projectedScreenX - capturedScreenX,
        startViewOffsetY: projectedScreenY - capturedScreenY,
      };
      cameraCapture = null;

      camera.fov = cameraBridge.startFov;
      camera.setViewOffset(
        toWidth,
        toHeight,
        cameraBridge.startViewOffsetX,
        cameraBridge.startViewOffsetY,
        toWidth,
        toHeight
      );
    };

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(renderPositions, 3)
    );
    geometry.setAttribute("color", new THREE.BufferAttribute(liveColors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.078,
      map: texture,
      transparent: true,
      opacity: 0.94,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    const handleCameraFramingCapture = () => {
      const rect = root.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      points.updateMatrixWorld(true);
      camera.updateMatrixWorld(true);
      const worldCenter = new THREE.Vector3(
        morphCenter.x,
        morphCenter.y,
        morphCenter.z
      );
      points.localToWorld(worldCenter);
      const projectedCenter = worldCenter.clone().project(camera);

      cameraCapture = {
        screenX: rect.x + (projectedCenter.x + 1) * 0.5 * rect.width,
        screenY: rect.y + (1 - projectedCenter.y) * 0.5 * rect.height,
        height: rect.height,
        fov: camera.fov,
        worldCenter: [worldCenter.x, worldCenter.y, worldCenter.z],
      };
    };

    root.addEventListener(
      CAMERA_FRAMING_CAPTURE_EVENT,
      handleCameraFramingCapture
    );
    root.addEventListener(CAMERA_FRAMING_EVENT, handleCameraFramingTransition);

    const haloGeometry = new THREE.RingGeometry(1.72, 1.75, 160);
    const haloMaterial = new THREE.MeshBasicMaterial({
      color: "#1d9fff",
      transparent: true,
      opacity: 0.18,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const halo = new THREE.Mesh(haloGeometry, haloMaterial);
    halo.rotation.x = Math.PI / 2;
    halo.position.y = -1.12;
    scene.add(halo);

    const ambient = new THREE.AmbientLight(0xffffff, 0.24);
    scene.add(ambient);
    const keyLight = new THREE.PointLight(0x7dd3fc, 4.2, 16, 2);
    keyLight.position.set(-2.6, 2.4, 4.8);
    scene.add(keyLight);
    const accentLight = new THREE.PointLight(0x38bdf8, 2.6, 14, 2);
    accentLight.position.set(2.4, -0.8, 3.4);
    scene.add(accentLight);

    const beginTransition = (target: SampledTarget) => {
      if (target === toTarget && transitionProgress < 1) return;
      if (target === currentTarget && transitionProgress >= 1) return;

      fromTarget = currentTarget;
      toTarget = target;
      transitionProgress = 0;
      sweepDirection = sweepDirection === 1 ? -1 : 1;
    };

    const onResize = () => {
      const width = Math.max(root.clientWidth, 1);
      const height = Math.max(root.clientHeight, 1);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(root);
    window.addEventListener("resize", onResize);

    const ensureTarget = (key: SystemSceneKey) => {
      if (
        targetMap.has(key) ||
        pendingTargets.has(key) ||
        failedTargets.has(key)
      ) {
        return;
      }

      const spec = MODEL_SPECS.find(candidate => candidate.key === key);
      if (!spec) return;

      const request = loadModel(spec, gltfLoader, fbxLoader)
        .then(rootObject => {
          if (disposed) return;
          targetMap.set(spec.key, sampleTarget(rootObject, spec));
        })
        .catch(error => {
          failedTargets.add(spec.key);
          console.error(`Failed to load preview model ${spec.label}`, error);
        })
        .finally(() => {
          pendingTargets.delete(spec.key);
        });

      pendingTargets.set(spec.key, request);
    };

    ensureTarget("shroom");

    const animate = (timestamp: number) => {
      animationFrame = requestAnimationFrame(animate);

      timer.update(timestamp);
      const delta = Math.min(timer.getDelta(), 0.05);
      const elapsed = timer.getElapsed();
      ensureTarget(activeSceneRef.current);
      const shroomTarget = targetMap.get("shroom");
      const requestedTarget = shroomIntroduced
        ? targetMap.get(activeSceneRef.current)
        : shroomTarget;

      if (requestedTarget && requestedTarget !== toTarget) {
        beginTransition(requestedTarget);
      }

      if (transitionProgress < 1) {
        transitionProgress = reduceMotion
          ? 1
          : Math.min(1, transitionProgress + delta / 1.35);
        if (transitionProgress >= 1) {
          currentTarget = toTarget;
          if (currentTarget.key === "shroom" && shroomHoldUntil === 0) {
            shroomHoldUntil = reduceMotion ? elapsed : elapsed + 0.72;
          }
        }
      }

      if (
        !shroomIntroduced &&
        shroomHoldUntil > 0 &&
        elapsed >= shroomHoldUntil
      ) {
        shroomIntroduced = true;
      }

      const easedProgress = smoothstep(0, 1, transitionProgress);
      const followStrength = reduceMotion
        ? 1
        : transitionProgress < 1
          ? 0.088
          : 0.055;

      for (let index = 0; index < livePositions.length; index += 3) {
        const pointIndex = index / 3;
        const revealWeight = toTarget.sweepWeights[pointIndex];
        const directionalWeight =
          sweepDirection === 1 ? revealWeight : 1 - revealWeight;
        const localProgress =
          transitionProgress >= 1
            ? 1
            : smoothstep(
                directionalWeight - SWEEP_EDGE_WIDTH + revealJitter[pointIndex],
                directionalWeight + SWEEP_EDGE_WIDTH + revealJitter[pointIndex],
                easedProgress
              );

        const targetX = THREE.MathUtils.lerp(
          fromTarget.positions[index],
          toTarget.positions[index],
          localProgress
        );
        const targetY = THREE.MathUtils.lerp(
          fromTarget.positions[index + 1],
          toTarget.positions[index + 1],
          localProgress
        );
        const targetZ = THREE.MathUtils.lerp(
          fromTarget.positions[index + 2],
          toTarget.positions[index + 2],
          localProgress
        );

        livePositions[index] = THREE.MathUtils.lerp(
          livePositions[index],
          targetX,
          followStrength
        );
        livePositions[index + 1] = THREE.MathUtils.lerp(
          livePositions[index + 1],
          targetY,
          followStrength
        );
        livePositions[index + 2] = THREE.MathUtils.lerp(
          livePositions[index + 2],
          targetZ,
          followStrength
        );

        renderPositions[index] =
          livePositions[index] +
          (reduceMotion
            ? 0
            : Math.sin(elapsed * 1.25 + noiseSeeds[pointIndex]) * 0.012);
        renderPositions[index + 1] =
          livePositions[index + 1] +
          (reduceMotion
            ? 0
            : Math.cos(elapsed * 1.55 + noiseSeeds[pointIndex]) * 0.01);
        renderPositions[index + 2] =
          livePositions[index + 2] +
          (reduceMotion
            ? 0
            : Math.sin(elapsed * 1.05 + noiseSeeds[pointIndex]) * 0.012);

        liveColors[index] = THREE.MathUtils.lerp(
          liveColors[index],
          toTarget.colors[index],
          0.08
        );
        liveColors[index + 1] = THREE.MathUtils.lerp(
          liveColors[index + 1],
          toTarget.colors[index + 1],
          0.08
        );
        liveColors[index + 2] = THREE.MathUtils.lerp(
          liveColors[index + 2],
          toTarget.colors[index + 2],
          0.08
        );
      }

      points.rotation.y = reduceMotion
        ? 0
        : Math.sin(elapsed * 0.22) * 0.06 +
          (activeSceneRef.current === "robot" ? -0.08 : 0.08);
      points.rotation.x = reduceMotion
        ? -0.08
        : -0.08 + Math.cos(elapsed * 0.18) * 0.025;

      morphCenter.set(
        THREE.MathUtils.lerp(
          fromTarget.center[0],
          toTarget.center[0],
          easedProgress
        ),
        THREE.MathUtils.lerp(
          fromTarget.center[1],
          toTarget.center[1],
          easedProgress
        ),
        THREE.MathUtils.lerp(
          fromTarget.center[2],
          toTarget.center[2],
          easedProgress
        )
      );

      const framingMode = framingRef.current;
      const homeFraming = framingMode === "home";
      const previewFraming = framingMode === "preview";
      const focusedFraming = framingMode === "focused";
      const cameraEase = reduceMotion ? 1 : 1 - Math.exp(-delta * 3.2);
      const targetFov = focusedFraming ? 32.5 : homeFraming ? 31 : 34;
      cameraDesiredPosition.set(
        morphCenter.x + (previewFraming ? 0.28 : homeFraming ? 0.1 : 0),
        morphCenter.y + (focusedFraming ? 0.14 : previewFraming ? 0.28 : 0.18),
        morphCenter.z + (focusedFraming ? 7.92 : homeFraming ? 7.95 : 8.15)
      );
      cameraDesiredLookAt.set(
        morphCenter.x + (previewFraming ? 0.5 : homeFraming ? -0.76 : 0),
        morphCenter.y + (homeFraming ? 0.14 : 0),
        morphCenter.z
      );
      camera.position.lerp(cameraDesiredPosition, cameraEase);
      cameraLookAt.lerp(cameraDesiredLookAt, cameraEase);

      const ambientOpacity = homeFraming ? 0.22 : focusedFraming ? 0.08 : 0.12;
      ambientDustMaterial.opacity = THREE.MathUtils.lerp(
        ambientDustMaterial.opacity,
        ambientOpacity,
        reduceMotion ? 1 : 1 - Math.exp(-delta * 1.8)
      );
      if (!reduceMotion) {
        ambientDust.rotation.z = Math.sin(elapsed * 0.045) * 0.012;
        ambientDust.position.x = Math.sin(elapsed * 0.08) * 0.14;
        ambientDust.position.y = Math.cos(elapsed * 0.065) * 0.08;
      }

      if (cameraBridge) {
        cameraBridge.elapsed = Math.min(
          cameraBridge.duration,
          cameraBridge.elapsed + delta
        );
        const bridgeProgress = smoothstep(
          0,
          1,
          cameraBridge.elapsed / Math.max(cameraBridge.duration, 0.001)
        );
        camera.fov = THREE.MathUtils.lerp(
          cameraBridge.startFov,
          targetFov,
          bridgeProgress
        );

        const viewportWidth = Math.max(root.clientWidth, 1);
        const viewportHeight = Math.max(root.clientHeight, 1);
        const viewOffsetX = THREE.MathUtils.lerp(
          cameraBridge.startViewOffsetX,
          0,
          bridgeProgress
        );
        const viewOffsetY = THREE.MathUtils.lerp(
          cameraBridge.startViewOffsetY,
          0,
          bridgeProgress
        );

        if (bridgeProgress < 1) {
          camera.setViewOffset(
            viewportWidth,
            viewportHeight,
            viewOffsetX,
            viewOffsetY,
            viewportWidth,
            viewportHeight
          );
        } else {
          cameraBridge = null;
          camera.clearViewOffset();
        }
      } else {
        camera.fov = THREE.MathUtils.lerp(camera.fov, targetFov, cameraEase);
        if (camera.view?.enabled) camera.clearViewOffset();
      }

      camera.updateProjectionMatrix();
      camera.lookAt(cameraLookAt);

      halo.position.x = morphCenter.x;
      if (!reduceMotion) halo.rotation.z += delta * 0.18;
      haloMaterial.opacity = reduceMotion
        ? 0.12
        : 0.12 + Math.sin(elapsed * 1.8) * 0.025;
      material.size = reduceMotion
        ? 0.07
        : 0.07 + Math.sin(elapsed * 2.1) * 0.004;

      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.color.needsUpdate = true;
      renderer.render(scene, camera);
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      disposed = true;
      onRootReadyRef.current?.(null);
      resizeObserver.disconnect();
      window.removeEventListener("resize", onResize);
      root.removeEventListener(
        CAMERA_FRAMING_EVENT,
        handleCameraFramingTransition
      );
      root.removeEventListener(
        CAMERA_FRAMING_CAPTURE_EVENT,
        handleCameraFramingCapture
      );
      reduceMotionQuery.removeEventListener("change", handleMotionPreference);
      cancelAnimationFrame(animationFrame);
      timer.dispose();
      geometry.dispose();
      material.dispose();
      ambientDustGeometry.dispose();
      ambientDustMaterial.dispose();
      texture.dispose();
      haloGeometry.dispose();
      haloMaterial.dispose();
      renderer.dispose();
      if (root.contains(renderer.domElement)) {
        root.removeChild(renderer.domElement);
      }
    };
  }, []);

  return null;
}
