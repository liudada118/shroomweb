import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js';

const MUSHROOM_MODEL_URL = new URL('../../../../model/shroom.glb', import.meta.url).href;
const BED_MODEL_URL = new URL('../../../../model/bed.glb', import.meta.url).href;

const PARTICLE_COUNT = 6400;
const SOS_PARTICLE_COUNT = 760;
const LOADING_HOLD_SECONDS = 1.65;
const PARTICLE_REVEAL_DURATION_SECONDS = 1.9;
const IMPACT_PULSE_CENTERS = [0.16, 0.5, 0.84] as const;
const MORPH_TO_BED_DURATION_SECONDS = 1.65;
const IMPACT_SEQUENCE_DURATION_SECONDS = 3.9;
const BED_SCREEN_OFFSET_X = 1.9;
const BED_SCREEN_OFFSET_Y = -0.9;
const BED_SCREEN_OFFSET_Z = -0.08;
const SOS_UNIFORM_SCALE = 1.3;
const SOS_TEXT_WIDTH = 1.42;
const SOS_TEXT_HEIGHT = 0.46;
const SOS_POPUP_WIDTH = 1.46;
const SOS_POPUP_HEIGHT = 0.48;
const SOS_SCREEN_OFFSET_X = 1.14 + SOS_POPUP_WIDTH * SOS_UNIFORM_SCALE;
const SOS_SCREEN_OFFSET_Y = 1.74;
const SOS_POPUP_OFFSET_Y = 1.84;
const SOS_POPUP_OFFSET_Z = -0.24;
const DEFAULT_BED_ROTATION_X_DEG = -22;
const DEFAULT_BED_ROTATION_Y_DEG = 29;
const DEFAULT_BED_ROTATION_Z_DEG = 32;
const SOS_VERTICAL_SCALE = 2;

type ModelSpec = {
  label: string;
  title: string;
  url: string;
  color: string;
  targetSize: number;
};

type SampledTarget = {
  positions: Float32Array;
  colors: Float32Array;
};

type BedControlState = {
  rotationXDeg: number;
  rotationYDeg: number;
  rotationZDeg: number;
  offsetX: number;
  offsetY: number;
  offsetZ: number;
};

const MUSHROOM_SPEC: ModelSpec = {
  label: 'MUSHROOM',
  title: 'Shroom',
  url: MUSHROOM_MODEL_URL,
  color: '#7dd3fc',
  targetSize: 4.1,
};

const BED_SPEC: ModelSpec = {
  label: 'BED',
  title: 'Bed',
  url: BED_MODEL_URL,
  color: '#38bdf8',
  targetSize: 4.9,
};

function smoothstep(start: number, end: number, value: number) {
  const t = THREE.MathUtils.clamp((value - start) / (end - start), 0, 1);
  return t * t * (3 - 2 * t);
}

