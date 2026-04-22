/**
 * SensorScene.tsx — Three.js 3D 纤维传感器主舞台（v4）
 *
 * 6 屏叙事：
 *   01 纱线：银+黑双纱线从两侧拉入 → 双螺旋缠绕
 *   02 构网：纱线逐根铺出 32×32 编织网格
 *   03 加工：半透明纤维层覆合到网格上
 *   04 成型：完整柔性传感层成型
 *   05 受压：局部下陷 + 导电路径变亮
 *   06 读出：产品留下方，上方生长出 3D 压力热图粒子点云
 *            （类似 hand.jsx：32×32 粒子网格，插值+高斯模糊+jet色图+高度映射）
 *
 * 背景：#0a0e1a 深黑
 */
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { SENSOR_FRAMES } from './sensorData';

const FABRIC_TEXTURE_URL = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663332343321/eJoLX2GNEf9n3kDr6f2Q7X/fabric-seamless_a76b7c95.jpg';
const LOGO_DECAL_URL = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663332343321/eJoLX2GNEf9n3kDr6f2Q7X/jq-logo-transparent_84abe49c.png';

interface SensorSceneProps {
  scrollProgress: number;
}

/* ── helpers ── */
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function smoothstep(lo: number, hi: number, x: number) {
  const t = Math.max(0, Math.min(1, (x - lo) / (hi - lo)));
  return t * t * (3 - 2 * t);
}
function clamp01(x: number) { return Math.max(0, Math.min(1, x)); }

/* ── Jet 色图（蓝→青→绿→黄→红） ── */
function jet(min: number, max: number, value: number): [number, number, number] {
  if (value <= min) return [0, 0, 128];
  if (value >= max) return [128, 0, 0];
  const t = (value - min) / (max - min); // 0~1
  let r = 0, g = 0, b = 0;
  if (t < 0.125) {
    r = 0; g = 0; b = 128 + t / 0.125 * 127;
  } else if (t < 0.375) {
    r = 0; g = ((t - 0.125) / 0.25) * 255; b = 255;
  } else if (t < 0.625) {
    r = ((t - 0.375) / 0.25) * 255; g = 255; b = 255 - ((t - 0.375) / 0.25) * 255;
  } else if (t < 0.875) {
    r = 255; g = 255 - ((t - 0.625) / 0.25) * 255; b = 0;
  } else {
    r = 255 - ((t - 0.875) / 0.125) * 127; g = 0; b = 0;
  }
  return [Math.round(r), Math.round(g), Math.round(b)];
}

/* ── 双线性插值（32→64） ── */
function bilinearInterp(src: Float32Array, srcW: number, srcH: number, dstW: number, dstH: number): Float32Array {
  const dst = new Float32Array(dstW * dstH);
  for (let y = 0; y < dstH; y++) {
    for (let x = 0; x < dstW; x++) {
      const sx = (x / (dstW - 1)) * (srcW - 1);
      const sy = (y / (dstH - 1)) * (srcH - 1);
      const x0 = Math.floor(sx), y0 = Math.floor(sy);
      const x1 = Math.min(x0 + 1, srcW - 1), y1 = Math.min(y0 + 1, srcH - 1);
      const fx = sx - x0, fy = sy - y0;
      const v00 = src[y0 * srcW + x0];
      const v10 = src[y0 * srcW + x1];
      const v01 = src[y1 * srcW + x0];
      const v11 = src[y1 * srcW + x1];
      dst[y * dstW + x] = v00 * (1 - fx) * (1 - fy) + v10 * fx * (1 - fy) + v01 * (1 - fx) * fy + v11 * fx * fy;
    }
  }
  return dst;
}

/* ── 高斯模糊（简单 5×5 核） ── */
function gaussBlur(src: Float32Array, w: number, h: number, sigma: number): Float32Array {
  const dst = new Float32Array(w * h);
  const r = Math.ceil(sigma * 2);
  const kernel: number[] = [];
  let sum = 0;
  for (let i = -r; i <= r; i++) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma));
    kernel.push(v);
    sum += v;
  }
  for (let i = 0; i < kernel.length; i++) kernel[i] /= sum;

  // 水平 pass
  const tmp = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let val = 0;
      for (let k = -r; k <= r; k++) {
        const sx = Math.max(0, Math.min(w - 1, x + k));
        val += src[y * w + sx] * kernel[k + r];
      }
      tmp[y * w + x] = val;
    }
  }
  // 垂直 pass
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let val = 0;
      for (let k = -r; k <= r; k++) {
        const sy = Math.max(0, Math.min(h - 1, y + k));
        val += tmp[sy * w + x] * kernel[k + r];
      }
      dst[y * w + x] = val;
    }
  }
  return dst;
}

