import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js';

const MUSHROOM_MODEL_URL = new URL('../../../../model/shroom.glb', import.meta.url).href;
const BED_MODEL_URL = new URL('../../../../model/bed.glb', import.meta.url).href;
const CHAIR_MODEL_URL = new URL('../../../../model/chair3.glb', import.meta.url).href;
const ROBOT_MODEL_URL = new URL('../../../../model/jiqirenGggg.fbx', import.meta.url).href;
const FOOT_MODEL_URL = new URL('../../../../model/foot-optimized.glb', import.meta.url).href;

const PARTICLE_COUNT = 7200;
const SWEEP_EDGE_WIDTH = 0.34;
const MODEL_SIDE_OFFSET_X = 2.8;
const PARTICLE_FOLLOW_STRENGTH = 0.046;
const MORPH_TRANSITION_DURATION_MS = 2400;
const MORPH_HOLD_DURATION_MS = 650;
const POINT_REVEAL_JITTER = 0.18;

type ModelSpec = {
  label: string;
  title: string;
  badgePrefix: string;
  badgeTitle: string;
  url: string;
  loader: 'gltf' | 'fbx';
  color: string;
  targetSize: number;
};

type MorphTarget = {
  label: string;
  title: string;
  positions: Float32Array;
  colors: Float32Array;
  sweepWeights: Float32Array;
};

type ModelControlState = {
  rotationXDeg: number;
  rotationYDeg: number;
  rotationZDeg: number;
  offsetX: number;
  offsetY: number;
  offsetZ: number;
};

const DEFAULT_BED_ROTATION_X_DEG = 47;
const DEFAULT_BED_ROTATION_Y_DEG = -119;
const DEFAULT_BED_ROTATION_Z_DEG = 0;
const DEFAULT_BED_OFFSET_X = 3.76;
const DEFAULT_BED_OFFSET_Y = 2.06;
const DEFAULT_BED_OFFSET_Z = -0.8;

const DEFAULT_FOOT_ROTATION_X_DEG = 98;
const DEFAULT_FOOT_ROTATION_Y_DEG = 70;
const DEFAULT_FOOT_ROTATION_Z_DEG = -1;
const DEFAULT_FOOT_OFFSET_X = -2.56;
const DEFAULT_FOOT_OFFSET_Y = 2.57;
const DEFAULT_FOOT_OFFSET_Z = -0.05;

const MODEL_SPECS: ModelSpec[] = [
  {
    label: 'MUSHROOM',
    title: '蘑菇',
    badgePrefix: 'SHROOM',
    badgeTitle: 'SHROOM',
    url: MUSHROOM_MODEL_URL,
    loader: 'gltf',
    color: '#7dd3fc',
    targetSize: 4.2,
  },
  {
    label: 'BED',
    title: '床',
    badgePrefix: '关怀',
    badgeTitle: '床',
    url: BED_MODEL_URL,
    loader: 'gltf',
    color: '#38bdf8',
    targetSize: 4.8,
  },
  {
    label: 'CHAIR',
    title: '座椅',
    badgePrefix: '定制',
    badgeTitle: '座椅',
    url: CHAIR_MODEL_URL,
    loader: 'gltf',
    color: '#f8fafc',
    targetSize: 3.6,
  },
  {
    label: 'ROBOT',
    title: '机器人',
    badgePrefix: '精密',
    badgeTitle: '机器人',
    url: ROBOT_MODEL_URL,
    loader: 'fbx',
    color: '#f59e0b',
    targetSize: 4.4,
  },
  {
    label: 'FOOT',
    title: 'Foot',
    badgePrefix: 'LAB',
    badgeTitle: '足底',
    url: FOOT_MODEL_URL,
    loader: 'gltf',
    color: '#fb7185',
    targetSize: 4.2,
  },
];

function smoothstep(start: number, end: number, value: number) {
  const t = THREE.MathUtils.clamp((value - start) / (end - start), 0, 1);
  return t * t * (3 - 2 * t);
}

