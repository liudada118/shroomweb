import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js';

const HUMAN_MODEL_URL = new URL('../../../../model/jiqirenGggg.fbx', import.meta.url).href;

const PARTICLE_COUNT = 9000;
const PARTICLE_FOLLOW_STRENGTH = 0.055;

type ModelSpec = {
  label: string;
  url: string;
  loader: 'gltf' | 'fbx';
  colorA: string;
  colorB: string;
  targetSize: number;
};

type ParticleTarget = {
  positions: Float32Array;
  colors: Float32Array;
};

const HUMAN_MODEL: ModelSpec = {
  label: 'Human Particle Source',
  url: HUMAN_MODEL_URL,
  loader: 'fbx',
  colorA: '#67e8f9',
  colorB: '#f8fafc',
  targetSize: 5.2,
};

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

  const gradient = context.createRadialGradient(64, 64, 3, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.22, 'rgba(255,255,255,0.95)');
  gradient.addColorStop(0.58, 'rgba(255,255,255,0.32)');
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
    positions[stride + 1] = (Math.random() - 0.5) * radius * 1.35;
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
    opacity: 0.45,
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
  wrapper.scale.setScalar(targetSize / maxDimension);

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

function sampleParticleTarget(root: THREE.Object3D, spec: ModelSpec): ParticleTarget {
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
  const colorA = new THREE.Color(spec.colorA);
  const colorB = new THREE.Color(spec.colorB);
  let cursor = 0;

  normalizedRoot.updateMatrixWorld(true);

  meshes.forEach((mesh, meshIndex) => {
    mesh.updateWorldMatrix(true, false);
    const sampler = new MeshSurfaceSampler(mesh).build();

    for (let index = 0; index < counts[meshIndex]; index += 1) {
      sampler.sample(point, normal);
      mesh.localToWorld(point);
      normal.transformDirection(mesh.matrixWorld).normalize();
      point.addScaledVector(normal, (Math.random() - 0.5) * 0.02);

      const stride = cursor * 3;
      positions[stride] = point.x;
      positions[stride + 1] = point.y;
      positions[stride + 2] = point.z;

      const verticalMix = THREE.MathUtils.clamp((point.y + spec.targetSize * 0.5) / spec.targetSize, 0, 1);
      const color = colorA.clone().lerp(colorB, verticalMix * 0.7 + Math.random() * 0.3);
      colors[stride] = color.r;
      colors[stride + 1] = color.g;
      colors[stride + 2] = color.b;

      cursor += 1;
    }
  });

  return { positions, colors };
}

function loadModel(spec: ModelSpec, gltfLoader: GLTFLoader, fbxLoader: FBXLoader) {
  return new Promise<THREE.Object3D>((resolve, reject) => {
    if (spec.loader === 'gltf') {
      gltfLoader.load(spec.url, (result) => resolve(result.scene), undefined, reject);
      return;
    }

    fbxLoader.load(spec.url, resolve, undefined, reject);
  });
}

