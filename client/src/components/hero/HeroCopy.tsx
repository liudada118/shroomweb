/**
 * HeroCopy.tsx — 8 屏文案层
 * 全屏居中展示，大字号，高对比度
 * 白色文字确保在深色背景上清晰可见
 */
import { useMemo } from 'react';

interface HeroCopyProps {
  scrollProgress: number;
}

const screens = [
  {
    id: 1,
    title: '把柔性纤维结构，\n转化为可读的压力数据。',
    subtitle: '压阻式纤维压力传感器，将微小受压引起的结构变化，稳定转化为电信号输出。',
    cta: ['查看技术方案', '联系合作'],
    range: [0, 0.10] as [number, number],
  },
  {
    id: 2,
    title: '从单根纤维，\n到可感知结构。',
    subtitle: '两根功能纱线进入视野，为后续感知网络建立基础。',
    range: [0.10, 0.22] as [number, number],
  },
  {
    id: 3,
    title: '交错编织，\n形成连续的感知网络。',
    subtitle: '柔性、轻量、可弯折的纤维结构，构成可集成的压力感知基础。',
    range: [0.22, 0.34] as [number, number],
  },
  {
    id: 4,
    title: '复合封装，\n让传感结构更稳定。',
    subtitle: '在柔性纤维网络外，引入功能层与保护层，兼顾结构稳定、可穿戴性与信号一致性。',
    range: [0.34, 0.46] as [number, number],
  },
  {
    id: 5,
    title: '当压力落下，\n结构开始响应。',
    subtitle: '局部压缩改变纤维之间、纤维与电极之间的接触状态，进而改变整体电阻。',
    range: [0.46, 0.58] as [number, number],
  },
  {
    id: 6,
    title: '把机械压力，\n翻译成可读数据。',
    subtitle: '从局部受压，到阵列映射、波形输出与实时读数，完成从结构响应到数据读出的转化。',
    range: [0.58, 0.72] as [number, number],
  },
  {
    id: 7,
    title: '从实验室，\n到真实场景。',
    subtitle: '足压监测、贴肤感知、柔性触觉——纤维传感结构正在进入真实应用。',
    range: [0.72, 0.85] as [number, number],
  },
  {
    id: 8,
    title: '把柔性、贴合与压力感知，\n做进同一片纤维结构里。',
    subtitle: '面向可穿戴、智能纺织与柔性电子场景的压阻式纤维压力传感方案。',
    cta: ['获取样品', '预约沟通'],
    range: [0.85, 1.0] as [number, number],
  },
];

const smoothstep = (min: number, max: number, val: number) => {
  const t = Math.max(0, Math.min(1, (val - min) / (max - min)));
  return t * t * (3 - 2 * t);
};

export default function HeroCopy({ scrollProgress }: HeroCopyProps) {
  const p = scrollProgress;

  const activeScreen = useMemo(() => {
    for (let i = screens.length - 1; i >= 0; i--) {
      if (p >= screens[i].range[0]) return screens[i];
    }
    return screens[0];
  }, [p]);

  const screenOpacity = useMemo(() => {
    const s = activeScreen;
    const rangeLen = s.range[1] - s.range[0];
    const fadeIn = 0.2 * rangeLen;
    const fadeOut = 0.2 * rangeLen;
    const localP = p - s.range[0];

    // 首屏初始就可见
    if (s.id === 1 && localP < fadeIn) return 1;
    // 末屏保持可见
    if (s.id === 8 && localP > rangeLen - fadeOut) return 1;

    if (localP < fadeIn) return localP / fadeIn;
    if (localP > rangeLen - fadeOut) return (rangeLen - localP) / fadeOut;
    return 1;
  }, [p, activeScreen]);

  const currentIndex = screens.findIndex(s => p >= s.range[0] && p < s.range[1]);
  const activeIndex = currentIndex >= 0 ? currentIndex : screens.length - 1;

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 5 }}>
      {/* 全屏居中文案 */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="text-center max-w-5xl px-8 transition-opacity duration-300"
          style={{ opacity: Math.max(0, Math.min(1, screenOpacity)) }}
        >
          {/* 屏序号 */}
          <div className="mb-8 flex items-center justify-center gap-4">
            <div className="w-12 h-px" style={{ background: 'rgba(255,255,255,0.15)' }} />
            <span
              className="text-sm tracking-[0.25em]"
              style={{
                color: 'rgba(255,255,255,0.3)',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              {String(activeScreen.id).padStart(2, '0')} / 08
            </span>
            <div className="w-12 h-px" style={{ background: 'rgba(255,255,255,0.15)' }} />
          </div>

          {/* 主标题 — 超大字号 */}
          <h1
            className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.15] mb-8"
            style={{
              color: '#ffffff',
              fontFamily: "'Space Grotesk', sans-serif",
              textShadow: '0 4px 60px rgba(0,0,0,0.6)',
              whiteSpace: 'pre-line',
              letterSpacing: '-0.02em',
            }}
          >
            {activeScreen.title}
          </h1>

          {/* 副标题 */}
          <p
            className="text-lg sm:text-xl md:text-2xl leading-relaxed max-w-2xl mx-auto mb-12"
            style={{
              color: 'rgba(255,255,255,0.5)',
              textShadow: '0 2px 30px rgba(0,0,0,0.5)',
            }}
          >
            {activeScreen.subtitle}
          </p>

          {/* CTA 按钮 */}
          {activeScreen.cta && (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-5 pointer-events-auto">
              <button
                className="px-10 py-4 text-base font-semibold rounded-lg transition-all duration-300 hover:scale-105 hover:shadow-[0_0_40px_rgba(255,255,255,0.2)]"
                style={{
                  background: '#ffffff',
                  color: '#0a0a0f',
                }}
              >
                {activeScreen.cta[0]}
              </button>
              <button
                className="px-10 py-4 text-base font-medium rounded-lg transition-all duration-300 hover:bg-white/10"
                style={{
                  background: 'transparent',
                  color: 'rgba(255,255,255,0.8)',
                  border: '1px solid rgba(255,255,255,0.25)',
                }}
              >
                {activeScreen.cta[1]}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 右侧进度指示器 */}
      <div className="absolute right-8 top-1/2 -translate-y-1/2 flex flex-col gap-3">
        {screens.map((_, i) => (
          <div
            key={i}
            className="transition-all duration-500"
            style={{
              width: i === activeIndex ? '3px' : '3px',
              height: i === activeIndex ? '24px' : '8px',
              borderRadius: '2px',
              background: i === activeIndex ? '#ffffff' : 'rgba(255,255,255,0.15)',
              boxShadow: i === activeIndex ? '0 0 10px rgba(255,255,255,0.3)' : 'none',
            }}
          />
        ))}
      </div>

      {/* 底部滚动提示 — 仅首屏 */}
      {p < 0.05 && (
        <div
          className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3"
          style={{ opacity: 1 - p * 20 }}
        >
          <span
            className="text-xs tracking-[0.2em] uppercase"
            style={{
              color: 'rgba(255,255,255,0.3)',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            SCROLL TO EXPLORE
          </span>
          <div className="w-5 h-8 rounded-full border border-white/20 flex items-start justify-center pt-1.5">
            <div className="w-1 h-2 rounded-full bg-white/40 animate-bounce" />
          </div>
        </div>
      )}
    </div>
  );
}
