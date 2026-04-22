/**
 * SpecsStrip.tsx — 三个核心技术指标
 * 银白色调，大数字，高对比度
 */
import { useEffect, useRef, useState } from 'react';

const specs = [
  {
    value: '<0.1',
    unit: 'mm',
    label: '最小可检测形变',
    description: '纤维网络对微小压力变化的灵敏响应',
  },
  {
    value: '10',
    unit: 'ms',
    label: '响应时间',
    description: '从受压到信号输出的端到端延迟',
  },
  {
    value: '>10K',
    unit: '次',
    label: '循环耐久',
    description: '重复加压-释压后仍保持信号一致性',
  },
];

export default function SpecsStrip() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { threshold: 0.1, rootMargin: '50px' }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      className="relative py-32 overflow-hidden"
      style={{ background: '#0a0a0f' }}
    >
      {/* 顶部分隔线 */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      <div className="max-w-7xl mx-auto px-8">
        {/* 标题 */}
        <div
          className="mb-20 text-center transition-all duration-1000"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(20px)',
          }}
        >
          <span
            className="text-xs tracking-[0.3em] uppercase mb-4 block"
            style={{
              color: 'rgba(255, 255, 255, 0.3)',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            SPECIFICATIONS
          </span>
          <h3
            className="text-3xl md:text-4xl font-bold"
            style={{
              color: '#ffffff',
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            核心技术指标
          </h3>
        </div>

        {/* 指标卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-1">
          {specs.map((spec, i) => (
            <div
              key={spec.label}
              className="relative p-12 text-center transition-all duration-700"
              style={{
                background: 'rgba(255, 255, 255, 0.02)',
                borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(30px)',
                transitionDelay: `${i * 150}ms`,
              }}
            >
              {/* 数值 */}
              <div className="flex items-baseline justify-center gap-1 mb-4">
                <span
                  className="text-5xl md:text-6xl lg:text-7xl font-bold"
                  style={{
                    color: '#ffffff',
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  {spec.value}
                </span>
                <span
                  className="text-xl md:text-2xl"
                  style={{
                    color: 'rgba(255, 255, 255, 0.4)',
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  {spec.unit}
                </span>
              </div>

              {/* 标签 */}
              <h4
                className="text-base font-medium mb-3"
                style={{ color: 'rgba(255,255,255,0.7)' }}
              >
                {spec.label}
              </h4>

              {/* 描述 */}
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255, 255, 255, 0.35)' }}>
                {spec.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
