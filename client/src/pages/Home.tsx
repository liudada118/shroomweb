import { lazy, Suspense } from 'react';

const ParticleMorphSection = lazy(() => import('@/components/sections/ParticleMorphSection'));

export default function Home() {
  return (
    <main className="min-h-screen" style={{ background: '#050814' }}>
      <Suspense fallback={null}>
        <ParticleMorphSection />
      </Suspense>
    </main>
  );
}