/* ── Scene state type ── */
interface SceneState {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  // 01 纱线
  fiberA: THREE.Mesh;
  fiberB: THREE.Mesh;
  helixA: THREE.Mesh;
  helixB: THREE.Mesh;
  // 02 构网
  warpFibers: THREE.Mesh[];
  weftFibers: THREE.Mesh[];
  // 03 加工
  sensingLayer: THREE.Mesh;
  // 04 成型
  productSheet: THREE.Mesh;
  productLogo: THREE.Mesh;
  productDispTex: THREE.DataTexture;
  // 05 受压 — 压力热图叠加层
  pressureOverlay: THREE.Mesh;
  pressureCtx: CanvasRenderingContext2D;
  pressureCanvasTex: THREE.CanvasTexture;
  // 05 受压
  pressHead: THREE.Mesh;
  glowRings: THREE.Mesh[];
  // 06 读出 — 3D 压力热图粒子点云
  heatmapPoints: THREE.Points;
  heatmapPositions: Float32Array;
  heatmapColors: Float32Array;
  heatmapRawData: Float32Array;    // 32×32 原始压力数据
  heatmapSmooth: Float32Array;     // 平滑后的数据（用于柔化过渡）
  heatmapGridW: number;
  heatmapGridH: number;
  heatmapFrameIdx: number;   // 当前播放帧索引（浮点，用于插值）
  heatmapFrameTimer: number; // 帧计时器
  // lights
  ambientLight: THREE.AmbientLight;
  mainLight: THREE.DirectionalLight;
  scanLight: THREE.PointLight;
  // animation
  frameId: number;
  displayProgress: number;
  time: number;
}

/* ── 01 纱线：创建一根有微纹理的纱线 ── */
function createFiber(color: number, radius: number, length: number): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(radius, radius, length, 16, 64);
  geo.rotateZ(Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.55,
    metalness: 0.3,
    emissive: new THREE.Color(color).multiplyScalar(0.05),
    transparent: true,
    opacity: 1,
  });
  return new THREE.Mesh(geo, mat);
}

/* ── 01 纱线：创建缠绕双螺旋纱线组 ── */
function createHelixFiber(color: number, radius: number, helixRadius: number, turns: number, length: number, segments: number): THREE.Mesh {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const x = (t - 0.5) * length;
    const angle = t * turns * Math.PI * 2;
    const y = Math.sin(angle) * helixRadius;
    const z = Math.cos(angle) * helixRadius;
    points.push(new THREE.Vector3(x, y, z));
  }
  const curve = new THREE.CatmullRomCurve3(points);
  const geo = new THREE.TubeGeometry(curve, segments * 2, radius, 12, false);
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.55,
    metalness: 0.3,
    emissive: new THREE.Color(color).multiplyScalar(0.05),
    transparent: true,
    opacity: 1,
  });
  return new THREE.Mesh(geo, mat);
}

/* ── 02 构网：创建编织网格纤维 ── */
function createGridFibers(count: number, spacing: number, fiberRadius: number, length: number, isWarp: boolean) {
  const fibers: THREE.Mesh[] = [];
  const halfSpan = (count - 1) * spacing / 2;
  for (let i = 0; i < count; i++) {
    const geo = new THREE.CylinderGeometry(fiberRadius, fiberRadius, length, 8, 32);
    if (isWarp) {
      geo.rotateZ(Math.PI / 2);
    } else {
      geo.rotateX(Math.PI / 2);
    }
    const brightness = 0.65 + Math.random() * 0.15;
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(brightness, brightness, brightness * 0.98),
      roughness: 0.6,
      metalness: 0.2,
      transparent: true,
      opacity: 0,
    });
    const mesh = new THREE.Mesh(geo, mat);
    if (isWarp) {
      mesh.position.z = -halfSpan + i * spacing;
      mesh.position.y = i % 2 === 0 ? 0.015 : -0.015;
    } else {
      mesh.position.x = -halfSpan + i * spacing;
      mesh.position.y = i % 2 === 0 ? -0.015 : 0.015;
    }
    mesh.visible = false;
    fibers.push(mesh);
  }
  return fibers;
}

/* ── 03 加工：半透明非织造传感层 ── */
function createSensingLayer(size: number): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(size, size, 64, 64);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xe8e0d8,
    roughness: 0.7,
    metalness: 0.05,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    emissive: 0xfaf5ef,
    emissiveIntensity: 0.08,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0.06;
  mesh.visible = false;
  return mesh;
}

