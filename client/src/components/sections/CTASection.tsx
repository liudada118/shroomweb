/**
 * CTASection.tsx — CTA 收束区
 * 银白色调，高对比度，大气居中
 */
import { useEffect, useRef, useState } from 'react';

const WOVEN_IMG = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663332343321/eJoLX2GNEf9n3kDr6f2Q7X/woven-mesh_839ece30.png';

export default function CTASection() {
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
      {/* 顶部分隔线 */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      {/* 背景产品图 */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="w-[500px] h-[500px] md:w-[700px] md:h-[700px] rounded-full transition-all duration-[2000ms]"
          style={{
            opacity: visible ? 0.08 : 0,
            background: `url(${WOVEN_IMG}) center/cover`,
            filter: 'blur(3px)',
            transform: visible ? 'scale(1)' : 'scale(0.8)',
          }}
        />
      </div>

      {/* 径向光晕 */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.02) 0%, transparent 60%)',
        }}
      />

      <div className="relative max-w-4xl mx-auto px-8 text-center">
        {/* 标注 */}
        <div
          className="flex items-center justify-center gap-4 mb-12 transition-all duration-1000"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(20px)',
          }}
        >
          <div className="w-16 h-px bg-gradient-to-r from-transparent to-white/15" />
          <span
            className="text-xs tracking-[0.3em] uppercase"
            style={{
              color: 'rgba(255, 255, 255, 0.3)',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            GET STARTED
          </span>
          <div className="w-16 h-px bg-gradient-to-l from-transparent to-white/15" />
        </div>

        {/* 主文案 */}
        <h2
          className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-8 transition-all duration-1000 delay-100"
          style={{
            color: '#ffffff',
            fontFamily: "'Space Grotesk', sans-serif",
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(20px)',
          }}
        >
          把柔性、贴合与压力感知，<br />
          做进同一片纤维结构里。
        </h2>

        {/* 副文案 */}
        <p
          className="text-lg md:text-xl leading-relaxed mb-14 max-w-2xl mx-auto transition-all duration-1000 delay-200"
          style={{
            color: 'rgba(255, 255, 255, 0.4)',
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(20px)',
          }}
        >
          面向可穿戴、智能纺织与柔性电子场景的压阻式纤维压力传感方案。
        </p>

        {/* CTA 按钮 */}
        <div
          className="flex flex-col sm:flex-row items-center justify-center gap-5 transition-all duration-1000 delay-300"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(20px)',
          }}
        >
          <button
            className="px-10 py-4 text-base font-semibold rounded-lg transition-all duration-300 hover:scale-105 hover:shadow-[0_0_40px_rgba(255,255,255,0.15)]"
            style={{
              background: '#ffffff',
              color: '#0a0a0f',
            }}
          >
            获取样品
          </button>
          <button
            className="px-10 py-4 text-base font-medium rounded-lg transition-all duration-300 hover:bg-white/10"
            style={{
              background: 'transparent',
              color: 'rgba(255, 255, 255, 0.8)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
            }}
          >
            预约沟通
          </button>
        </div>

        {/* 底部签名 */}
        <p
          className="mt-24 text-sm transition-all duration-1000 delay-500"
          style={{
            color: 'rgba(255, 255, 255, 0.2)',
            fontFamily: "'JetBrains Mono', monospace",
            opacity: visible ? 1 : 0,
          }}
        >
          为真实接触而设计，为真实数据而输出。
        </p>
      </div>
    </section>
  );
}
