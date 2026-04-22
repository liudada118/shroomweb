/**
 * Home.tsx — 纯交互演示模式
 * 只保留 3D 场景和滚动交互，隐藏文案和静态区域
 */
import { lazy, Suspense } from 'react';
import Navbar from '@/components/Navbar';
import HeroSensorSection from '@/components/hero/HeroSensorSection';

const ParticleMorphSection = lazy(() => import('@/components/sections/ParticleMorphSection'));

export default function Home() {
  return (
    <div className="min-h-screen" style={{ background: '#0a0e1a' }}>
      <Navbar />
      <HeroSensorSection />
      <Suspense fallback={null}>
        <ParticleMorphSection />
      </Suspense>
    </div>
  );
}
