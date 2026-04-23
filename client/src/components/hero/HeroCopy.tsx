import { useMemo } from 'react';

interface HeroCopyProps {
  scrollProgress: number;
}

type ScreenFact = {
  label: string;
  value: string;
};

type Screen = {
  id: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  facts: ScreenFact[];
  range: [number, number];
};

const screens: Screen[] = [
  {
    id: '01',
    eyebrow: 'Flexible Pressure Film',
    title: '柔性纤维传感层，贴合、密布、可死折。',
    subtitle:
      '把压力感知做进柔性纤维结构里，在曲面贴合、反复弯折和极限折叠场景下，依然保持连续的压力读出能力。',
    facts: [
      { label: '柔性贴合', value: '贴肤与曲面集成更自然' },
      { label: '点间距更小', value: '压力地图更连续' },
      { label: '可死折', value: '复杂折叠后仍可部署' },
    ],
    range: [0, 0.16],
  },
  {
    id: '02',
    eyebrow: 'Dense Sampling Grid',
    title: '更小的点间距，把微小压力变化拉到可见。',
    subtitle:
      '采样点更密，局部峰值与边缘压力不会轻易被稀疏点阵吞掉，整张压力图的过渡也更完整、更细腻。',
    facts: [
      { label: '压力细节', value: '更容易保留局部峰值' },
      { label: '空间分辨率', value: '更适合动态轮廓跟踪' },
      { label: '连续表面', value: '热区变化更平滑' },
    ],
    range: [0.16, 0.32],
  },
  {
    id: '03',
    eyebrow: 'Fold-Ready Structure',
    title: '不是只能弯，而是能真正进入死折工况。',
    subtitle:
      '针对可穿戴、可卷曲和复杂装配路径，传感层可以随着结构折叠、转角和贴附走形，而不是被刚性方案限制。',
    facts: [
      { label: '卷曲布设', value: '适配软性结构与异形面' },
      { label: '死折容忍', value: '保留部署自由度' },
      { label: '轻薄结构', value: '减少集成负担' },
    ],
    range: [0.32, 0.48],
  },
  {
    id: '04',
    eyebrow: 'Stable Packaging',
    title: '从纤维骨架到稳定封装，为真实产品集成准备。',
    subtitle:
      '感知网络不是实验室演示件，而是可继续进入床垫、座椅、机器人等终端系统的柔性传感基础层。',
    facts: [
      { label: '结构稳定', value: '便于连续使用' },
      { label: '柔性封装', value: '兼顾保护与贴合' },
      { label: '产品化路径', value: '便于进入终端模组' },
    ],
    range: [0.48, 0.64],
  },
  {
    id: '05',
    eyebrow: 'Pressure To Signal',
    title: '压力落下的瞬间，就开始被结构翻译成信号。',
    subtitle:
      '从局部受压、接触变化到电阻响应，整套纤维结构把物理压力变成了可以连续追踪的实时输入。',
    facts: [
      { label: '实时变化', value: '响应受压过程' },
      { label: '连续追踪', value: '动态过程更可读' },
      { label: '可映射', value: '便于进入监测与控制' },
    ],
    range: [0.64, 0.82],
  },
  {
    id: '06',
    eyebrow: 'From Material To Use Cases',
    title: '一层柔性传感结构，直接连接床、座椅与机器人。',
    subtitle:
      '同一套柔性压力感知底层，可以继续进入床垫监控报警、座椅实时调节和机器人实时触压感应等终端场景。',
    facts: [
      { label: '床垫', value: '监测异常并联动报警' },
      { label: '座椅', value: '按受压分布实时调节' },
      { label: '机器人', value: '直接感应接触与触压' },
    ],
    range: [0.82, 1],
  },
];

const coreTraits = [
  {
    label: '柔性',
    description: '贴合曲面、贴肤与软性模组，不被刚性结构限制。',
  },
  {
    label: '小点距',
    description: '更密的压力采样，让热区边界和细节更可见。',
  },
  {
    label: '可死折',
    description: '为卷曲、折叠和复杂装配路径保留传感能力。',
  },
];

const smoothstep = (min: number, max: number, value: number) => {
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return t * t * (3 - 2 * t);
};

