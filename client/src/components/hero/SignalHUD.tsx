/**
 * SignalHUD.tsx — 信号数据可视化层
 * 热图 + 波形曲线 + 实时数值
 * 只在第六屏（progress 0.58-0.80）出现
 * 配色：银白主调，高对比度
 */
import { useEffect, useRef, useMemo } from 'react';

interface SignalHUDProps {
  scrollProgress: number;
}

export default function SignalHUD({ scrollProgress }: SignalHUDProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const p = scrollProgress;

  const hudOpacity = useMemo(() => {
    if (p < 0.58) return 0;
    if (p < 0.65) return (p - 0.58) / 0.07;
    if (p < 0.80) return 1;
    if (p < 0.88) return 1 - (p - 0.80) / 0.08;
    return 0;
  }, [p]);

  const dataProgress = useMemo(() => {
    return Math.min(1, Math.max(0, (p - 0.58) / 0.2));
  }, [p]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || hudOpacity <= 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let startTime = performance.now();

    function draw() {
      if (!ctx || !canvas) return;
      const elapsed = (performance.now() - startTime) / 1000;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const dp = dataProgress;

      // === 热图 (左上) ===
      const heatmapSize = 140;
      const heatmapX = 20;
      const heatmapY = 30;

      ctx.fillStyle = `rgba(255, 255, 255, ${hudOpacity * 0.5})`;
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillText('PRESSURE MAP', heatmapX, heatmapY - 8);

      for (let i = 0; i < 8; i++) {
        for (let j = 0; j < 8; j++) {
          const cellSize = heatmapSize / 8;
          const dist = Math.sqrt((i - 3.5) ** 2 + (j - 3.5) ** 2);
          const pulse = Math.sin(elapsed * 2 + dist * 0.5) * 0.1;
          const intensity = Math.max(0, (1 - dist / 4.5) * dp + pulse * dp);

          let r: number, g: number, b: number;
          if (intensity < 0.33) {
            const t = intensity / 0.33;
            r = Math.floor(30 + t * 0);
            g = Math.floor(58 + t * 124);
            b = Math.floor(95 + t * 117);
          } else if (intensity < 0.66) {
            const t = (intensity - 0.33) / 0.33;
            r = Math.floor(30 + t * 215);
            g = Math.floor(182 - t * 24);
            b = Math.floor(212 - t * 201);
          } else {
            const t = (intensity - 0.66) / 0.34;
            r = Math.floor(245);
            g = Math.floor(158 - t * 100);
            b = Math.floor(11);
          }

          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${Math.min(0.9, intensity * 0.8 + 0.05)})`;
          ctx.fillRect(
            heatmapX + i * cellSize,
            heatmapY + j * cellSize,
            cellSize - 1,
            cellSize - 1
          );
        }
      }

      ctx.strokeStyle = `rgba(255, 255, 255, ${hudOpacity * 0.1})`;
      ctx.lineWidth = 0.5;
      ctx.strokeRect(heatmapX - 1, heatmapY - 1, heatmapSize + 2, heatmapSize + 2);

      // === 波形曲线 (右上) ===
      const waveX = 190;
      const waveY = 30;
      const waveW = 180;
      const waveH = 50;

      ctx.fillStyle = `rgba(255, 255, 255, ${hudOpacity * 0.5})`;
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillText('SIGNAL OUTPUT', waveX, waveY - 8);

      ctx.strokeStyle = `rgba(255, 255, 255, ${hudOpacity * 0.05})`;
      ctx.lineWidth = 0.5;
      for (let i = 0; i <= 4; i++) {
        const y = waveY + (waveH / 4) * i;
        ctx.beginPath();
        ctx.moveTo(waveX, y);
        ctx.lineTo(waveX + waveW, y);
        ctx.stroke();
      }

      // 主信号波形 — 白色
      ctx.strokeStyle = `rgba(255, 255, 255, ${hudOpacity * 0.85})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i <= waveW; i++) {
        const t = i / waveW;
        const phase = elapsed * 3;
        const signal = Math.sin((t + phase) * Math.PI * 4) *
          Math.exp(-((t - 0.5 + Math.sin(elapsed) * 0.1) ** 2) * 6) * dp;
        const y = waveY + waveH / 2 - signal * waveH * 0.4;
        if (i === 0) ctx.moveTo(waveX + i, y);
        else ctx.lineTo(waveX + i, y);
      }
      ctx.stroke();

      // 次信号波形 — 浅灰
      ctx.strokeStyle = `rgba(180, 180, 190, ${hudOpacity * 0.4})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i <= waveW; i++) {
        const t = i / waveW;
        const phase = elapsed * 2;
        const signal = Math.cos((t + phase) * Math.PI * 3 + 1) *
          Math.exp(-((t - 0.4) ** 2) * 5) * dp * 0.5;
        const y = waveY + waveH / 2 - signal * waveH * 0.4;
        if (i === 0) ctx.moveTo(waveX + i, y);
        else ctx.lineTo(waveX + i, y);
      }
      ctx.stroke();

      // === 电阻变化曲线 (下方) ===
      const resX = 190;
      const resY = 110;
      const resW = 180;
      const resH = 40;

      ctx.fillStyle = `rgba(255, 255, 255, ${hudOpacity * 0.5})`;
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillText('RESISTANCE Δ', resX, resY - 8);

      ctx.strokeStyle = `rgba(245, 158, 11, ${hudOpacity * 0.7})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i <= resW; i++) {
        const t = i / resW;
        const step = Math.floor(t * 6) / 6;
        const val = (1 - step * dp) * 0.8 + Math.sin(elapsed * 4 + t * 10) * 0.02 * dp;
        const y = resY + resH * (1 - val);
        if (i === 0) ctx.moveTo(resX + i, y);
        else ctx.lineTo(resX + i, y);
      }
      ctx.stroke();

      animFrameRef.current = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [hudOpacity, dataProgress]);

  if (hudOpacity <= 0) return null;

  const resistance = Math.floor((1 - dataProgress) * 847 + 120 + Math.random() * 2);
  const contactPoints = Math.floor(dataProgress * 24);
  const voltage = (dataProgress * 2.4).toFixed(2);
  const sensitivity = (dataProgress * 0.85).toFixed(3);

  return (
    <div
      className="absolute right-12 top-1/2 -translate-y-1/2 pointer-events-none"
      style={{
        opacity: hudOpacity,
        zIndex: 10,
      }}
    >
      <div
        className="relative p-5 rounded-xl"
        style={{
          background: 'rgba(10, 10, 15, 0.7)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <canvas
          ref={canvasRef}
          width={400}
          height={170}
          className="block"
        />

        <div className="mt-4 pt-4 space-y-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-3 font-mono text-xs">
            <div className="w-1.5 h-1.5 rounded-full bg-white" />
            <span className="text-white/40 w-28">RESISTANCE</span>
            <span className="text-white/80 tabular-nums">{resistance} Ω</span>
          </div>
          <div className="flex items-center gap-3 font-mono text-xs">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#88aacc' }} />
            <span className="text-white/40 w-28">CONTACT PTS</span>
            <span className="text-white/80 tabular-nums">{contactPoints} / 36</span>
          </div>
          <div className="flex items-center gap-3 font-mono text-xs">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#f59e0b' }} />
            <span className="text-white/40 w-28">V_OUT</span>
            <span className="text-white/80 tabular-nums">{voltage} V</span>
          </div>
          <div className="flex items-center gap-3 font-mono text-xs">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#10b981' }} />
            <span className="text-white/40 w-28">SENSITIVITY</span>
            <span className="text-white/80 tabular-nums">{sensitivity} kPa⁻¹</span>
          </div>
        </div>
      </div>
    </div>
  );
}
