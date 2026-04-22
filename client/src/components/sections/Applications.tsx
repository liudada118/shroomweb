/**
 * Applications.tsx — 真实应用场景
 * 1 大 2 小非对称卡片布局
 * 银白色调，高对比度
 */
import { useEffect, useRef, useState } from 'react';

const FOOT_IMG = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663332343321/eJoLX2GNEf9n3kDr6f2Q7X/foot-pressure_ae99c023.png';
const SKIN_IMG = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663332343321/eJoLX2GNEf9n3kDr6f2Q7X/skin-monitor_112ef068.png';
const ROBOT_IMG = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663332343321/eJoLX2GNEf9n3kDr6f2Q7X/tactile-robot_8280233c.png';

const apps = [
  {
    id: 'foot',
    title: '足压监测',
    description: '用于足压分布、步态分析与姿态评估。',
    detail: '传感层嵌入鞋垫或足底模块，落脚后实时生成压力分布热图，为运动医学与康复训练提供精确数据支撑。',
    image: FOOT_IMG,
  },
  {
    id: 'skin',
    title: '贴肤监测',
    description: '用于贴肤佩戴场景中的连续压力感知。',
    detail: '柔性传感层贴合腕部、关节或胸前，持续监测脉搏、呼吸与动作压力变化。',
    image: SKIN_IMG,
  },
  {
    id: 'tactile',
    title: '柔性触觉输入',
    description: '用于柔性界面与触觉感知。',
    detail: '机械手或软体表面接触物体时，传感阵列实时反馈触压分布。',
    image: ROBOT_IMG,
  },
];

export default function Applications() {
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
        {/* Section header */}
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
            APPLICATIONS
          </span>
          <h3
            className="text-3xl md:text-4xl font-bold"
            style={{
              color: '#ffffff',
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            从实验室到真实场景
          </h3>
        </div>

        {/* Cards layout: 1 large + 2 small */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Primary card */}
          <div
            className="relative rounded-2xl overflow-hidden group transition-all duration-700 lg:row-span-2"
            style={{
              opacity: visible ? 1 : 0,
              transform: visible ? 'translateY(0)' : 'translateY(30px)',
              minHeight: '520px',
            }}
          >
            <img
              src={apps[0].image}
              alt={apps[0].title}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              loading="lazy"
            />
            <div
              className="absolute inset-0"
              style={{
                background: 'linear-gradient(to top, rgba(10,10,15,0.95) 0%, rgba(10,10,15,0.3) 50%, rgba(10,10,15,0.05) 100%)',
              }}
            />
            <div className="absolute bottom-0 left-0 right-0 p-10">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                <span
                  className="text-xs tracking-[0.15em] uppercase"
                  style={{
                    color: 'rgba(255, 255, 255, 0.5)',
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  PRIMARY APPLICATION
                </span>
              </div>
              <h4
                className="text-3xl md:text-4xl font-bold mb-4"
                style={{
                  color: '#ffffff',
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                {apps[0].title}
              </h4>
              <p className="text-base leading-relaxed mb-2" style={{ color: 'rgba(255, 255, 255, 0.65)' }}>
                {apps[0].description}
              </p>
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255, 255, 255, 0.35)' }}>
                {apps[0].detail}
              </p>
            </div>
          </div>

          {/* Secondary cards */}
          {apps.slice(1).map((app, i) => (
            <div
              key={app.id}
              className="relative rounded-2xl overflow-hidden group transition-all duration-700"
              style={{
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(30px)',
                transitionDelay: `${(i + 1) * 200}ms`,
                minHeight: '250px',
              }}
            >
              <img
                src={app.image}
                alt={app.title}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                loading="lazy"
              />
              <div
                className="absolute inset-0"
                style={{
                  background: 'linear-gradient(to top, rgba(10,10,15,0.95) 0%, rgba(10,10,15,0.2) 60%, rgba(10,10,15,0.05) 100%)',
                }}
              />
              <div className="absolute bottom-0 left-0 right-0 p-8">
                <h4
                  className="text-2xl font-bold mb-2"
                  style={{
                    color: '#ffffff',
                    fontFamily: "'Space Grotesk', sans-serif",
                  }}
                >
                  {app.title}
                </h4>
                <p className="text-sm leading-relaxed" style={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                  {app.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
