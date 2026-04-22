/**
 * HeroSensorSection.tsx — 6 屏滚动叙事容器
 * 
 * 进度指示器：编号 + 阶段名（01 纱线 / 02 构网 / 03 加工 / 04 成型 / 05 受压 / 06 读出）
 * 背景：#0a0e1a 深黑
 */
import { useEffect, useRef, useState, lazy, Suspense } from 'react';

const SensorScene = lazy(() => import('./SensorScene'));

const STAGES = [
  { id: '01', name: '纱线' },
  { id: '02', name: '构网' },
  { id: '03', name: '加工' },
  { id: '04', name: '成型' },
  { id: '05', name: '受压' },
  { id: '06', name: '读出' },
];

export default function HeroSensorSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [sceneReady, setSceneReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSceneReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const rect = container.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const totalScroll = container.scrollHeight - windowHeight;
      const scrolled = -rect.top;
      const progress = Math.max(0, Math.min(1, scrolled / totalScroll));
      setScrollProgress(progress);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 当前阶段（0-5）
  const stageIndex = Math.min(5, Math.floor(scrollProgress * 6));
  const currentStage = STAGES[stageIndex];

  return (
    <div
      ref={containerRef}
      className="relative"
      style={{ height: '600vh' }} /* 6 屏 */
    >
      <div
        className="sticky top-0 w-full h-screen overflow-hidden"
        style={{ background: '#0a0e1a' }}
      >
        {/* Three.js 3D Scene */}
        {sceneReady && (
          <Suspense fallback={null}>
            <SensorScene scrollProgress={scrollProgress} />
          </Suspense>
        )}

        {/* 进度指示器 — 右下角：编号 + 阶段名 */}
        <div
          className="absolute bottom-8 right-8 flex flex-col items-end gap-3"
          style={{ zIndex: 10 }}
        >
          {/* 当前阶段名 */}
          <div className="flex items-baseline gap-2">
            <span
              className="text-xs tracking-[0.3em] uppercase"
              style={{
                color: 'rgba(255,255,255,0.25)',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '10px',
              }}
            >
              {currentStage.id}
            </span>
            <span
              className="text-sm tracking-[0.15em]"
              style={{
                color: 'rgba(255,255,255,0.55)',
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 500,
              }}
            >
              {currentStage.name}
            </span>
          </div>

          {/* 6 段进度条 */}
          <div className="flex items-center gap-1">
            {STAGES.map((stage, i) => (
              <div
                key={stage.id}
                className="relative h-[2px] transition-all duration-500"
                style={{
                  width: i === stageIndex ? '24px' : '12px',
                  background: i <= stageIndex
                    ? 'rgba(255,255,255,0.5)'
                    : 'rgba(255,255,255,0.1)',
                }}
              />
            ))}
          </div>
        </div>

        {/* 首屏滚动提示 */}
        {scrollProgress < 0.05 && (
          <div
            className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-pulse"
            style={{ zIndex: 10 }}
          >
            <span
              className="text-xs tracking-[0.2em]"
              style={{
                color: 'rgba(255,255,255,0.25)',
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              SCROLL
            </span>
            <svg width="16" height="24" viewBox="0 0 16 24" fill="none" style={{ opacity: 0.25 }}>
              <path d="M8 4V20M8 20L2 14M8 20L14 14" stroke="white" strokeWidth="1.5" />
            </svg>
          </div>
        )}

        {/* Vignette */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 50%, rgba(10,14,26,0.6) 100%)',
            zIndex: 2,
          }}
        />
      </div>
    </div>
  );
}