/* ── 04 成型：完整柔性传感层 ── */
function createProductSheet(size: number): { mesh: THREE.Mesh; dispTex: THREE.DataTexture } {
  const geo = new THREE.PlaneGeometry(size, size, 128, 128);
  geo.rotateX(-Math.PI / 2);
  // 创建 displacement map 纹理（64×64，单通道灰度）
  const DISP_SIZE = 64;
  const dispData = new Uint8Array(DISP_SIZE * DISP_SIZE);
  const dispTex = new THREE.DataTexture(dispData, DISP_SIZE, DISP_SIZE, THREE.RedFormat);
  dispTex.magFilter = THREE.LinearFilter;
  dispTex.minFilter = THREE.LinearFilter;
  dispTex.needsUpdate = true;
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.5,
    metalness: 0.1,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    // bumpMap 已移除，改用 pressureOverlay 叠加层
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0.08;
  mesh.visible = false;
  return { mesh, dispTex };
}

function createProductLogo(size: number): THREE.Mesh {
  const logoAspect = 2048 / 612;
  const logoWidth = size * 0.34;
  const logoHeight = logoWidth / logoAspect;
  const geo = new THREE.PlaneGeometry(logoWidth, logoHeight);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, 0.086, 0);
  mesh.visible = false;
  mesh.renderOrder = 10;
  return mesh;
}

/* ── 05 受压：压力热图叠加层 ── */
function createPressureOverlay(size: number): {
  mesh: THREE.Mesh;
  ctx: CanvasRenderingContext2D;
  canvasTex: THREE.CanvasTexture;
} {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'rgba(0,0,0,0)';
  ctx.fillRect(0, 0, 256, 256);
  const canvasTex = new THREE.CanvasTexture(canvas);
  canvasTex.minFilter = THREE.LinearFilter;
  canvasTex.magFilter = THREE.LinearFilter;
  const geo = new THREE.PlaneGeometry(size, size);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    map: canvasTex,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0.12; // 略高于 productSheet (0.08)
  mesh.visible = false;
  return { mesh, ctx, canvasTex };
}

/* ── 05 受压：压头 ── */
function createPressHead(): THREE.Mesh {
  const geo = new THREE.SphereGeometry(0.3, 32, 32, 0, Math.PI * 2, 0, Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x8899aa,
    roughness: 0.3,
    metalness: 0.6,
    transparent: true,
    opacity: 0,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0.3, 2.5, 0.2);
  mesh.rotation.x = Math.PI;
  mesh.visible = false;
  return mesh;
}

/* ── 05 受压：扩散光环 ── */
function createGlowRings(count: number): THREE.Mesh[] {
  const rings: THREE.Mesh[] = [];
  for (let i = 0; i < count; i++) {
    const r = 0.15 + i * 0.25;
    const geo = new THREE.RingGeometry(r, r + 0.02, 48);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0.3, 0.12, 0.2);
    mesh.visible = false;
    rings.push(mesh);
  }
  return rings;
}

/* ── 06 读出：3D 压力热图粒子点云（类似 hand.jsx） ── */
const HEATMAP_SRC = 32;  // 原始传感器分辨率 (32×32)
const HEATMAP_INTERP = 2; // 插值倍率
const HEATMAP_W = HEATMAP_SRC * HEATMAP_INTERP; // 64
const HEATMAP_H = HEATMAP_SRC * HEATMAP_INTERP; // 64
// 热图与布料等比例大小: productSheet = gridLength * 0.95 = 4.123
const HEATMAP_SIZE = 4.123; // 与布料尺寸一致
const HEATMAP_CENTER_X = 0;
const HEATMAP_CENTER_Z = 0;
const HEATMAP_SEPARATION = HEATMAP_SIZE / HEATMAP_W; // 粒子间距 ≈ 0.064