export default function HeroCopy({ scrollProgress }: HeroCopyProps) {
  const activeScreen = useMemo(() => {
    for (let index = screens.length - 1; index >= 0; index -= 1) {
      if (scrollProgress >= screens[index].range[0]) {
        return screens[index];
      }
    }

    return screens[0];
  }, [scrollProgress]);

  const screenOpacity = useMemo(() => {
    const [start, end] = activeScreen.range;
    const span = end - start;
    const localProgress = scrollProgress - start;
    const fadeIn = span * 0.2;
    const fadeOut = span * 0.2;

    if (activeScreen.id === '01' && localProgress < fadeIn) return 1;
    if (activeScreen.id === screens[screens.length - 1].id && localProgress > span - fadeOut) return 1;

    if (localProgress < fadeIn) return localProgress / fadeIn;
    if (localProgress > span - fadeOut) return (span - localProgress) / fadeOut;

    return 1;
  }, [activeScreen, scrollProgress]);

  const screenShift = useMemo(
    () => (1 - Math.max(0, Math.min(1, screenOpacity))) * 36,
    [screenOpacity],
  );

  const traitsOpacity = 1 - smoothstep(0.22, 0.42, scrollProgress);

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 5 }}>
      <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-black/30 to-transparent" />

      <div className="absolute left-6 right-6 top-24 md:left-10 md:right-auto md:top-28 lg:left-16">
        <div
          className="max-w-4xl transition-all duration-500"
          style={{
            opacity: Math.max(0, Math.min(1, screenOpacity)),
            transform: `translate3d(0, ${screenShift}px, 0)`,
          }}
        >
          <div
            className="mb-5 inline-flex items-center gap-3 rounded-full px-4 py-2"
            style={{
              color: 'rgba(255,255,255,0.72)',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
              backdropFilter: 'blur(18px)',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            <span className="text-[11px] tracking-[0.26em] uppercase">{activeScreen.eyebrow}</span>
            <span className="h-1 w-1 rounded-full bg-white/40" />
            <span className="text-[11px] tracking-[0.26em] uppercase">{activeScreen.id} / 06</span>
          </div>

          <h1
            className="max-w-5xl text-4xl font-bold leading-[1.05] sm:text-5xl md:text-6xl lg:text-7xl"
            style={{
              color: '#ffffff',
              fontFamily: "'Space Grotesk', sans-serif",
              letterSpacing: '-0.04em',
              textShadow: '0 24px 80px rgba(0,0,0,0.5)',
            }}
          >
            {activeScreen.title}
          </h1>

          <p
            className="mt-6 max-w-2xl text-base leading-7 md:text-lg md:leading-8"
            style={{ color: 'rgba(255,255,255,0.62)' }}
          >
            {activeScreen.subtitle}
          </p>

          <div className="mt-8 grid gap-3 md:max-w-4xl md:grid-cols-3">
            {activeScreen.facts.map((fact) => (
              <div
                key={fact.label}
                className="rounded-2xl px-5 py-4"
                style={{
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.1), rgba(255,255,255,0.03))',
                  border: '1px solid rgba(255,255,255,0.08)',
                  boxShadow: '0 24px 80px rgba(0,0,0,0.22)',
                  backdropFilter: 'blur(14px)',
                }}
              >
                <div
                  className="text-[11px] tracking-[0.24em] uppercase"
                  style={{
                    color: 'rgba(255,255,255,0.34)',
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  {fact.label}
                </div>
                <div
                  className="mt-2 text-sm leading-6 md:text-base"
                  style={{ color: 'rgba(255,255,255,0.86)' }}
                >
                  {fact.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div
        className="absolute bottom-24 left-6 right-6 md:bottom-10 md:left-10 md:right-auto lg:left-16"
        style={{ opacity: traitsOpacity }}
      >
        <div className="grid gap-3 md:max-w-4xl md:grid-cols-3">
          {coreTraits.map((trait) => (
            <div
              key={trait.label}
              className="rounded-2xl px-5 py-4"
              style={{
                background: 'rgba(4,8,20,0.46)',
                border: '1px solid rgba(125,211,252,0.14)',
                boxShadow: '0 18px 70px rgba(0,0,0,0.3)',
                backdropFilter: 'blur(14px)',
              }}
            >
              <div
                className="text-xs tracking-[0.22em] uppercase"
                style={{
                  color: 'rgba(125,211,252,0.78)',
                  fontFamily: "'JetBrains Mono', monospace",
                }}
              >
                {trait.label}
              </div>
              <div className="mt-2 text-sm leading-6" style={{ color: 'rgba(255,255,255,0.62)' }}>
                {trait.description}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