function bellPulse(progress: number, center: number, width: number) {
  const normalized = 1 - Math.min(1, Math.abs(progress - center) / width);
  return normalized <= 0 ? 0 : normalized * normalized * (3 - 2 * normalized);
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

  const gradient = context.createRadialGradient(64, 64, 6, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.3, 'rgba(255,255,255,0.96)');
  gradient.addColorStop(0.62, 'rgba(255,255,255,0.35)');
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
    positions[stride + 1] = (Math.random() - 0.5) * radius * 1.4;
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
    opacity: 0.48,
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

function sampleTarget(root: THREE.Object3D, spec: ModelSpec): SampledTarget {
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
  const highlight = baseColor.clone().offsetHSL(0.03, 0.1, 0.14);
  let cursor = 0;

  normalizedRoot.updateMatrixWorld(true);

  meshes.forEach((mesh, meshIndex) => {
    mesh.updateWorldMatrix(true, false);
    const sampler = new MeshSurfaceSampler(mesh).build();

    for (let index = 0; index < counts[meshIndex]; index += 1) {
      sampler.sample(point, normal);
      mesh.localToWorld(point);
      normal.transformDirection(mesh.matrixWorld).normalize();
      point.addScaledVector(normal, (Math.random() - 0.5) * 0.022);

      const stride = cursor * 3;
      positions[stride] = point.x;
      positions[stride + 1] = point.y;
      positions[stride + 2] = point.z;

      const color = baseColor.clone().lerp(highlight, Math.random() * 0.45);
      colors[stride] = color.r;
      colors[stride + 1] = color.g;
      colors[stride + 2] = color.b;

      cursor += 1;
    }
  });

  return { positions, colors };
}

function createTextTarget(text: string, count: number, color: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Unable to create text target');
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#ffffff';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = '900 240px Arial Black, Arial, sans-serif';
  context.fillText(text, canvas.width / 2, canvas.height / 2);

  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const samples: Array<{ x: number; y: number }> = [];

  for (let y = 0; y < canvas.height; y += 5) {
    for (let x = 0; x < canvas.width; x += 5) {
      const index = (y * canvas.width + x) * 4 + 3;
      if (pixels[index] > 180) {
        samples.push({ x, y });
      }
    }
  }

  if (samples.length === 0) {
    throw new Error('Unable to sample SOS text');
  }

  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const baseColor = new THREE.Color(color);
  const highlight = new THREE.Color('#fecdd3');

  for (let index = 0; index < count; index += 1) {
    const sample = samples[Math.floor(Math.random() * samples.length)];
    const stride = index * 3;
    positions[stride] = ((sample.x / canvas.width) - 0.5) * SOS_TEXT_WIDTH * SOS_UNIFORM_SCALE + SOS_SCREEN_OFFSET_X;
    positions[stride + 1] =
      (0.5 - sample.y / canvas.height) * SOS_TEXT_HEIGHT * SOS_VERTICAL_SCALE * SOS_UNIFORM_SCALE + SOS_SCREEN_OFFSET_Y;
    positions[stride + 2] = (Math.random() - 0.5) * 0.18;

    const pointColor = baseColor.clone().lerp(highlight, Math.random() * 0.35);
    colors[stride] = pointColor.r;
    colors[stride + 1] = pointColor.g;
    colors[stride + 2] = pointColor.b;
  }

  return { positions, colors };
}

function createPopupTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 720;
  canvas.height = 240;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Unable to create popup texture');
  }

  const width = canvas.width;
  const height = canvas.height;
  const radius = 32;

  context.clearRect(0, 0, width, height);
  context.shadowBlur = 28;
  context.shadowColor = 'rgba(251,113,133,0.24)';
  context.fillStyle = 'rgba(9, 14, 32, 0.88)';

  context.beginPath();
  context.moveTo(radius, 0);
  context.lineTo(width - radius, 0);
  context.quadraticCurveTo(width, 0, width, radius);
  context.lineTo(width, height - radius);
  context.quadraticCurveTo(width, height, width - radius, height);
  context.lineTo(radius, height);
  context.quadraticCurveTo(0, height, 0, height - radius);
  context.lineTo(0, radius);
  context.quadraticCurveTo(0, 0, radius, 0);
  context.closePath();
  context.fill();

  context.shadowBlur = 0;
  context.strokeStyle = 'rgba(251,113,133,0.38)';
  context.lineWidth = 3;
  context.stroke();

  context.fillStyle = 'rgba(255,255,255,0.2)';
  context.font = '700 22px Arial';
  context.textAlign = 'left';
  context.fillText('Notification', 28, 42);

  context.fillStyle = 'rgba(251,113,133,0.9)';
  context.beginPath();
  context.arc(width - 30, 30, 6, 0, Math.PI * 2);
  context.fill();

  context.strokeStyle = 'rgba(125,211,252,0.18)';
  context.lineWidth = 1.5;
  context.strokeRect(22, 58, width - 44, height - 80);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function createScatterPositions(count: number) {
  const positions = new Float32Array(count * 3);

  for (let index = 0; index < count; index += 1) {
    const stride = index * 3;
    positions[stride] = (Math.random() - 0.5) * 7.2;
    positions[stride + 1] = 0.7 + Math.random() * 2.6;
    positions[stride + 2] = (Math.random() - 0.5) * 1.8;
  }

  return positions;
}

function loadGltf(url: string, loader: GLTFLoader) {
  return new Promise<THREE.Object3D>((resolve, reject) => {
    loader.load(
      url,
      (result) => resolve(result.scene),
      undefined,
      reject,
    );
  });
}

type ShroomJourneySectionProps = {
  onBack?: () => void;
};

