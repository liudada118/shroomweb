import { lazy, Suspense, useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import HeroSensorSection from '@/components/hero/HeroSensorSection';

const ShroomJourneySection = lazy(() => import('@/components/sections/ShroomJourneySection'));

type EntryMode = 'portal' | 'juqiao' | 'shroom';

const ENTRY_OPTIONS: Array<{
  key: EntryMode;
  eyebrow: string;
  title: string;
  summary: string;
  accent: string;
}> = [
  {
    key: 'juqiao',
    eyebrow: 'JQ Entry',
    title: '矩侨',
    summary: '进入柔性、小点距、可死折的主传感器电影式首屏。',
    accent: '#7dd3fc',
  },
  {
    key: 'shroom',
    eyebrow: 'Shroom Entry',
    title: 'Shroom',
    summary: '进入蘑菇 loading、粒子蘑菇、床垫拍打与 SOS 粒子警报码。',
    accent: '#fb7185',
  },
];

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed left-6 top-20 z-[60] rounded-full px-4 py-2 text-xs tracking-[0.22em] uppercase transition-all duration-300 md:left-8"
      style={{
        color: 'rgba(255,255,255,0.74)',
        background: 'rgba(4,8,22,0.72)',
        border: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(16px)',
        fontFamily: "'JetBrains Mono', monospace",
      }}
    >
      Back To Entry
    </button>
  );
}

export default function Home() {
  const [entryMode, setEntryMode] = useState<EntryMode>('portal');

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [entryMode]);

  if (entryMode === 'portal') {
    return (
      <div
        className="min-h-screen px-6 py-8 md:px-10 md:py-10 lg:px-16"
        style={{
          background:
            'radial-gradient(circle at 20% 20%, rgba(125,211,252,0.12), transparent 35%), radial-gradient(circle at 80% 24%, rgba(251,113,133,0.12), transparent 32%), linear-gradient(180deg, #040816 0%, #09111f 100%)',
        }}
      >
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl flex-col justify-between">
          <div className="flex items-center justify-between">
            <span
              className="text-xs tracking-[0.34em] uppercase"
              style={{
                color: 'rgba(255,255,255,0.34)',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              Dual Entry
            </span>

            <div
              className="rounded-full px-4 py-2 text-xs tracking-[0.24em] uppercase"
              style={{
                color: 'rgba(255,255,255,0.54)',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              JQ / Shroom
            </div>
          </div>

          <div className="max-w-4xl py-12 md:py-16">
            <h1
              className="max-w-4xl text-4xl font-bold leading-[1.02] sm:text-5xl md:text-6xl lg:text-7xl"
              style={{
                color: '#ffffff',
                fontFamily: "'Space Grotesk', sans-serif",
                letterSpacing: '-0.05em',
              }}
            >
              Split the homepage into two direct entries: JQ and Shroom.
            </h1>

            <p
              className="mt-6 max-w-2xl text-base leading-7 md:text-lg"
              style={{ color: 'rgba(255,255,255,0.6)' }}
            >
              One route goes into the flexible pressure-sensor film. The other route goes into the Shroom
              loading sequence, the particle mushroom, the bed impact scene, and the SOS particle alert.
            </p>
          </div>

          <div className="grid gap-5 pb-4 md:grid-cols-2 md:pb-0">
            {ENTRY_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setEntryMode(option.key)}
                className="group rounded-[32px] p-6 text-left transition-all duration-500 md:p-8"
                style={{
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.1), rgba(255,255,255,0.03))',
                  border: `1px solid ${option.accent}33`,
                  boxShadow: `0 28px 100px ${option.accent}18`,
                  backdropFilter: 'blur(22px)',
                }}
              >
                <div
                  className="text-[11px] tracking-[0.28em] uppercase"
                  style={{
                    color: 'rgba(255,255,255,0.34)',
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  {option.eyebrow}
                </div>

                <div
                  className="mt-10 text-4xl font-bold md:text-5xl"
                  style={{
                    color: '#ffffff',
                    fontFamily: "'Space Grotesk', sans-serif",
                    letterSpacing: '-0.04em',
                  }}
                >
                  {option.title}
                </div>

                <p
                  className="mt-5 max-w-md text-sm leading-7 md:text-base"
                  style={{ color: 'rgba(255,255,255,0.62)' }}
                >
                  {option.summary}
                </p>

                <div
                  className="mt-10 inline-flex items-center rounded-full px-4 py-2 text-xs tracking-[0.24em] uppercase transition-transform duration-500 group-hover:translate-x-1"
                  style={{
                    color: 'rgba(255,255,255,0.8)',
                    background: `${option.accent}22`,
                    border: `1px solid ${option.accent}33`,
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  Enter
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (entryMode === 'juqiao') {
    return (
      <div className="min-h-screen" style={{ background: '#0a0e1a' }}>
        <Navbar />
        <BackButton onClick={() => setEntryMode('portal')} />
        <HeroSensorSection />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: '#040816' }}>
      <Suspense fallback={null}>
        <ShroomJourneySection onBack={() => setEntryMode('portal')} />
      </Suspense>
    </div>
  );
}
