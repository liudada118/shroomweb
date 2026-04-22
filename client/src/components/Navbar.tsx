/**
 * Navbar.tsx — 顶部导航栏
 * 银白色调，透明背景，滚动后加深
 */
import { useEffect, useState } from 'react';

const LOGO_URL = 'https://d2xsxph8kpxj0f.cloudfront.net/310519663332343321/eJoLX2GNEf9n3kDr6f2Q7X/jq-logo-transparent_84abe49c.png';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-500"
      style={{
        background: scrolled
          ? 'rgba(10, 10, 15, 0.9)'
          : 'transparent',
        backdropFilter: scrolled ? 'blur(16px)' : 'none',
        borderBottom: scrolled ? '1px solid rgba(255, 255, 255, 0.06)' : 'none',
      }}
    >
      <div className="max-w-7xl mx-auto px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <span
            role="img"
            aria-label="JQ Industries"
            className="block h-8 w-[108px]"
            style={{
              background: 'rgba(255, 255, 255, 0.92)',
              filter: 'drop-shadow(0 0 18px rgba(255, 255, 255, 0.08))',
              maskImage: `url(${LOGO_URL})`,
              maskRepeat: 'no-repeat',
              maskPosition: 'center',
              maskSize: 'contain',
              WebkitMaskImage: `url(${LOGO_URL})`,
              WebkitMaskRepeat: 'no-repeat',
              WebkitMaskPosition: 'center',
              WebkitMaskSize: 'contain',
            }}
          />
        </div>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-8">
          {['技术', '应用', '规格', '合作'].map((item) => (
            <a
              key={item}
              href="#"
              className="text-sm transition-colors duration-300 hover:text-white"
              style={{ color: 'rgba(255, 255, 255, 0.45)' }}
              onClick={(e) => e.preventDefault()}
            >
              {item}
            </a>
          ))}
        </div>

        {/* CTA */}
        <button
          className="px-5 py-2 text-sm font-medium rounded-md transition-all duration-300 hover:bg-white/15"
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            color: 'rgba(255, 255, 255, 0.8)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
          }}
        >
          联系我们
        </button>
      </div>
    </nav>
  );
}