function allocateCounts(weights: number[], total: number) {
  const sum = weights.reduce((acc, value) => acc + value, 0) || 1;
  const counts = weights.map((weight) => Math.floor((weight / sum) * total));
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
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Unable to create particle texture');
  }

  const gradient = context.createRadialGradient(64, 64, 4, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.2, 'rgba(255,255,255,0.96)');
  gradient.addColorStop(0.55, 'rgba(255,255,255,0.35)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');

  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function createBackgroundPoints(
  texture: THREE.Texture,
  count: number,
  radius: number,
  colorA: string,
  colorB: string,
  size: number,
) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const start = new THREE.Color(colorA);
  const end = new THREE.Color(colorB);

  for (let index = 0; index < count; index += 1) {
    const stride = index * 3;
    positions[stride] = (Math.random() - 0.5) * radius * 2;
    positions[stride + 1] = (Math.random() - 0.5) * radius * 1.5;
    positions[stride + 2] = (Math.random() - 0.5) * radius * 2;

    const color = start.clone().lerp(end, Math.random());
    colors[stride] = color.r;
    colors[stride + 1] = color.g;
    colors[stride + 2] = color.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size,
    map: texture,
    transparent: true,
    opacity: 0.55,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });

  return new THREE.Points(geometry, material);
}

function normalizeModel(root: THREE.Object3D, targetSize: number) {
  const wrapper = new THREE.Group();
  wrapper.add(root);

  wrapper.updateMatrixWorld(true);
  const initialBox = new THREE.Box3().setFromObject(wrapper);
  const initialSize = new THREE.Vector3();
  initialBox.getSize(initialSize);

  const maxDimension = Math.max(initialSize.x, initialSize.y, initialSize.z) || 1;
  const scale = targetSize / maxDimension;
  wrapper.scale.setScalar(scale);

  wrapper.updateMatrixWorld(true);
  const scaledBox = new THREE.Box3().setFromObject(wrapper);
  const center = new THREE.Vector3();
  scaledBox.getCenter(center);
  wrapper.position.sub(center);

  wrapper.updateMatrixWorld(true);
  return wrapper;
}