export default function ShroomJourneySection({ onBack }: ShroomJourneySectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [bedControls, setBedControls] = useState<BedControlState>({
    rotationXDeg: DEFAULT_BED_ROTATION_X_DEG,
    rotationYDeg: DEFAULT_BED_ROTATION_Y_DEG,
    rotationZDeg: DEFAULT_BED_ROTATION_Z_DEG,
    offsetX: BED_SCREEN_OFFSET_X,
    offsetY: BED_SCREEN_OFFSET_Y,
    offsetZ: BED_SCREEN_OFFSET_Z,
  });
  const bedControlRef = useRef<BedControlState>({
    rotationXDeg: DEFAULT_BED_ROTATION_X_DEG,
    rotationYDeg: DEFAULT_BED_ROTATION_Y_DEG,
    rotationZDeg: DEFAULT_BED_ROTATION_Z_DEG,
    offsetX: BED_SCREEN_OFFSET_X,
    offsetY: BED_SCREEN_OFFSET_Y,
    offsetZ: BED_SCREEN_OFFSET_Z,
  });
  const [loadingText, setLoadingText] = useState('Loading shroom core...');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [stageLabel, setStageLabel] = useState('BOOTING');

  const updateBedControl =
    (key: keyof BedControlState) =>
    (event: ChangeEvent<HTMLInputElement>) => {
      const nextValue = Number(event.target.value);

      setBedControls((current) => {
        const nextState = { ...current, [key]: nextValue };
        bedControlRef.current = nextState;
        return nextState;
      });
    };

  useEffect(() => {
    const section = sectionRef.current;
    const canvasRoot = canvasRef.current;
    if (!section || !canvasRoot) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x040816);
    scene.fog = new THREE.Fog(0x040816, 9, 28);

    const camera = new THREE.PerspectiveCamera(38, canvasRoot.clientWidth / canvasRoot.clientHeight, 0.1, 90);
    camera.position.set(0, 0.45, 5.9);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(canvasRoot.clientWidth, canvasRoot.clientHeight);
    renderer.setClearColor(0x040816, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    canvasRoot.appendChild(renderer.domElement);

    const clock = new THREE.Clock();
    const loader = new GLTFLoader();
    const particleTexture = createParticleTexture();
    const popupTexture = createPopupTexture();
    const pointer = new THREE.Vector2();
    const pointerTarget = new THREE.Vector2();
    const visibleRef = { current: true };
    let animationFrame = 0;
    let disposed = false;
    let latestStage = 'BOOTING';
    let mushroomTarget: SampledTarget | null = null;
    let bedTarget: SampledTarget | null = null;
    let mushroomDisplay: THREE.Group | null = null;
    let particleUnlockAt = Number.POSITIVE_INFINITY;
    let scenePhase = 0;
    let transitionState: 'idle' | 'toBed' | 'impactSequence' = 'idle';
    let morphToBedProgress = 0;
    let impactSequenceProgress = 0;
    const mushroomMaterials: THREE.MeshPhysicalMaterial[] = [];

    const setStage = (nextStage: string) => {
      if (latestStage === nextStage) return;
      latestStage = nextStage;
      setStageLabel(nextStage);
    };

    const backgroundGroup = new THREE.Group();
    const cloudA = createBackgroundPoints(particleTexture, 760, 11, '#7dd3fc', '#e2e8f0', 0.11);
    const cloudB = createBackgroundPoints(particleTexture, 640, 12, '#38bdf8', '#fca5a5', 0.09);
    const cloudC = createBackgroundPoints(particleTexture, 540, 10, '#f8fafc', '#7dd3fc', 0.08);
    cloudA.position.set(-1.4, 0.45, -4.6);
    cloudB.position.set(1.45, -0.35, -6.4);
    cloudC.position.set(0.2, 0.95, -3.3);
    backgroundGroup.add(cloudA, cloudB, cloudC);
    scene.add(backgroundGroup);

    const livePositions = new Float32Array(PARTICLE_COUNT * 3);
    const renderPositions = new Float32Array(PARTICLE_COUNT * 3);
    const liveColors = new Float32Array(PARTICLE_COUNT * 3);
    const noiseSeeds = Float32Array.from(
      Array.from({ length: PARTICLE_COUNT }, () => Math.random() * Math.PI * 2),
    );

    const morphGeometry = new THREE.BufferGeometry();
    morphGeometry.setAttribute('position', new THREE.BufferAttribute(renderPositions, 3));
    morphGeometry.setAttribute('color', new THREE.BufferAttribute(liveColors, 3));

    const morphMaterial = new THREE.PointsMaterial({
      size: 0.086,
      map: particleTexture,
      transparent: true,
      opacity: 0,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    const morphPoints = new THREE.Points(morphGeometry, morphMaterial);
    scene.add(morphPoints);

    const sosTarget = createTextTarget('SOS', SOS_PARTICLE_COUNT, '#fb7185');
    const sosScatter = createScatterPositions(SOS_PARTICLE_COUNT);
    const sosLivePositions = sosScatter.slice();
    const sosRenderPositions = sosScatter.slice();
    const sosNoiseSeeds = Float32Array.from(
      Array.from({ length: SOS_PARTICLE_COUNT }, () => Math.random() * Math.PI * 2),
    );

    const sosGeometry = new THREE.BufferGeometry();
    sosGeometry.setAttribute('position', new THREE.BufferAttribute(sosRenderPositions, 3));
    sosGeometry.setAttribute('color', new THREE.BufferAttribute(sosTarget.colors, 3));

    const sosMaterial = new THREE.PointsMaterial({
      size: 0.094,
      map: particleTexture,
      transparent: true,
      opacity: 0,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    const sosPoints = new THREE.Points(sosGeometry, sosMaterial);
    scene.add(sosPoints);

    const popupMaterial = new THREE.MeshBasicMaterial({
      map: popupTexture,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const popupPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(SOS_POPUP_WIDTH, SOS_POPUP_HEIGHT * SOS_VERTICAL_SCALE),
      popupMaterial,
    );
    popupPlane.position.set(SOS_SCREEN_OFFSET_X, SOS_POPUP_OFFSET_Y, SOS_POPUP_OFFSET_Z);
    scene.add(popupPlane);

    const impactMaterialA = new THREE.MeshBasicMaterial({
      color: '#fb7185',
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const impactMaterialB = impactMaterialA.clone();
    const impactRingA = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.26, 96), impactMaterialA);
    const impactRingB = new THREE.Mesh(new THREE.RingGeometry(0.18, 0.22, 96), impactMaterialB);
    impactRingA.rotation.x = -Math.PI / 2;
    impactRingB.rotation.x = -Math.PI / 2;
    scene.add(impactRingA, impactRingB);
    const impactAnchorLocal = new THREE.Vector3();
    const impactAnchorWorld = new THREE.Vector3();
    const impactSurfaceNormal = new THREE.Vector3();
    const impactRingBaseQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
    const impactRingQuaternion = new THREE.Quaternion();

    const ambient = new THREE.AmbientLight(0xffffff, 0.24);
    scene.add(ambient);

    const keyLight = new THREE.PointLight(0x7dd3fc, 5.2, 24, 2);
    keyLight.position.set(-3.2, 2.4, 5.8);
    scene.add(keyLight);

    const fillLight = new THREE.PointLight(0xfb7185, 3.6, 20, 2);
    fillLight.position.set(2.8, 0.1, 4.4);
    scene.add(fillLight);

    const observer = new IntersectionObserver(
      ([entry]) => {
        visibleRef.current = entry.isIntersecting;
      },
      { threshold: 0.1 },
    );
    observer.observe(section);

    const onPointerMove = (event: PointerEvent) => {
      const rect = canvasRoot.getBoundingClientRect();
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

    const hydrateMainParticles = (target: SampledTarget) => {
      for (let index = 0; index < target.positions.length; index += 3) {
        livePositions[index] = target.positions[index];
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
    };

    const loadScene = async () => {
      try {
        setLoadingText('Loading shroom core...');
        const shroomRoot = await loadGltf(MUSHROOM_MODEL_URL, loader);
        if (disposed) return;

        mushroomDisplay = normalizeModel(shroomRoot.clone(), MUSHROOM_SPEC.targetSize * 0.98);
        mushroomDisplay.traverse((child) => {
          const mesh = child as THREE.Mesh;
          if (!mesh.isMesh) return;

          const material = new THREE.MeshPhysicalMaterial({
            color: '#a5f3fc',
            emissive: '#164e63',
            emissiveIntensity: 0.65,
            roughness: 0.28,
            metalness: 0.08,
            clearcoat: 1,
            clearcoatRoughness: 0.12,
            transparent: true,
            opacity: 1,
          });

          mesh.material = material;
          mushroomMaterials.push(material);
        });
        scene.add(mushroomDisplay);

        mushroomTarget = sampleTarget(shroomRoot.clone(), MUSHROOM_SPEC);
        hydrateMainParticles(mushroomTarget);
        setStage('LOADING SHROOM');
        setLoadingText('Shroom online. Loading bed response map...');

        const bedRoot = await loadGltf(BED_MODEL_URL, loader);
        if (disposed) return;

        bedTarget = sampleTarget(bedRoot.clone(), BED_SPEC);
        particleUnlockAt = clock.getElapsedTime() + LOADING_HOLD_SECONDS;
        scenePhase = 0;
        transitionState = 'idle';
        morphToBedProgress = 0;
        impactSequenceProgress = 0;
        setStage('MUSHROOM');
        setLoadingText('Shroom core stabilized. Scroll once to animate directly into the tilted bed.');
      } catch (error) {
        console.error(error);
        if (!disposed) {
          setLoadError('Failed to load shroom scene assets.');
          setStage('LOAD ERROR');
        }
      }
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerleave', onPointerLeave);
    window.addEventListener('resize', onResize);

    const onWheel = (event: WheelEvent) => {
      if (!visibleRef.current || event.deltaY <= 0) {
        return;
      }

      const particleReady =
        Number.isFinite(particleUnlockAt) &&
        clock.getElapsedTime() >= particleUnlockAt + PARTICLE_REVEAL_DURATION_SECONDS;

      if (!particleReady || transitionState !== 'idle') {
        event.preventDefault();
        return;
      }

      if (scenePhase === 0) {
        transitionState = 'toBed';
        morphToBedProgress = 0;
        setStage('MUSHROOM TO BED');
        setLoadingText('Morphing directly into the tilted bed view...');
        event.preventDefault();
        return;
      }

      if (scenePhase === 1) {
        transitionState = 'impactSequence';
        impactSequenceProgress = 0;
        setStage('BED x3 IMPACT');
        setLoadingText('Triggering three impacts. SOS popup will appear after the third hit.');
        event.preventDefault();
      }
    };

    window.addEventListener('wheel', onWheel, { passive: false });

    loadScene();

    const animate = () => {
      animationFrame = requestAnimationFrame(animate);

      const delta = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.elapsedTime;
      const particleReveal = Number.isFinite(particleUnlockAt)
        ? smoothstep(particleUnlockAt, particleUnlockAt + PARTICLE_REVEAL_DURATION_SECONDS, elapsed)
        : 0;
      let morphToBed = scenePhase >= 1 ? 1 : 0;
      let bedImpact = 0;
      let sosReveal = scenePhase >= 2 ? 1 : 0;
      pointer.lerp(pointerTarget, 0.08);

      if (transitionState === 'toBed') {
        morphToBedProgress = Math.min(1, morphToBedProgress + delta / MORPH_TO_BED_DURATION_SECONDS);
        morphToBed = smoothstep(0, 1, morphToBedProgress);

        if (morphToBedProgress >= 1) {
          transitionState = 'idle';
          scenePhase = 1;
          morphToBed = 1;
          setStage('BED READY');
          setLoadingText('Tilted bed ready. Scroll once more to trigger the 3 impacts and then the SOS popup.');
        }
      }

      if (transitionState === 'impactSequence') {
        impactSequenceProgress = Math.min(1, impactSequenceProgress + delta / IMPACT_SEQUENCE_DURATION_SECONDS);
        bedImpact = smoothstep(0, 1, impactSequenceProgress);
        sosReveal = smoothstep(0.9, 1, impactSequenceProgress);

        if (impactSequenceProgress >= 1) {
          transitionState = 'idle';
          scenePhase = 2;
          bedImpact = 0;
          sosReveal = 1;
          setStage('SOS POPUP');
          setLoadingText('SOS popup online.');
        }
      }

      if (loadError) {
        setStage('LOAD ERROR');
      } else if (particleReveal < 0.98) {
        setStage('LOADING SHROOM');
      } else if (scenePhase === 0 && transitionState === 'idle') {
        setStage('MUSHROOM PARTICLES');
      } else if (scenePhase === 1 && transitionState === 'idle') {
        setStage('BED READY');
      } else if (transitionState === 'impactSequence') {
        setStage('BED x3 IMPACT');
      } else if (scenePhase >= 2) {
        setStage('SOS POPUP');
      }

      const { rotationXDeg, rotationYDeg, rotationZDeg, offsetX, offsetY, offsetZ } = bedControlRef.current;
      const bedRotationXRadians = -THREE.MathUtils.degToRad(rotationXDeg);
      const bedRotationYRadians = THREE.MathUtils.degToRad(rotationYDeg);
      const bedRotationZRadians = THREE.MathUtils.degToRad(rotationZDeg);
      const sosOffsetDeltaX = offsetX - BED_SCREEN_OFFSET_X;
      const sosOffsetDeltaY = offsetY - BED_SCREEN_OFFSET_Y;
      const sosOffsetDeltaZ = offsetZ - BED_SCREEN_OFFSET_Z;
      const cameraTravel = morphToBed;
      const targetCameraX = THREE.MathUtils.lerp(pointer.x * 0.22, -0.18 + pointer.x * 0.04, cameraTravel);
      const targetCameraY = THREE.MathUtils.lerp(0.45, 1.02, cameraTravel) + pointer.y * 0.08;
      const targetCameraZ = THREE.MathUtils.lerp(5.9, 7.02, cameraTravel);
      const targetLookX = THREE.MathUtils.lerp(pointer.x * 0.05, 0.48 + pointer.x * 0.015, cameraTravel);
      const targetLookY = THREE.MathUtils.lerp(0.08, 0.02, cameraTravel) + pointer.y * 0.02;
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetCameraX, 0.045);
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetCameraY, 0.045);
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetCameraZ, 0.045);
      camera.lookAt(targetLookX, targetLookY, 0);

      backgroundGroup.rotation.y += delta * 0.045;
      cloudA.rotation.x -= delta * 0.025;
      cloudB.rotation.y += delta * 0.04;
      cloudC.rotation.z += delta * 0.03;
      cloudA.position.y = 0.45 + Math.sin(elapsed * 0.34) * 0.12;
      cloudB.position.y = -0.35 + Math.cos(elapsed * 0.28) * 0.08;
      cloudC.position.y = 0.95 + Math.sin(elapsed * 0.42) * 0.06;

      if (mushroomDisplay) {
        const meshOpacity = 1 - particleReveal;
        mushroomDisplay.visible = meshOpacity > 0.02;
        mushroomDisplay.rotation.y += delta * 0.55;
        mushroomDisplay.rotation.x = Math.sin(elapsed * 0.4) * 0.06;
        mushroomDisplay.position.y = Math.sin(elapsed * 1.3) * 0.08;
        mushroomDisplay.scale.setScalar(1 + Math.sin(elapsed * 1.8) * 0.02);
        mushroomMaterials.forEach((material) => {
          material.opacity = meshOpacity;
          material.emissiveIntensity = 0.42 + Math.sin(elapsed * 2.4) * 0.14;
        });
      }

      morphPoints.rotation.y = THREE.MathUtils.lerp(0.06, bedRotationYRadians, morphToBed) + Math.sin(elapsed * 0.2) * 0.01;
      morphPoints.rotation.x = THREE.MathUtils.lerp(-0.08, bedRotationXRadians, morphToBed);
      morphPoints.rotation.z = THREE.MathUtils.lerp(0, bedRotationZRadians, morphToBed);

      if (mushroomTarget) {
        const followStrength = 0.078 + Math.abs(pointer.x) * 0.012;
        const impactPulses = IMPACT_PULSE_CENTERS.map((center) => bellPulse(bedImpact, center, 0.12));

        for (let index = 0; index < livePositions.length; index += 3) {
          const pointIndex = index / 3;
          const shroomX = mushroomTarget.positions[index];
          const shroomY = mushroomTarget.positions[index + 1];
          const shroomZ = mushroomTarget.positions[index + 2];
          const bedX = bedTarget ? bedTarget.positions[index] : shroomX;
          const bedY = bedTarget ? bedTarget.positions[index + 1] : shroomY;
          const bedZ = bedTarget ? bedTarget.positions[index + 2] : shroomZ;

          let targetX = THREE.MathUtils.lerp(shroomX, bedX + offsetX, morphToBed);
          let targetY = THREE.MathUtils.lerp(shroomY, bedY + offsetY, morphToBed);
          let targetZ = THREE.MathUtils.lerp(shroomZ, bedZ + offsetZ, morphToBed);

          const colorR = THREE.MathUtils.lerp(
            mushroomTarget.colors[index],
            bedTarget ? bedTarget.colors[index] : mushroomTarget.colors[index],
            morphToBed,
          );
          const colorG = THREE.MathUtils.lerp(
            mushroomTarget.colors[index + 1],
            bedTarget ? bedTarget.colors[index + 1] : mushroomTarget.colors[index + 1],
            morphToBed,
          );
          const colorB = THREE.MathUtils.lerp(
            mushroomTarget.colors[index + 2],
            bedTarget ? bedTarget.colors[index + 2] : mushroomTarget.colors[index + 2],
            morphToBed,
          );

          if (bedTarget && morphToBed > 0.88) {
            const dist = Math.sqrt(bedX * bedX + bedZ * bedZ);
            let impactOffset = 0;

            impactPulses.forEach((pulse, pulseIndex) => {
              if (pulse <= 0) return;

              const ring = Math.sin(dist * 7.1 - elapsed * (6.4 + pulseIndex * 0.22)) * Math.exp(-dist * 1.65);
              const strike = -Math.exp(-dist * 4.2) * pulse * (0.15 + pulseIndex * 0.015);
              impactOffset += ring * pulse * 0.115 + strike;
            });

            targetY += impactOffset;
          }

          livePositions[index] = THREE.MathUtils.lerp(livePositions[index], targetX, followStrength);
          livePositions[index + 1] = THREE.MathUtils.lerp(livePositions[index + 1], targetY, followStrength);
          livePositions[index + 2] = THREE.MathUtils.lerp(livePositions[index + 2], targetZ, followStrength);

          renderPositions[index] = livePositions[index] + Math.sin(elapsed * 1.2 + noiseSeeds[pointIndex]) * 0.011;
          renderPositions[index + 1] = livePositions[index + 1] + Math.cos(elapsed * 1.45 + noiseSeeds[pointIndex] * 1.1) * 0.009;
          renderPositions[index + 2] = livePositions[index + 2] + Math.sin(elapsed * 0.95 + noiseSeeds[pointIndex] * 0.8) * 0.011;

          liveColors[index] = THREE.MathUtils.lerp(liveColors[index], colorR, 0.1);
          liveColors[index + 1] = THREE.MathUtils.lerp(liveColors[index + 1], colorG, 0.1);
          liveColors[index + 2] = THREE.MathUtils.lerp(liveColors[index + 2], colorB, 0.1);
        }

        morphMaterial.opacity = THREE.MathUtils.lerp(0, 0.96, particleReveal);
        morphMaterial.size = THREE.MathUtils.lerp(0.07, 0.096, particleReveal) - morphToBed * 0.004;
        morphGeometry.attributes.position.needsUpdate = true;
        morphGeometry.attributes.color.needsUpdate = true;
      }

      const primaryImpactPulse = Math.max(...IMPACT_PULSE_CENTERS.map((center) => bellPulse(bedImpact, center, 0.11)));
      const trailingImpactPulse = Math.max(...IMPACT_PULSE_CENTERS.map((center) => bellPulse(bedImpact, center + 0.05, 0.16)));
      impactAnchorLocal.set(offsetX, offsetY, offsetZ);
      impactAnchorWorld.copy(impactAnchorLocal).applyQuaternion(morphPoints.quaternion);
      impactSurfaceNormal.set(0, 1, 0).applyQuaternion(morphPoints.quaternion).normalize();
      impactAnchorWorld.addScaledVector(impactSurfaceNormal, 0.035);
      impactRingQuaternion.copy(morphPoints.quaternion).multiply(impactRingBaseQuaternion);

      impactRingA.position.copy(impactAnchorWorld);
      impactRingB.position.copy(impactAnchorWorld);
      impactRingA.quaternion.copy(impactRingQuaternion);
      impactRingB.quaternion.copy(impactRingQuaternion);
      impactRingA.scale.setScalar(0.72 + primaryImpactPulse * 4.2);
      impactRingB.scale.setScalar(0.58 + trailingImpactPulse * 3.1);
      impactMaterialA.opacity = primaryImpactPulse * 0.48;
      impactMaterialB.opacity = trailingImpactPulse * 0.28;

      const sosFormation = smoothstep(0.08, 0.78, sosReveal);
      for (let index = 0; index < sosLivePositions.length; index += 3) {
        const pointIndex = index / 3;
        const targetX = THREE.MathUtils.lerp(
          sosScatter[index],
          sosTarget.positions[index] + sosOffsetDeltaX,
          sosFormation,
        );
        const targetY = THREE.MathUtils.lerp(
          sosScatter[index + 1],
          sosTarget.positions[index + 1] + sosOffsetDeltaY,
          sosFormation,
        );
        const targetZ = THREE.MathUtils.lerp(
          sosScatter[index + 2],
          sosTarget.positions[index + 2] + sosOffsetDeltaZ,
          sosFormation,
        );

        sosLivePositions[index] = THREE.MathUtils.lerp(sosLivePositions[index], targetX, 0.08);
        sosLivePositions[index + 1] = THREE.MathUtils.lerp(sosLivePositions[index + 1], targetY, 0.08);
        sosLivePositions[index + 2] = THREE.MathUtils.lerp(sosLivePositions[index + 2], targetZ, 0.08);

        sosRenderPositions[index] = sosLivePositions[index] + Math.sin(elapsed * 1.7 + sosNoiseSeeds[pointIndex]) * 0.012;
        sosRenderPositions[index + 1] = sosLivePositions[index + 1] + Math.cos(elapsed * 2.2 + sosNoiseSeeds[pointIndex] * 1.2) * 0.012;
        sosRenderPositions[index + 2] = sosLivePositions[index + 2] + Math.sin(elapsed * 1.15 + sosNoiseSeeds[pointIndex] * 0.9) * 0.01;
      }
      sosMaterial.opacity = sosReveal * 0.9;
      sosMaterial.size = THREE.MathUtils.lerp(0.076, 0.058, sosFormation) * SOS_UNIFORM_SCALE;
      sosGeometry.attributes.position.needsUpdate = true;

      popupMaterial.opacity = sosReveal * 0.92;
      popupPlane.scale.set(
        (0.94 + sosFormation * 0.05) * SOS_UNIFORM_SCALE,
        (0.94 + sosFormation * 0.05) * SOS_UNIFORM_SCALE,
        1,
      );
      popupPlane.position.x = SOS_SCREEN_OFFSET_X + sosOffsetDeltaX;
      popupPlane.position.y = SOS_POPUP_OFFSET_Y + sosOffsetDeltaY + (1 - sosFormation) * 0.08;
      popupPlane.position.z = SOS_POPUP_OFFSET_Z + sosOffsetDeltaZ;

      keyLight.intensity = 4.8 + primaryImpactPulse * 1.4;
      fillLight.intensity = 3.2 + sosReveal * 1.2;
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

      mushroomMaterials.forEach((material) => material.dispose());
      morphGeometry.dispose();
      morphMaterial.dispose();
      sosGeometry.dispose();
      sosMaterial.dispose();
      popupPlane.geometry.dispose();
      popupMaterial.dispose();
      popupTexture.dispose();
      impactRingA.geometry.dispose();
      impactRingB.geometry.dispose();
      impactMaterialA.dispose();
      impactMaterialB.dispose();
      particleTexture.dispose();
      renderer.dispose();

      if (canvasRoot.contains(renderer.domElement)) {
        canvasRoot.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative min-h-[200vh]"
      style={{ background: '#040816' }}
    >
      <div className="sticky top-0 min-h-screen overflow-hidden">
        <div ref={canvasRef} className="absolute inset-0" />

        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(circle at 50% 34%, rgba(125,211,252,0.18) 0%, rgba(4,8,22,0.08) 38%, rgba(4,8,22,0.92) 100%)',
          }}
        />

        <div className="relative z-10 flex min-h-screen flex-col justify-between px-6 py-8 md:px-12 md:py-10 lg:px-16">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="pointer-events-auto rounded-full px-4 py-2 text-xs tracking-[0.22em] uppercase transition-all duration-300"
                  style={{
                    color: 'rgba(255,255,255,0.72)',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  Back
                </button>
              )}
              <span
                className="text-xs tracking-[0.3em] uppercase"
                style={{
                  color: 'rgba(255,255,255,0.34)',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                Shroom Entry
              </span>
            </div>

            <div
              className="rounded-full px-4 py-2 text-xs tracking-[0.22em] uppercase"
              style={{
                color: 'rgba(255,255,255,0.72)',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.08)',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              {stageLabel}
            </div>
          </div>

          <div className="max-w-2xl">
            <span
              className="mb-5 block text-xs tracking-[0.3em] uppercase"
              style={{
                color: 'rgba(255,255,255,0.32)',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              Loading Mushroom / Particle Mushroom / Bed Impact / SOS
            </span>

            <h2
              className="max-w-3xl text-4xl font-bold leading-tight md:text-5xl lg:text-6xl"
              style={{
                color: '#ffffff',
                fontFamily: "'Space Grotesk', sans-serif",
                letterSpacing: '-0.04em',
              }}
            >
              Start from a centered Shroom, then dissolve into particles, strike the bed, and lift an SOS cloud.
            </h2>

            <p
              className="mt-6 max-w-2xl text-base leading-7 md:text-lg"
              style={{ color: 'rgba(255,255,255,0.6)' }}
            >
              This route now opens with a single mushroom sitting in the center like a loading core. Once the
              assets are ready, the solid form dissolves into a mushroom particle cloud. Scroll once and the
              cloud animates directly into a tilted bed. Scroll once again and the bed gets struck three times
              at the same point. Only after the third hit does a small SOS notification-style popup lift into
              view.
            </p>

            <div
              className="mt-8 max-w-2xl rounded-[30px] px-5 py-5 pointer-events-auto"
              style={{
                background: 'rgba(6, 12, 28, 0.68)',
                border: '1px solid rgba(125,211,252,0.14)',
                backdropFilter: 'blur(18px)',
              }}
            >
              <div
                className="mb-4 text-xs tracking-[0.28em] uppercase"
                style={{
                  color: 'rgba(255,255,255,0.36)',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                Bed Controls
              </div>

              <div className="grid gap-4">
                <label className="block">
                  <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.24em]">
                    <span style={{ color: 'rgba(255,255,255,0.56)', fontFamily: "'JetBrains Mono', monospace" }}>
                      Tilt X
                    </span>
                    <span style={{ color: '#7dd3fc', fontFamily: "'JetBrains Mono', monospace" }}>
                      {bedControls.rotationXDeg.toFixed(0)} deg
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-360"
                    max="360"
                    step="1"
                    value={bedControls.rotationXDeg}
                    onChange={updateBedControl('rotationXDeg')}
                    className="w-full accent-cyan-300"
                  />
                </label>

                <label className="block">
                  <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.24em]">
                    <span style={{ color: 'rgba(255,255,255,0.56)', fontFamily: "'JetBrains Mono', monospace" }}>
                      Tilt Y
                    </span>
                    <span style={{ color: '#7dd3fc', fontFamily: "'JetBrains Mono', monospace" }}>
                      {bedControls.rotationYDeg.toFixed(0)} deg
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-360"
                    max="360"
                    step="1"
                    value={bedControls.rotationYDeg}
                    onChange={updateBedControl('rotationYDeg')}
                    className="w-full accent-cyan-300"
                  />
                </label>

                <label className="block">
                  <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.24em]">
                    <span style={{ color: 'rgba(255,255,255,0.56)', fontFamily: "'JetBrains Mono', monospace" }}>
                      Tilt Z
                    </span>
                    <span style={{ color: '#7dd3fc', fontFamily: "'JetBrains Mono', monospace" }}>
                      {bedControls.rotationZDeg.toFixed(0)} deg
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-360"
                    max="360"
                    step="1"
                    value={bedControls.rotationZDeg}
                    onChange={updateBedControl('rotationZDeg')}
                    className="w-full accent-cyan-300"
                  />
                </label>

                <label className="block">
                  <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.24em]">
                    <span style={{ color: 'rgba(255,255,255,0.56)', fontFamily: "'JetBrains Mono', monospace" }}>
                      Position X
                    </span>
                    <span style={{ color: '#7dd3fc', fontFamily: "'JetBrains Mono', monospace" }}>
                      {bedControls.offsetX.toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.4"
                    max="1.9"
                    step="0.01"
                    value={bedControls.offsetX}
                    onChange={updateBedControl('offsetX')}
                    className="w-full accent-cyan-300"
                  />
                </label>

                <label className="block">
                  <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.24em]">
                    <span style={{ color: 'rgba(255,255,255,0.56)', fontFamily: "'JetBrains Mono', monospace" }}>
                      Position Y
                    </span>
                    <span style={{ color: '#7dd3fc', fontFamily: "'JetBrains Mono', monospace" }}>
                      {bedControls.offsetY.toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-0.9"
                    max="0.9"
                    step="0.01"
                    value={bedControls.offsetY}
                    onChange={updateBedControl('offsetY')}
                    className="w-full accent-cyan-300"
                  />
                </label>

                <label className="block">
                  <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.24em]">
                    <span style={{ color: 'rgba(255,255,255,0.56)', fontFamily: "'JetBrains Mono', monospace" }}>
                      Position Z
                    </span>
                    <span style={{ color: '#7dd3fc', fontFamily: "'JetBrains Mono', monospace" }}>
                      {bedControls.offsetZ.toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-1.2"
                    max="1.2"
                    step="0.01"
                    value={bedControls.offsetZ}
                    onChange={updateBedControl('offsetZ')}
                    className="w-full accent-cyan-300"
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div
              className="max-w-xl rounded-[28px] px-5 py-4"
              style={{
                color: loadError ? '#fca5a5' : 'rgba(255,255,255,0.68)',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                backdropFilter: 'blur(18px)',
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
                Wheel 1: Bed / Wheel 2: 3 Impacts + SOS
              </div>
            </div>
          </div>
      </div>
    </section>
  );
}