function createHeatmapPoints(): {
  points: THREE.Points;
  positions: Float32Array;
  colors: Float32Array;
} {
  const count = HEATMAP_W * HEATMAP_H;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  let idx = 0;
  for (let ix = 0; ix < HEATMAP_W; ix++) {
    for (let iy = 0; iy < HEATMAP_H; iy++) {
      positions[idx] = ix * HEATMAP_SEPARATION - HEATMAP_SIZE / 2 + HEATMAP_CENTER_X;
      positions[idx + 1] = 0;
      positions[idx + 2] = iy * HEATMAP_SEPARATION - HEATMAP_SIZE / 2 + HEATMAP_CENTER_Z;
      // 初始颜色：深蓝
      colors[idx] = 0;
      colors[idx + 1] = 0;
      colors[idx + 2] = 0.5;
      idx += 3;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.PointsMaterial({
    size: 0.12,
    vertexColors: true,
    transparent: true,
    opacity: 0,
    sizeAttenuation: true,
    depthWrite: false,
  });

  const points = new THREE.Points(geo, mat);
  points.visible = false;
  points.renderOrder = 999; // 确保粒子在最上层渲染
  return { points, positions, colors };
}


/* ── Update function: driven by displayProgress ── */
function updateScene(s: SceneState, rawProgress: number, dt: number) {
  // 原则 7：滚动缓冲
  s.displayProgress += (rawProgress - s.displayProgress) * 0.12;
  const p = s.displayProgress;
  s.time += dt;

  // ═══════════════════════════════════════════
  // 01 纱线 (p: 0 ~ 0.167)
  // ═══════════════════════════════════════════
  const s1 = smoothstep(0, 0.167, p);

  const entryT = clamp01(s1 * 2);
  const twistT = clamp01((s1 - 0.5) * 2);

  const fiberAMat = s.fiberA.material as THREE.MeshStandardMaterial;
  const fiberBMat_s1 = s.fiberB.material as THREE.MeshStandardMaterial;
  const helixAMat = s.helixA.material as THREE.MeshStandardMaterial;
  const helixBMat = s.helixB.material as THREE.MeshStandardMaterial;

  if (twistT < 0.01) {
    s.fiberA.visible = true;
    s.fiberB.visible = true;
    s.helixA.visible = false;
    s.helixB.visible = false;
    s.fiberA.position.x = lerp(-6, 0, clamp01(entryT * 1.2));
    s.fiberA.position.z = 0.04;
    s.fiberA.rotation.y = lerp(0.1, 0, entryT);
    fiberAMat.opacity = 1;
    s.fiberB.position.x = lerp(6, 0, clamp01(entryT * 1.2));
    s.fiberB.position.z = -0.04;
    s.fiberB.rotation.y = lerp(-0.1, 0, entryT);
    fiberBMat_s1.opacity = 1;
  } else {
    s.fiberA.visible = twistT < 0.3;
    s.fiberB.visible = twistT < 0.3;
    fiberAMat.opacity = lerp(1, 0, clamp01(twistT * 4));
    fiberBMat_s1.opacity = lerp(1, 0, clamp01(twistT * 4));
    s.helixA.visible = true;
    s.helixB.visible = true;
    helixAMat.opacity = clamp01(twistT * 3);
    helixBMat.opacity = clamp01(twistT * 3);
  }

  const scanPos = lerp(-4, 4, clamp01(s1 * 2 - 0.3));
  s.scanLight.position.set(scanPos, 0.5, 0.8);
  s.scanLight.intensity = s1 > 0.2 && s1 < 0.9 ? 2.5 : 0;

  // ═══════════════════════════════════════════
  // 02 构网 (p: 0.167 ~ 0.333)
  // ═══════════════════════════════════════════
  const s2 = smoothstep(0.167, 0.333, p);

  const helixFade = smoothstep(0.167, 0.25, p);
  if (helixFade > 0.01) {
    s.helixA.visible = helixFade < 0.99;
    s.helixB.visible = helixFade < 0.99;
    helixAMat.opacity = lerp(1, 0, helixFade);
    helixBMat.opacity = lerp(1, 0, helixFade);
    s.fiberA.visible = false;
    s.fiberB.visible = false;
  }

  const warpStart = 0.20;
  const weftStart = 0.26;
  const gridCount = s.warpFibers.length;

  for (let i = 0; i < gridCount; i++) {
    const warpT = smoothstep(warpStart + i * 0.003, warpStart + i * 0.003 + 0.04, p);
    const warp = s.warpFibers[i];
    const warpMat = warp.material as THREE.MeshStandardMaterial;
    warp.visible = warpT > 0.01;
    warpMat.opacity = clamp01(warpT);
    warp.position.x = lerp(-4, 0, clamp01(warpT * 1.2));

    const weftT = smoothstep(weftStart + i * 0.003, weftStart + i * 0.003 + 0.04, p);
    const weft = s.weftFibers[i];
    const weftMat = weft.material as THREE.MeshStandardMaterial;
    weft.visible = weftT > 0.01;
    weftMat.opacity = clamp01(weftT);
    weft.position.z = lerp(4, 0, clamp01(weftT * 1.2));
  }

  if (s2 > 0.3) s.scanLight.intensity = 0;

  // ═══════════════════════════════════════════
  // 03 加工 (p: 0.333 ~ 0.5)
  // ═══════════════════════════════════════════
  const s3 = smoothstep(0.333, 0.5, p);

  const sensMat = s.sensingLayer.material as THREE.MeshStandardMaterial;
  s.sensingLayer.visible = s3 > 0.01;
  const sensScale = lerp(0.1, 1, clamp01(s3 * 1.3));
  s.sensingLayer.scale.set(sensScale, 1, sensScale);
  sensMat.opacity = lerp(0, 0.55, clamp01(s3 * 1.5));
  s.sensingLayer.position.y = lerp(0.5, 0.06, clamp01(s3 * 1.2));

  // ═══════════════════════════════════════════
  // 04 成型 (p: 0.5 ~ 0.667)
  // ═══════════════════════════════════════════
  const s4 = smoothstep(0.5, 0.667, p);

  const prodMat = s.productSheet.material as THREE.MeshStandardMaterial;
  const logoMat = s.productLogo.material as THREE.MeshBasicMaterial;
  s.productSheet.visible = s4 > 0.01;
  s.productLogo.visible = s4 > 0.01;
  prodMat.opacity = lerp(0, 1, clamp01(s4 * 2));
  logoMat.opacity = lerp(0, 0.92, clamp01(s4 * 2));

  const prodScale = lerp(1.08, 1.0, clamp01(s4 * 1.5));
  s.productSheet.scale.set(prodScale, 1, prodScale);
  s.productLogo.scale.set(prodScale, 1, prodScale);
  s.productLogo.position.x = s.productSheet.position.x;
  s.productLogo.position.z = s.productSheet.position.z;
  s.productLogo.position.y = s.productSheet.position.y + 0.006;

  if (s4 > 0.3 && s4 < 0.9) {
    s.scanLight.intensity = 1.5;
    const scanX = lerp(-3, 3, (s4 - 0.3) / 0.6);
    s.scanLight.position.set(scanX, 1.0, 1.5);
  } else if (s4 >= 0.9) {
    s.scanLight.intensity = 0;
  }

  if (s4 > 0.5) {
    const breathe = Math.sin(s.time * 1.5) * 0.01 * s4;
    s.productSheet.position.y = 0.08 + breathe;
    s.productLogo.position.y = s.productSheet.position.y + 0.006;
  }

  if (s4 > 0.3) {
    sensMat.opacity = lerp(sensMat.opacity, 0.15, (s4 - 0.3) * 0.5);
  }

  if (s4 > 0.5) {
    const gridFade = (s4 - 0.5) * 4;
    for (const f of s.warpFibers) {
      (f.material as THREE.MeshStandardMaterial).opacity = Math.max(0, 1 - gridFade);
    }
    for (const f of s.weftFibers) {
      (f.material as THREE.MeshStandardMaterial).opacity = Math.max(0, 1 - gridFade);
    }
  }

  // ═══════════════════════════════════════════
  // 05 受压 (p: 0.667 ~ 0.833)
  // 数据驱动局部形变：用 SENSOR_FRAMES 驱动 productSheet 和 sensingLayer 顶点下陷
  // ═══════════════════════════════════════════
  s.pressHead.visible = false;
  for (const ring of s.glowRings) { ring.visible = false; }

  const s5 = smoothstep(0.667, 0.833, p);

  // ── 可调参数 ──
  const PRESS_DEPTH = -5.0;          // bumpScale 强度（负值=凹陷）
  const PRESS_FRAME_INTERVAL = 0.4;  // 受压帧播放间隔（秒）
  const DEFORM_BLUR_RADIUS = 8.0;    // 形变数据高斯模糊半径（大半径避免裂缝）

  // 第5屏时隐藏 sensingLayer，只保留 productSheet 的形变
  if (s5 > 0.01) {
    sensMat.opacity = lerp(0.55, 0, clamp01(s5 * 3));
    if (s5 > 0.3) s.sensingLayer.visible = false;
  }

  // pressureOverlay 叠加层
  const overlayFade = p > 0.85 ? 1 - clamp01((p - 0.85) / 0.05) : 1; // 第6屏快速淡出
  s.pressureOverlay.visible = s5 > 0.01 && overlayFade > 0.01;

  if (s5 > 0.01) {
    // 帧播放
    s.heatmapFrameTimer += dt;
    if (s.heatmapFrameTimer >= PRESS_FRAME_INTERVAL) {
      s.heatmapFrameTimer -= PRESS_FRAME_INTERVAL;
      s.heatmapFrameIdx = (s.heatmapFrameIdx + 1) % SENSOR_FRAMES.length;
    }

    const curIdx = s.heatmapFrameIdx % SENSOR_FRAMES.length;
    const nextIdx = (curIdx + 1) % SENSOR_FRAMES.length;
    const lf = s.heatmapFrameTimer / PRESS_FRAME_INTERVAL;
    const curFrame = SENSOR_FRAMES[curIdx];
    const nextFrame = SENSOR_FRAMES[nextIdx];

    // 32×32 插值
    const raw32 = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      raw32[i] = curFrame[i] + (nextFrame[i] - curFrame[i]) * lf;
    }

    // 在 canvas 上绘制压力热图
    const ctx = s.pressureCtx;
    const cw = 256, ch = 256;
    ctx.clearRect(0, 0, cw, ch);

    // 将 32×32 数据绘制为热图（每个传感器单元绘制一个圆形渐变）
    const cellW = cw / 32;
    const cellH = ch / 32;
    const fadeIn = clamp01(s5 * 2);

    for (let row = 0; row < 32; row++) {
      for (let col = 0; col < 32; col++) {
        const val = raw32[row * 32 + col];
        if (val < 3) continue;

        const norm = Math.min(1, val / 120);
        const rgb = jet(0, 120, val);
        // canvas 坐标：col → x，row → y（翻转行方向以匹配 UV）
        const cx = (col + 0.5) * cellW;
        const cy = (31 - row + 0.5) * cellH;
        const radius = cellW * 0.9; // 适中大小避免过度重叠

        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        gradient.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${0.45 * norm * fadeIn})`);
        gradient.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
        ctx.fillStyle = gradient;
        ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
      }
    }

    s.pressureCanvasTex.needsUpdate = true;
    const overlayMat = s.pressureOverlay.material as THREE.MeshBasicMaterial;
    overlayMat.opacity = 0.55 * fadeIn * overlayFade;

    // 受压时照亮受压区域
    s.scanLight.intensity = lerp(0, 3.0, clamp01(s5 * 2));
    s.scanLight.position.set(-1.29, 1.0, 1.55);
    s.scanLight.color.set(0xeef0ff);
  } else {
    s.scanLight.intensity = 0;
  }

  // ═══════════════════════════════════════════
  // 06 读出 (p: 0.833 ~ 1.0)
  // 3D 压力热图粒子点云（类似 hand.jsx）
  // ═══════════════════════════════════════════
  const s6 = smoothstep(0.833, 1.0, p);

  const hmMat = s.heatmapPoints.material as THREE.PointsMaterial;
  s.heatmapPoints.visible = s6 > 0.01;

  // 第6屏：产品保持可见，不再消失
  // 产品形变保持（第5屏的形变继续保留）

  if (s6 > 0.01) {
    // 粒子整体透明度
    hmMat.opacity = clamp01(s6 * 2.5);

    // 帧播放：复用第5屏已在播放的帧索引（第5屏和第6屏共享同一份数据）
    // 如果直接跳到第6屏（第5屏未播放），也要推进帧
    const FRAME_INTERVAL_S6 = 0.4; // 可调参数
    if (s5 < 0.01) {
      // 第5屏未进入时，第6屏自己推进帧
      s.heatmapFrameTimer += dt;
      if (s.heatmapFrameTimer >= FRAME_INTERVAL_S6) {
        s.heatmapFrameTimer -= FRAME_INTERVAL_S6;
        s.heatmapFrameIdx = (s.heatmapFrameIdx + 1) % SENSOR_FRAMES.length;
      }
    }

    const curIdx = s.heatmapFrameIdx % SENSOR_FRAMES.length;
    const nextIdx = (curIdx + 1) % SENSOR_FRAMES.length;
    const lerpFactor = s.heatmapFrameTimer / FRAME_INTERVAL_S6;
    const curFrame = SENSOR_FRAMES[curIdx];
    const nextFrame = SENSOR_FRAMES[nextIdx];

    // 将插值后的 32×32 数据写入 rawData
    const rawData = new Float32Array(HEATMAP_SRC * HEATMAP_SRC);
    for (let i = 0; i < 1024; i++) {
      rawData[i] = curFrame[i] + (nextFrame[i] - curFrame[i]) * lerpFactor;
    }

    // 双线性插值 32→64
    const interpData = bilinearInterp(rawData, HEATMAP_SRC, HEATMAP_SRC, HEATMAP_W, HEATMAP_H);

    // 高斯模糊平滑
    const blurredData = gaussBlur(interpData, HEATMAP_W, HEATMAP_H, 1.5);

    // 柔化过渡（smooth）
    const smoothFactor = 4;
    for (let i = 0; i < s.heatmapSmooth.length; i++) {
      s.heatmapSmooth[i] += (blurredData[i] - s.heatmapSmooth[i]) / smoothFactor;
    }

    // ── 可调参数 ──
    const maxPressure = 180;   // 保留颜色层次，同时避免高值把点云拉得过高
    const HEATMAP_HEIGHT_SCALE = 0.78;  // 收敛峰值高度，确保完整落入最终镜头
    const HEATMAP_BASE_Y = 0.16;       // 让点云更贴近产品表面
    const DATA_THRESHOLD = 15;         // 可调：低于此值的粒子不显示（过滤噪声）

    // 更新粒子位置和颜色
    // 粒子初始化顺序：先 ix(x方向/列)，再 iy(z方向/行)
    // 传感器数据顺序：先行(row)再列(col)，即 data[row * 32 + col]
    // 插值后数据顺序：先行再列，即 interpData[row * HEATMAP_W + col]
    let k = 0;
    for (let ix = 0; ix < HEATMAP_W; ix++) {
      for (let iy = 0; iy < HEATMAP_H; iy++) {
        // ix 对应 x 方向 = 列(col)，iy 对应 z 方向 = 行(row)
        // 数据索引：row=iy, col=ix
        const val = s.heatmapSmooth[iy * HEATMAP_W + ix];

        if (val > DATA_THRESHOLD) {
          // 有数据区域：显示粒子
          // Y 轴：基础高度 + 数据驱动的额外高度
          s.heatmapPositions[k + 1] = HEATMAP_BASE_Y * s6 + (val / maxPressure) * HEATMAP_HEIGHT_SCALE * s6;
          const rgb = jet(0, maxPressure, val);
          s.heatmapColors[k] = rgb[0] / 255;
          s.heatmapColors[k + 1] = rgb[1] / 255;
          s.heatmapColors[k + 2] = rgb[2] / 255;
        } else {
          // 无数据区域：粒子藏到视野外
          s.heatmapPositions[k + 1] = -10;
          s.heatmapColors[k] = 0;
          s.heatmapColors[k + 1] = 0;
          s.heatmapColors[k + 2] = 0;
        }

        k += 3;
      }
    }

    s.heatmapPoints.geometry.attributes.position.needsUpdate = true;
    s.heatmapPoints.geometry.attributes.color.needsUpdate = true;
  }

  // 热图粒子在产品上方（位置对齐产品表面）
  if (s6 > 0.01) {
    s.heatmapPoints.position.y = s.productSheet.position.y;
  }

  // ═══════════════════════════════════════════
  // 相机：一条慢弧线
  // ═══════════════════════════════════════════
  let cx = 0, cy = 0.3, cz = 3.5;
  let tx = 0, ty = 0, tz = 0;

  cx = 0; cy = 0.2; cz = 2.8;

  const c2 = smoothstep(0.12, 0.30, p);
  cx = lerp(cx, 0, c2);
  cy = lerp(cy, 1.8, c2);
  cz = lerp(cz, 3.5, c2);

  const c3 = smoothstep(0.30, 0.45, p);
  cx = lerp(cx, 0.3, c3);
  cy = lerp(cy, 2.5, c3);
  cz = lerp(cz, 3.8, c3);

  const c4 = smoothstep(0.45, 0.60, p);
  cx = lerp(cx, 0, c4);
  cy = lerp(cy, 3.0, c4);
  cz = lerp(cz, 3.0, c4);

  // 05: 推近受压区域
  // 数据集中在 rows 25-31, cols 2-10
  // 世界坐标中心：col 6/32*4.123-2.06 = -1.29, row 28/32*4.123-2.06 = 1.55
  const c5 = smoothstep(0.60, 0.78, p);
  cx = lerp(cx, -0.8, c5);   // 偏左，对准数据区域
  cy = lerp(cy, 2.2, c5);    // 稍微降低
  cz = lerp(cz, 3.5, c5);    // 推近
  tx = lerp(tx, -1.2, c5);   // 看向数据中心 x
  ty = lerp(ty, -0.05, c5);  // 看向产品表面
  tz = lerp(tz, 1.3, c5);    // 看向数据中心 z

  // 06: 俯视数据层，对准数据中心 (x=-1.29, z=1.55)
  const c6 = smoothstep(0.78, 0.95, p);
  cx = lerp(cx, -0.2, c6);   // 回到更接近全局中心的位置
  cy = lerp(cy, 3.45, c6);   // 稍微抬高，给点云顶部留足空间
  cz = lerp(cz, 4.7, c6);    // 拉远，避免整片点云被裁切
  tx = lerp(tx, -0.25, c6);  // 保留主压力区偏置，但不再只盯局部
  ty = lerp(ty, 0.55, c6);   // 视线抬到点云中层
  tz = lerp(tz, 0.45, c6);   // 同时把整张热图纳入视野

  s.camera.position.set(cx, cy, cz);
  s.camera.lookAt(tx, ty, tz);

  s.mainLight.position.set(cx + 2, cy + 3, cz + 1);
}

/* ── Main component ── */
export default function SensorScene({ scrollProgress }: SensorSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<SceneState | null>(null);
  const progressRef = useRef(0);

  progressRef.current = scrollProgress;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // ── Renderer ──
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x0a0e1a);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);

    // ── Scene & Camera ──
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0a0e1a, 8, 18);
    const camera = new THREE.PerspectiveCamera(40, container.clientWidth / container.clientHeight, 0.1, 50);
    camera.position.set(0, 0.2, 2.8);

    // ── Lights ──
    const ambientLight = new THREE.AmbientLight(0xc8c0d8, 0.4);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xf0eef5, 1.2);
    mainLight.position.set(3, 5, 4);
    scene.add(mainLight);

    const scanLight = new THREE.PointLight(0xffffff, 0, 3);
    scanLight.position.set(-4, 0.5, 0.8);
    scene.add(scanLight);

    const fillLight = new THREE.DirectionalLight(0x8899bb, 0.3);
    fillLight.position.set(-2, -1, 2);
    scene.add(fillLight);

    const textureLoader = new THREE.TextureLoader();

    // ── 01 纱线 ──
    const fiberA = createFiber(0xc8c4be, 0.025, 8);
    fiberA.position.set(-6, 0, 0.04);
    scene.add(fiberA);

    const fiberB = createFiber(0x3a3a3a, 0.025, 8);
    fiberB.position.set(6, 0, -0.04);
    scene.add(fiberB);

    const helixA = createHelixFiber(0xc8c4be, 0.025, 0.05, 10, 8, 400);
    helixA.visible = false;
    scene.add(helixA);

    const helixB = createHelixFiber(0x3a3a3a, 0.025, 0.05, 10, 8, 400);
    helixB.rotation.x = Math.PI;
    helixB.visible = false;
    scene.add(helixB);

    // ── 02 编织网格 ──
    const gridCount = 32;
    const gridSpacing = 0.12;
    const gridLength = gridCount * gridSpacing + 0.5;
    const warpFibers = createGridFibers(gridCount, gridSpacing, 0.012, gridLength, true);
    const weftFibers = createGridFibers(gridCount, gridSpacing, 0.012, gridLength, false);
    warpFibers.forEach(f => scene.add(f));
    weftFibers.forEach(f => scene.add(f));

    // ── 03 非织造传感层 ──
    const sensingLayer = createSensingLayer(gridLength * 0.95);
    scene.add(sensingLayer);

    // ── 04 产品层 ──
    const { mesh: productSheet, dispTex: productDispTex } = createProductSheet(gridLength * 0.95);
    scene.add(productSheet);
    const productLogo = createProductLogo(gridLength * 0.95);
    scene.add(productLogo);

    textureLoader.load(FABRIC_TEXTURE_URL, (tex) => {
      tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.colorSpace = THREE.SRGBColorSpace;
      (productSheet.material as THREE.MeshStandardMaterial).map = tex;
      (productSheet.material as THREE.MeshStandardMaterial).needsUpdate = true;
    });

    textureLoader.load(LOGO_DECAL_URL, (tex) => {
      tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.colorSpace = THREE.SRGBColorSpace;
      const logoMat = productLogo.material as THREE.MeshBasicMaterial;
      logoMat.map = tex;
      logoMat.needsUpdate = true;
    });

    // ── 05 压头 + 光环 + 压力热图叠加层 ──
    const pressHead = createPressHead();
    scene.add(pressHead);
    const glowRings = createGlowRings(4);
    glowRings.forEach(r => scene.add(r));
    const { mesh: pressureOverlay, ctx: pressureCtx, canvasTex: pressureCanvasTex } = createPressureOverlay(gridLength * 0.95);
    scene.add(pressureOverlay);

    // ── 06 3D 压力热图粒子点云 ──
    const { points: heatmapPoints, positions: heatmapPositions, colors: heatmapColors } = createHeatmapPoints();
    scene.add(heatmapPoints);

    const heatmapRawData = new Float32Array(HEATMAP_SRC * HEATMAP_SRC);
    const heatmapSmooth = new Float32Array(HEATMAP_W * HEATMAP_H);

    // ── State ──
    const state: SceneState = {
      renderer, scene, camera, fiberA, fiberB, helixA, helixB,
      warpFibers, weftFibers, sensingLayer, productSheet, productLogo, productDispTex,
      pressHead, glowRings,
      pressureOverlay, pressureCtx, pressureCanvasTex,
      heatmapPoints, heatmapPositions, heatmapColors,
      heatmapRawData, heatmapSmooth,
      heatmapGridW: HEATMAP_W, heatmapGridH: HEATMAP_H,
      heatmapFrameIdx: 0, heatmapFrameTimer: 0,
      ambientLight, mainLight, scanLight,
      frameId: 0, displayProgress: 0, time: 0,
    };
    stateRef.current = state;

    // ── Animation loop ──
    let lastTime = performance.now();
    function animate() {
      state.frameId = requestAnimationFrame(animate);
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      updateScene(state, progressRef.current, dt);
      renderer.render(scene, camera);
    }
    animate();

    // ── Resize ──
    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(state.frameId);
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full"
      style={{ background: '#0a0e1a' }}
    />
  );
}