export default function ParticleMorphSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const canvasRoot = canvasRef.current;
    if (!section || !canvasRoot) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050814);
    scene.fog = new THREE.Fog(0x050814, 11, 28);

    const camera = new THREE.PerspectiveCamera(36, canvasRoot.clientWidth / canvasRoot.clientHeight, 0.1, 80);
    camera.position.set(0, 1.1, 8.2);

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
    let target: ParticleTarget | null = null;

    const backgroundGroup = new THREE.Group();
    const cloudA = createBackgroundPoints(particleTexture, 950, 11, '#67e8f9', '#f8fafc', 0.1);
    const cloudB = createBackgroundPoints(particleTexture, 760, 13, '#38bdf8', '#a78bfa', 0.085);
    cloudA.position.set(-1.8, 0.2, -5.2);
    cloudB.position.set(1.8, -0.1, -6.4);
    backgroundGroup.add(cloudA, cloudB);
    scene.add(backgroundGroup);

    const livePositions = new Float32Array(PARTICLE_COUNT * 3);
    const renderPositions = new Float32Array(PARTICLE_COUNT * 3);
    const liveColors = new Float32Array(PARTICLE_COUNT * 3);
    const noiseSeeds = Float32Array.from(
      Array.from({ length: PARTICLE_COUNT }, () => Math.random() * Math.PI * 2),
    );

    for (let index = 0; index < PARTICLE_COUNT; index += 1) {
      const stride = index * 3;
      const radius = 5.6 + Math.random() * 2.4;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);

      livePositions[stride] = Math.sin(phi) * Math.cos(theta) * radius;
      livePositions[stride + 1] = Math.cos(phi) * radius * 0.8;
      livePositions[stride + 2] = Math.sin(phi) * Math.sin(theta) * radius;
      renderPositions[stride] = livePositions[stride];
      renderPositions[stride + 1] = livePositions[stride + 1];
      renderPositions[stride + 2] = livePositions[stride + 2];
      liveColors[stride] = 0.45;
      liveColors[stride + 1] = 0.92;
      liveColors[stride + 2] = 1;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(renderPositions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(liveColors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.076,
      map: particleTexture,
      transparent: true,
      opacity: 0.96,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });

    const humanPoints = new THREE.Points(geometry, material);
    humanPoints.rotation.x = -0.12;
    scene.add(humanPoints);

    const rimLight = new THREE.PointLight(0x67e8f9, 4.8, 22, 2);
    rimLight.position.set(-3.4, 2.6, 5.2);
    scene.add(rimLight);

    const accentLight = new THREE.PointLight(0xa78bfa, 3.2, 18, 2);
    accentLight.position.set(3.1, -0.6, 4.4);
    scene.add(accentLight);

    const ambient = new THREE.AmbientLight(0xffffff, 0.2);
    scene.add(ambient);

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

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerleave', onPointerLeave);
    window.addEventListener('resize', onResize);

    const loadHumanParticles = async () => {
      try {
        const modelRoot = await loadModel(HUMAN_MODEL, gltfLoader, fbxLoader);
        const sampledTarget = sampleParticleTarget(modelRoot, HUMAN_MODEL);

        if (disposed) return;

        target = sampledTarget;
        setLoading(false);
      } catch (error) {
        console.error(error);
        if (!disposed) {
          setLoadError('Failed to load the human particle model.');
          setLoading(false);
        }
      }
    };

    loadHumanParticles();

    const animate = () => {
      animationFrame = requestAnimationFrame(animate);

      const delta = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.elapsedTime;
      pointer.lerp(pointerTarget, 0.08);

      const targetCameraX = pointer.x * 0.26;
      const targetCameraY = 1.1 + pointer.y * 0.22;
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetCameraX, 0.045);
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetCameraY, 0.045);
      camera.lookAt(pointer.x * 0.12, 0.08 + pointer.y * 0.05, 0);

      backgroundGroup.rotation.y += delta * 0.045;
      cloudA.rotation.x -= delta * 0.028;
      cloudB.rotation.y += delta * 0.042;
      cloudA.position.y = 0.2 + Math.sin(elapsed * 0.32) * 0.1;
      cloudB.position.y = -0.1 + Math.cos(elapsed * 0.36) * 0.08;

      humanPoints.rotation.y = Math.sin(elapsed * 0.2) * 0.08 + pointer.x * 0.04;
      humanPoints.rotation.x = -0.12 + pointer.y * 0.03;

      if (visibleRef.current && target) {
        const followStrength = PARTICLE_FOLLOW_STRENGTH + Math.abs(pointer.y) * 0.006;

        for (let index = 0; index < livePositions.length; index += 3) {
          const pointIndex = index / 3;
          livePositions[index] = THREE.MathUtils.lerp(livePositions[index], target.positions[index], followStrength);
          livePositions[index + 1] = THREE.MathUtils.lerp(
            livePositions[index + 1],
            target.positions[index + 1],
            followStrength,
          );
          livePositions[index + 2] = THREE.MathUtils.lerp(
            livePositions[index + 2],
            target.positions[index + 2],
            followStrength,
          );

          renderPositions[index] = livePositions[index] + Math.sin(elapsed * 1.2 + noiseSeeds[pointIndex]) * 0.014;
          renderPositions[index + 1] =
            livePositions[index + 1] + Math.cos(elapsed * 1.5 + noiseSeeds[pointIndex] * 1.17) * 0.011;
          renderPositions[index + 2] =
            livePositions[index + 2] + Math.sin(elapsed * 1.03 + noiseSeeds[pointIndex] * 0.92) * 0.014;

          liveColors[index] = THREE.MathUtils.lerp(liveColors[index], target.colors[index], 0.09);
          liveColors[index + 1] = THREE.MathUtils.lerp(liveColors[index + 1], target.colors[index + 1], 0.09);
          liveColors[index + 2] = THREE.MathUtils.lerp(liveColors[index + 2], target.colors[index + 2], 0.09);
        }

        material.size = 0.074 + Math.sin(elapsed * (2.1 + Math.abs(pointer.y) * 0.55)) * 0.004;
        geometry.attributes.position.needsUpdate = true;
        geometry.attributes.color.needsUpdate = true;
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
      cancelAnimationFrame(animationFrame);

      backgroundGroup.traverse((object) => {
        const points = object as THREE.Points;
        const pointGeometry = points.geometry as THREE.BufferGeometry | undefined;
        const pointMaterial = points.material as THREE.Material | THREE.Material[] | undefined;

        pointGeometry?.dispose();

        if (Array.isArray(pointMaterial)) {
          pointMaterial.forEach((item) => item.dispose());
        } else {
          pointMaterial?.dispose();
        }
      });

      geometry.dispose();
      material.dispose();
      particleTexture.dispose();
      renderer.dispose();

      if (renderer.domElement.parentElement === canvasRoot) {
        canvasRoot.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative h-screen min-h-[640px] overflow-hidden"
      style={{ background: '#050814' }}
    >
      <div ref={canvasRef} className="absolute inset-0" />

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 42%, rgba(103,232,249,0.12) 0%, rgba(5,8,20,0.08) 38%, rgba(5,8,20,0.82) 100%)',
        }}
      />

      {(loading || loadError) && (
        <div
          className="absolute bottom-6 right-6 rounded-full px-4 py-2 text-xs"
          style={{
            color: loadError ? '#fca5a5' : 'rgba(255,255,255,0.62)',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          {loadError ?? 'Sampling human particle model...'}
        </div>
      )}
    </section>
  );
}
