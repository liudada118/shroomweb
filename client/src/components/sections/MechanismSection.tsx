/**
 * MechanismSection.tsx — 中段机理说明
 * 银白色调，高对比度
 */
import { useEffect, useRef, useState } from 'react';

const WOVEN_IMG = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663332343321/eJoLX2GNEf9n3kDr6f2Q7X/woven-mesh_839ece30.png';

export default function MechanismSection() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { threshold: 0.15, rootMargin: '50px' }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      className="relative py-40 overflow-hidden"
      style={{ background: '#0a0a0f' }}
    >
      {/* 背景图片 */}
      <div
        className="absolute inset-0 transition-all duration-[2000ms]"
        style={{
          backgroundImage: `url(${WOVEN_IMG})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          opacity: visible ? 0.06 : 0,
          transform: visible ? 'scale(1)' : 'scale(1.05)',
        }}
      />

      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(180deg, #0a0a0f 0%, rgba(10,10,15,0.75) 50%, #0a0a0f 100%)',
        }}
      />

      <div className="relative max-w-4xl mx-auto px-8 text-center">
        {/* 装饰线 */}
        <div
          className="flex items-center justify-center gap-4 mb-14 transition-all duration-1000"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(15px)',
          }}
        >
          <div className="w-20 h-px bg-gradient-to-r from-transparent to-white/15" />
          <div className="w-2 h-2 rounded-full bg-white/15" />
          <div className="w-20 h-px bg-gradient-to-l from-transparent to-white/15" />
        </div>

        {/* 主标题 */}
        <h3
          className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight mb-8 transition-all duration-1000 delay-100"
          style={{
            color: '#ffffff',
            fontFamily: "'Space Grotesk', sans-serif",
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(20px)',
          }}
        >
          结构响应，不止于形变。
        </h3>

        {/* 说明文字 */}
        <p
          className="text-lg md:text-xl leading-relaxed max-w-2xl mx-auto transition-all duration-1000 delay-200"
          style={{
            color: 'rgba(255, 255, 255, 0.45)',
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(20px)',
          }}
        >
          当外部压力作用于纤维网络，局部接触状态与导电路径发生变化，最终表现为可测量的电阻变化。
          这一过程不依赖单一形变量，而是纤维间接触几何、导电网络拓扑与材料本征电阻率的协同响应。
        </p>

        {/* 三个关键词 */}
        <div
          className="flex flex-wrap items-center justify-center gap-6 mt-14 transition-all duration-1000 delay-300"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(20px)',
          }}
        >
          {[
            { label: '接触几何', color: '#ffffff' },
            { label: '导电路径', color: '#88aacc' },
            { label: '电阻映射', color: '#f59e0b' },
          ].map((item, i) => (
            <div
              key={item.label}
              className="flex items-center gap-2.5 px-6 py-3 rounded-full transition-all duration-500"
              style={{
                background: `rgba(255,255,255,0.03)`,
                border: `1px solid rgba(255,255,255,0.08)`,
                transitionDelay: `${300 + i * 100}ms`,
              }}
            >
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: item.color }}
              />
              <span
                className="text-sm tracking-wide"
                style={{
                  color: `rgba(255,255,255,0.55)`,
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