function extractRenderableMeshes(root: THREE.Object3D) {
  const meshes: THREE.Mesh[] = [];

  root.traverse((child) => {
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
  const count = positions.length / 3;
  const weights = new Float32Array(count);
  let minX = Infinity;
  let maxX = -Infinity;

  for (let index = 0; index < positions.length; index += 3) {
    const x = positions[index];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
  }

  const spanX = Math.max(maxX - minX, 0.001);

  for (let index = 0; index < count; index += 1) {
    const stride = index * 3;
    const x = positions[stride];
    const z = positions[stride + 2];
    const baseWeight = (x - minX) / spanX;
    const ribbonOffset = Math.sin(z * 1.25) * 0.06;
    weights[index] = THREE.MathUtils.clamp(baseWeight + ribbonOffset, 0, 1);
  }

  return weights;
}

function getModelOffsetX(index: number) {
  return index % 2 === 0 ? -MODEL_SIDE_OFFSET_X : MODEL_SIDE_OFFSET_X;
}

function sampleMorphTarget(root: THREE.Object3D, spec: ModelSpec): MorphTarget {
  const normalizedRoot = normalizeModel(root, spec.targetSize);
  const meshes = extractRenderableMeshes(normalizedRoot);

  if (meshes.length === 0) {
    throw new Error(`No mesh geometry found in ${spec.label}`);
  }

  const weights = meshes.map((mesh) => {
    const geometry = mesh.geometry as THREE.BufferGeometry;
    return geometry.getAttribute('position').count;
  });
  const counts = allocateCounts(weights, PARTICLE_COUNT);

  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const colors = new Float32Array(PARTICLE_COUNT * 3);
  const point = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const baseColor = new THREE.Color(spec.color);
  const glowColor = baseColor.clone().offsetHSL(0.04, 0.08, 0.12);
  let cursor = 0;

  normalizedRoot.updateMatrixWorld(true);

  meshes.forEach((mesh, meshIndex) => {
    mesh.updateWorldMatrix(true, false);
    const sampler = new MeshSurfaceSampler(mesh).build();

    for (let index = 0; index < counts[meshIndex]; index += 1) {
      sampler.sample(point, normal);
      mesh.localToWorld(point);
      normal.transformDirection(mesh.matrixWorld).normalize();
      point.addScaledVector(normal, (Math.random() - 0.5) * 0.025);

      const stride = cursor * 3;
      positions[stride] = point.x;
      positions[stride + 1] = point.y;
      positions[stride + 2] = point.z;

      const color = baseColor.clone().lerp(glowColor, Math.random() * 0.45);
      colors[stride] = color.r;
      colors[stride + 1] = color.g;
      colors[stride + 2] = color.b;

      cursor += 1;
    }
  });

  return {
    label: spec.label,
    title: spec.title,
    positions,
    colors,
    sweepWeights: createSweepWeights(positions),
  };
}

function loadModel(spec: ModelSpec, gltfLoader: GLTFLoader, fbxLoader: FBXLoader) {
  return new Promise<THREE.Object3D>((resolve, reject) => {
    if (spec.loader === 'gltf') {
      gltfLoader.load(
        spec.url,
        (result) => resolve(result.scene),
        undefined,
        reject,
      );
      return;
    }

    fbxLoader.load(spec.url, resolve, undefined, reject);
  });
}

export default function ParticleMorphSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [activeLabel, setActiveLabel] = useState('MUSHROOM');
  const [loadingText, setLoadingText] = useState('Preparing particle morph: mushroom, bed, chair, robot, foot...');
  const [loadError, setLoadError] = useState<string | null>(null);
  const bedControlRef = useRef<ModelControlState>({
    rotationXDeg: DEFAULT_BED_ROTATION_X_DEG,
    rotationYDeg: DEFAULT_BED_ROTATION_Y_DEG,
    rotationZDeg: DEFAULT_BED_ROTATION_Z_DEG,
    offsetX: DEFAULT_BED_OFFSET_X,
    offsetY: DEFAULT_BED_OFFSET_Y,
    offsetZ: DEFAULT_BED_OFFSET_Z,
  });
  const footRotationRef = useRef<ModelControlState>({
    rotationXDeg: DEFAULT_FOOT_ROTATION_X_DEG,
    rotationYDeg: DEFAULT_FOOT_ROTATION_Y_DEG,
    rotationZDeg: DEFAULT_FOOT_ROTATION_Z_DEG,
    offsetX: DEFAULT_FOOT_OFFSET_X,
    offsetY: DEFAULT_FOOT_OFFSET_Y,
    offsetZ: DEFAULT_FOOT_OFFSET_Z,
  });

  useEffect(() => {
    const section = sectionRef.current;
    const canvasRoot = canvasRef.current;
    if (!section || !canvasRoot) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050814);
    scene.fog = new THREE.Fog(0x050814, 9, 30);

    const camera = new THREE.PerspectiveCamera(38, canvasRoot.clientWidth / canvasRoot.clientHeight, 0.1, 80);
    camera.position.set(-0.2, 3.45, 4.7);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(canvasRoot.clientWidth, canvasRoot.clientHeight);
    renderer.setClearColor(0x050814, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    canvasRoot.appendChild(renderer.domElement);

    const clock = new THREE.Clock();
    const particleTexture = createParticleTexture();
    const pointer = new THREE.Vector2();
    const pointerTarget = new THREE.Vector2();
    const visibleRef = { current: true };
    const gltfLoader = new GLTFLoader();
    const fbxLoader = new FBXLoader();
    let animationFrame = 0;
    let disposed = false;
    let morphTargets: MorphTarget[] = [];
    let activeIndex = 0;
    let sweepDirection: 1 | -1 = 1;
    let latestLabel = 'MUSHROOM';
    let transitionFromIndex = 0;
    let transitionToIndex = 0;
    let transitionProgress = 1;
    let transitionState: 'idle' | 'animating' | 'holding' = 'idle';
    let holdTimerMs = 0;

    const backgroundGroup = new THREE.Group();
    const cloudA = createBackgroundPoints(particleTexture, 950, 12, '#7dd3fc', '#f8fafc', 0.12);
    const cloudB = createBackgroundPoints(particleTexture, 820, 14, '#38bdf8', '#f59e0b', 0.1);
    const cloudC = createBackgroundPoints(particleTexture, 640, 10, '#e2e8f0', '#67e8f9', 0.08);
    cloudA.position.set(-1.5, 0.25, -4.5);
    cloudB.position.set(1.6, -0.3, -6.2);
    cloudC.position.set(0.35, 0.8, -3.2);
    backgroundGroup.add(cloudA, cloudB, cloudC);
    scene.add(backgroundGroup);

    const livePositions = new Float32Array(PARTICLE_COUNT * 3);
    const renderPositions = new Float32Array(PARTICLE_COUNT * 3);
    const liveColors = new Float32Array(PARTICLE_COUNT * 3);
    const noiseSeeds = Float32Array.from(
      Array.from({ length: PARTICLE_COUNT }, () => Math.random() * Math.PI * 2),
    );
    const revealJitter = Float32Array.from(
      Array.from({ length: PARTICLE_COUNT }, () => Math.random() * POINT_REVEAL_JITTER),
    );
    const bedEuler = new THREE.Euler();
    const bedQuaternion = new THREE.Quaternion();
    const footEuler = new THREE.Euler();
    const footQuaternion = new THREE.Quaternion();
    const sourcePoint = new THREE.Vector3();
    const destinationPoint = new THREE.Vector3();

    const morphGeometry = new THREE.BufferGeometry();
    morphGeometry.setAttribute('position', new THREE.BufferAttribute(renderPositions, 3));
    morphGeometry.setAttribute('color', new THREE.BufferAttribute(liveColors, 3));

    const morphMaterial = new THREE.PointsMaterial({
      size: 0.082,
      map: particleTexture,
      transparent: true,
      opacity: 0.94,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    const morphPoints = new THREE.Points(morphGeometry, morphMaterial);
    scene.add(morphPoints);

    const rimLight = new THREE.PointLight(0x7dd3fc, 5, 22, 2);
    rimLight.position.set(-3.3, 2.1, 5.2);
    scene.add(rimLight);

    const accentLight = new THREE.PointLight(0xf59e0b, 4.2, 20, 2);
    accentLight.position.set(3.2, -0.6, 4.2);
    scene.add(accentLight);

    const ambient = new THREE.AmbientLight(0xffffff, 0.22);
    scene.add(ambient);

    const setSceneLabel = (label: string) => {
      if (latestLabel === label) return;
      latestLabel = label;
      setActiveLabel(label);
    };

    const readTargetPoint = (
      target: MorphTarget,
      index: number,
      offsetX: number,
      output: THREE.Vector3,
    ) => {
      output.set(
        target.positions[index] + offsetX,
        target.positions[index + 1],
        target.positions[index + 2],
      );

      if (target.label === 'BED') {
        output.applyQuaternion(bedQuaternion);
        output.x += bedControlRef.current.offsetX;
        output.y += bedControlRef.current.offsetY;
        output.z += bedControlRef.current.offsetZ;
      }

      if (target.label === 'FOOT') {
        output.applyQuaternion(footQuaternion);
        output.x += footRotationRef.current.offsetX;
        output.y += footRotationRef.current.offsetY;
        output.z += footRotationRef.current.offsetZ;
      }

      return output;
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        visibleRef.current = entry.isIntersecting;
      },
      { threshold: 0.1 },
    );
    observer.observe(section);

    const onPointerMove = (event: PointerEvent) => {
      const rect = section.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      pointerTarget.x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      pointerTarget.y = ((event.clientY - rect.top) / rect.height - 0.5) * -2;
    };

    const onPointerLeave = () => {
      pointerTarget.set(0, 0);
    };

    const onResize = () => {
      camera.aspect = canvasRoot.clientWidth / canvasRoot.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(canvasRoot.clientWidth, canvasRoot.clientHeight);
    };

    const getSectionProgress = () => {
      const currentRect = section.getBoundingClientRect();
      const totalScrollable = Math.max(section.offsetHeight - window.innerHeight, 1);
      return THREE.MathUtils.clamp(-currentRect.top / totalScrollable, 0, 1);
    };

    const beginMorphTransition = (nextIndex: number, direction: 1 | -1) => {
      if (nextIndex === activeIndex || nextIndex < 0 || nextIndex >= morphTargets.length) return;

      transitionFromIndex = activeIndex;
      transitionToIndex = nextIndex;
      transitionProgress = 0;
      transitionState = 'animating';
      holdTimerMs = 0;
      sweepDirection = direction;
      setSceneLabel(morphTargets[nextIndex].label);
    };

    const onWheel = (event: WheelEvent) => {
      if (!visibleRef.current || morphTargets.length <= 1) return;

      const progress = getSectionProgress();
      if (progress < 0.24) return;
      if (transitionState !== 'idle') {
        event.preventDefault();
        return;
      }

      const direction = event.deltaY > 0 ? 1 : -1;
      if (direction === 1 && activeIndex < morphTargets.length - 1) {
        beginMorphTransition(activeIndex + 1, 1);
        event.preventDefault();
      } else if (direction === -1 && activeIndex > 0) {
        beginMorphTransition(activeIndex - 1, -1);
        event.preventDefault();
      }
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerleave', onPointerLeave);
    window.addEventListener('resize', onResize);
    window.addEventListener('wheel', onWheel, { passive: false });

    const loadTargetsProgressively = async () => {
      try {
        const loadedTargets: MorphTarget[] = [];

        for (const spec of MODEL_SPECS) {
          setLoadingText(`正在采样 ${spec.title} 模型 ${loadedTargets.length + 1}/${MODEL_SPECS.length}...`);
          const modelRoot = await loadModel(spec, gltfLoader, fbxLoader);
          const target = sampleMorphTarget(modelRoot, spec);
          loadedTargets.push(target);

          if (disposed) return;

          morphTargets = [...loadedTargets];

          if (loadedTargets.length === 1) {
            activeIndex = 0;
            sweepDirection = 1;
            latestLabel = target.label;
            setActiveLabel(target.label);
            const initialOffsetX = getModelOffsetX(0);
            for (let index = 0; index < target.positions.length; index += 3) {
              livePositions[index] = target.positions[index] + initialOffsetX;
              livePositions[index + 1] = target.positions[index + 1];
              livePositions[index + 2] = target.positions[index + 2];
              renderPositions[index] = livePositions[index];
              renderPositions[index + 1] = livePositions[index + 1];
              renderPositions[index + 2] = livePositions[index + 2];
              liveColors[index] = target.colors[index];
              liveColors[index + 1] = target.colors[index + 1];
              liveColors[index + 2] = target.colors[index + 2];
            }
            morphGeometry.attributes.position.needsUpdate = true;
            morphGeometry.attributes.color.needsUpdate = true;
            setLoadingText('Mushroom particles are ready. Loading bed, chair, robot, and foot...');
          } else {
            setLoadingText(`Loaded ${loadedTargets.length}/${MODEL_SPECS.length} models. Sampling the remaining targets...`);
          }
        }

        if (disposed || loadedTargets.length === 0) return;

        morphTargets = [...loadedTargets];
        activeIndex = 0;
        sweepDirection = 1;
        transitionFromIndex = 0;
        transitionToIndex = 0;
        transitionProgress = 1;
        transitionState = 'idle';
        holdTimerMs = 0;
        latestLabel = loadedTargets[0].label;
        setActiveLabel(loadedTargets[0].label);
        setLoadingText('Wheel once per morph: Mushroom, Bed, Chair, Robot, Foot alternating left/right across the stage.');
      } catch (error) {
        console.error(error);
        if (!disposed) {
          setLoadError('Failed to load one or more morph targets. Check the model path or file format.');
        }
      }
    };

    loadTargetsProgressively();

    const animate = () => {
      animationFrame = requestAnimationFrame(animate);

      const delta = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.elapsedTime;
      const rect = section.getBoundingClientRect();
      const totalScroll = Math.max(section.offsetHeight - window.innerHeight, 1);
      const sectionProgress = THREE.MathUtils.clamp(-rect.top / totalScroll, 0, 1);
      pointer.lerp(pointerTarget, 0.08);
      let morphPath = activeIndex;

      if (transitionState === 'animating') {
        transitionProgress = Math.min(1, transitionProgress + (delta * 1000) / MORPH_TRANSITION_DURATION_MS);
        morphPath = THREE.MathUtils.lerp(transitionFromIndex, transitionToIndex, transitionProgress);

        if (transitionProgress >= 1) {
          activeIndex = transitionToIndex;
          transitionState = 'holding';
          holdTimerMs = MORPH_HOLD_DURATION_MS;
          morphPath = activeIndex;
        }
      } else if (transitionState === 'holding') {
        holdTimerMs = Math.max(0, holdTimerMs - delta * 1000);
        morphPath = activeIndex;

        if (holdTimerMs <= 0) {
          transitionState = 'idle';
        }
      }

      let displayOffsetX = morphTargets.length > 0 ? getModelOffsetX(activeIndex) : 0;
      if (morphTargets.length > 1) {
        const maxIndex = morphTargets.length - 1;
        const lowerIndex = Math.min(maxIndex, Math.floor(morphPath));
        const upperIndex = Math.min(maxIndex, lowerIndex + 1);
        const localProgress = upperIndex === lowerIndex ? 1 : morphPath - lowerIndex;
        displayOffsetX = THREE.MathUtils.lerp(
          getModelOffsetX(lowerIndex),
          getModelOffsetX(upperIndex),
          localProgress,
        );
      }

      const cameraPhase = smoothstep(0.01, 0.24, sectionProgress);
      const targetCameraX = THREE.MathUtils.lerp(-0.2, displayOffsetX * 0.28 + pointer.x * 0.18, cameraPhase);
      const targetCameraY = THREE.MathUtils.lerp(3.45, 0.9, cameraPhase) + pointer.y * 0.24;
      const targetCameraZ = THREE.MathUtils.lerp(4.7, 8.35, cameraPhase);
      const targetLookX = THREE.MathUtils.lerp(-0.25, displayOffsetX * 0.44, cameraPhase) + pointer.x * 0.04;
      const targetLookY = THREE.MathUtils.lerp(0.55, 0, cameraPhase) + pointer.y * 0.06;
      const targetLookZ = THREE.MathUtils.lerp(0.45, 0, cameraPhase);
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetCameraX, 0.05);
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetCameraY, 0.05);
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetCameraZ, 0.05);
      camera.lookAt(targetLookX, targetLookY, targetLookZ);

      backgroundGroup.rotation.y += delta * 0.05;
      cloudA.rotation.x -= delta * 0.03;
      cloudB.rotation.y += delta * 0.05;
      cloudC.rotation.z += delta * 0.04;
      cloudA.position.y = 0.25 + Math.sin(elapsed * 0.3) * 0.12;
      cloudB.position.y = -0.3 + Math.cos(elapsed * 0.34) * 0.08;
      cloudC.position.y = 0.8 + Math.sin(elapsed * 0.42) * 0.06;

      morphPoints.rotation.y = THREE.MathUtils.lerp(0.03, 0.14, cameraPhase) + Math.sin(elapsed * 0.22) * 0.02;
      morphPoints.rotation.x = THREE.MathUtils.lerp(-0.3, -0.12, cameraPhase);

      if (visibleRef.current && morphTargets.length > 0) {
        bedEuler.set(
          THREE.MathUtils.degToRad(bedControlRef.current.rotationXDeg),
          THREE.MathUtils.degToRad(bedControlRef.current.rotationYDeg),
          THREE.MathUtils.degToRad(bedControlRef.current.rotationZDeg),
        );
        bedQuaternion.setFromEuler(bedEuler);

        footEuler.set(
          THREE.MathUtils.degToRad(footRotationRef.current.rotationXDeg),
          THREE.MathUtils.degToRad(footRotationRef.current.rotationYDeg),
          THREE.MathUtils.degToRad(footRotationRef.current.rotationZDeg),
        );
        footQuaternion.setFromEuler(footEuler);

        let sourceTarget = morphTargets[activeIndex];
        let destinationTarget = morphTargets[activeIndex];
        let revealProgress = 1;
        let revealDirection: 1 | -1 = sweepDirection;
        let sourceOffsetX = getModelOffsetX(activeIndex);
        let destinationOffsetX = sourceOffsetX;

        if (morphTargets.length > 1) {
          if (transitionState === 'animating') {
            sourceTarget = morphTargets[transitionFromIndex];
            destinationTarget = morphTargets[transitionToIndex];
            revealProgress = transitionProgress;
            revealDirection = sweepDirection;
            sourceOffsetX = getModelOffsetX(transitionFromIndex);
            destinationOffsetX = getModelOffsetX(transitionToIndex);
          } else {
            sourceTarget = morphTargets[activeIndex];
            destinationTarget = morphTargets[activeIndex];
            revealProgress = 1;
            revealDirection = sweepDirection;
            sourceOffsetX = getModelOffsetX(activeIndex);
            destinationOffsetX = getModelOffsetX(activeIndex);
            setSceneLabel(sourceTarget.label);
          }
        }

        const followStrength = PARTICLE_FOLLOW_STRENGTH + Math.abs(pointer.y) * 0.006;

        for (let index = 0; index < livePositions.length; index += 3) {
          const pointIndex = index / 3;
          readTargetPoint(sourceTarget, index, sourceOffsetX, sourcePoint);
          let targetX = sourcePoint.x;
          let targetY = sourcePoint.y;
          let targetZ = sourcePoint.z;
          let colorR = sourceTarget.colors[index];
          let colorG = sourceTarget.colors[index + 1];
          let colorB = sourceTarget.colors[index + 2];

          if (transitionState === 'animating') {
            const revealWeight = destinationTarget.sweepWeights[pointIndex];
            const directionalWeight = revealDirection === 1 ? revealWeight : 1 - revealWeight;
            const localProgress = smoothstep(
              directionalWeight - SWEEP_EDGE_WIDTH + revealJitter[pointIndex],
              directionalWeight + SWEEP_EDGE_WIDTH + revealJitter[pointIndex],
              revealProgress,
            );

            readTargetPoint(destinationTarget, index, destinationOffsetX, destinationPoint);
            targetX = THREE.MathUtils.lerp(sourcePoint.x, destinationPoint.x, localProgress);
            targetY = THREE.MathUtils.lerp(sourcePoint.y, destinationPoint.y, localProgress);
            targetZ = THREE.MathUtils.lerp(sourcePoint.z, destinationPoint.z, localProgress);
            colorR = THREE.MathUtils.lerp(sourceTarget.colors[index], destinationTarget.colors[index], localProgress);
            colorG = THREE.MathUtils.lerp(sourceTarget.colors[index + 1], destinationTarget.colors[index + 1], localProgress);
            colorB = THREE.MathUtils.lerp(sourceTarget.colors[index + 2], destinationTarget.colors[index + 2], localProgress);
          }

          livePositions[index] = THREE.MathUtils.lerp(livePositions[index], targetX, followStrength);
          livePositions[index + 1] = THREE.MathUtils.lerp(livePositions[index + 1], targetY, followStrength);
          livePositions[index + 2] = THREE.MathUtils.lerp(livePositions[index + 2], targetZ, followStrength);

          renderPositions[index] = livePositions[index] + Math.sin(elapsed * 1.25 + noiseSeeds[pointIndex]) * 0.013;
          renderPositions[index + 1] = livePositions[index + 1] + Math.cos(elapsed * 1.6 + noiseSeeds[pointIndex] * 1.15) * 0.01;
          renderPositions[index + 2] = livePositions[index + 2] + Math.sin(elapsed * 1.05 + noiseSeeds[pointIndex] * 0.9) * 0.013;

          liveColors[index] = THREE.MathUtils.lerp(liveColors[index], colorR, 0.1);
          liveColors[index + 1] = THREE.MathUtils.lerp(liveColors[index + 1], colorG, 0.1);
          liveColors[index + 2] = THREE.MathUtils.lerp(liveColors[index + 2], colorB, 0.1);
        }

        morphMaterial.size = THREE.MathUtils.lerp(0.074, 0.095, cameraPhase) + Math.sin(elapsed * (2.1 + Math.abs(pointer.y) * 0.55)) * 0.005;
        morphMaterial.opacity = THREE.MathUtils.lerp(0.9, 0.98, cameraPhase);
        morphGeometry.attributes.position.needsUpdate = true;
        morphGeometry.attributes.color.needsUpdate = true;
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      disposed = true;
      observer.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerleave', onPointerLeave);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('wheel', onWheel);
      cancelAnimationFrame(animationFrame);

      backgroundGroup.traverse((object) => {
        const points = object as THREE.Points;
        const geometry = points.geometry as THREE.BufferGeometry | undefined;
        const material = points.material as THREE.Material | THREE.Material[] | undefined;

        geometry?.dispose();

        if (Array.isArray(material)) {
          material.forEach((item) => item.dispose());
        } else {
          material?.dispose();
        }
      });

      morphGeometry.dispose();
      morphMaterial.dispose();
      particleTexture.dispose();
      renderer.dispose();
      canvasRoot.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative min-h-[180vh]"
      style={{ background: '#050814' }}
    >
      <div className="sticky top-0 min-h-screen overflow-hidden">
        <div ref={canvasRef} className="absolute inset-0" />

        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at 50% 34%, rgba(74,144,226,0.18) 0%, rgba(5,8,20,0.08) 38%, rgba(5,8,20,0.92) 100%)',
          }}
        />

        <div className="relative z-10 flex min-h-screen flex-col justify-between px-8 py-12 md:px-12 lg:px-16">
          <div className="max-w-[620px] pt-24 md:pt-32">
            <div
              className="flex items-center gap-3 text-[11px] uppercase tracking-[0.28em]"
              style={{
                color: 'rgba(125,211,252,0.78)',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              <span
                className="h-px w-8"
                style={{ background: 'linear-gradient(90deg, rgba(125,211,252,0), rgba(125,211,252,0.8))' }}
              />
              Sensor visual system
            </div>
            <div
              className="mt-4 text-6xl font-bold uppercase leading-none md:text-8xl"
              style={{
                color: '#ffffff',
                fontFamily: "'Space Grotesk', sans-serif",
                textShadow: '0 0 28px rgba(125,211,252,0.45)',
              }}
            >
              SHROOM
            </div>
            <div
              className="mt-6 text-xl font-medium md:text-2xl"
              style={{
                color: '#60a5fa',
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              对传感器的视觉表达
            </div>
            <h2
              className="mt-3 text-4xl font-light leading-tight md:text-5xl"
              style={{ color: '#ffffff', fontFamily: "'Space Grotesk', sans-serif" }}
            >
              场景无限衍生。
            </h2>
            <div
              className="mt-7 h-px w-32"
              style={{ background: 'linear-gradient(90deg, rgba(125,211,252,0.72), rgba(255,255,255,0))' }}
            />
            <p
              className="mt-6 max-w-md text-sm leading-8 md:text-base"
              style={{ color: 'rgba(255,255,255,0.58)', fontFamily: "'Space Grotesk', sans-serif" }}
            >
              
              <br />
              SHROOM 将传感器感知范围转化为可视化的空间结构，
              <br />
              激发多元场景想象，连接现实与未来可能。
            </p>
            <div className="mt-8 grid max-w-xl grid-cols-1 gap-5 sm:grid-cols-3">
              {[
                ['感知可视化', '传感范围直观呈现'],
                ['场景可延展', '多种形态自由衍生'],
                ['未来可联接', '连接设备与更多可能'],
              ].map(([title, caption]) => (
                <div key={title}>
                  <div
                    className="text-sm font-semibold"
                    style={{ color: 'rgba(255,255,255,0.88)', fontFamily: "'Space Grotesk', sans-serif" }}
                  >
                    {title}
                  </div>
                  <div
                    className="mt-1 text-xs"
                    style={{ color: 'rgba(255,255,255,0.44)', fontFamily: "'Space Grotesk', sans-serif" }}
                  >
                    {caption}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="flex flex-wrap gap-3">
              {MODEL_SPECS.map((spec) => {
                const active = activeLabel === spec.label;
                return (
                  <div
                    key={spec.label}
                    className="rounded-full px-5 py-2.5 text-sm transition-all duration-500"
                    style={{
                      color: active ? '#ffffff' : 'rgba(255,255,255,0.5)',
                      background: active ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)',
                      border: active
                        ? '1px solid rgba(255,255,255,0.18)'
                        : '1px solid rgba(255,255,255,0.08)',
                      boxShadow: active ? '0 0 40px rgba(125,211,252,0.1)' : 'none',
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    {spec.badgePrefix}/{spec.badgeTitle}
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col gap-3 md:items-end">
              <div
                className="rounded-2xl px-5 py-4 text-sm backdrop-blur-md"
                style={{
                  color: loadError ? '#fca5a5' : 'rgba(255,255,255,0.65)',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {loadError ?? loadingText}
              </div>

              <div
                className="rounded-full px-4 py-2 text-xs tracking-[0.24em] uppercase"
                style={{
                  color: 'rgba(255,255,255,0.44)',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                Wheel Morph: SHROOM/SHROOM / 关怀/床 / 定制/座椅 / 精密/机器人 / LAB/足底
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
