/**
 * Footer.tsx — 页脚
 * 极简、暗底、银白色调
 */
export default function Footer() {
  return (
    <footer
      className="relative py-16 overflow-hidden"
      style={{
        background: '#0a0a0f',
        borderTop: '1px solid rgba(255, 255, 255, 0.05)',
      }}
    >
      <div className="max-w-7xl mx-auto px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div
                className="w-7 h-7 rounded-md flex items-center justify-center"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 7H12M7 2V12M4 4L10 10M10 4L4 10" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
                </svg>
              </div>
              <span
                className="text-sm font-semibold tracking-wide"
                style={{
                  color: '#ffffff',
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                FiberSense
              </span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'rgba(255, 255, 255, 0.3)' }}>
              压阻式纤维压力传感方案，面向可穿戴、智能纺织与柔性电子场景。
            </p>
          </div>

          {/* Links */}
          <div>
            <h5
              className="text-xs tracking-[0.15em] uppercase mb-4"
              style={{
                color: 'rgba(255, 255, 255, 0.35)',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              产品
            </h5>
            <div className="space-y-2.5">
              {['技术方案', '应用场景', '技术规格', '开发文档'].map((item) => (
                <a
                  key={item}
                  href="#"
                  className="block text-sm transition-colors duration-300 hover:text-white"
                  style={{ color: 'rgba(255, 255, 255, 0.35)' }}
                  onClick={(e) => e.preventDefault()}
                >
                  {item}
                </a>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div>
            <h5
              className="text-xs tracking-[0.15em] uppercase mb-4"
              style={{
                color: 'rgba(255, 255, 255, 0.35)',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              联系
            </h5>
            <div className="space-y-2.5">
              {['获取样品', '预约沟通', '技术咨询', '商务合作'].map((item) => (
                <a
                  key={item}
                  href="#"
                  className="block text-sm transition-colors duration-300 hover:text-white"
                  style={{ color: 'rgba(255, 255, 255, 0.35)' }}
                  onClick={(e) => e.preventDefault()}
                >
                  {item}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          className="mt-16 pt-6 flex flex-col md:flex-row items-center justify-between gap-4"
          style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}
        >
          <p
            className="text-xs"
            style={{
              color: 'rgba(255, 255, 255, 0.2)',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            &copy; 2026 FiberSense. All rights reserved.
          </p>
          <p
            className="text-xs"
            style={{
              color: 'rgba(255, 255, 255, 0.12)',
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            Piezoresistive Fiber Pressure Sensing Technology
          </p>
        </div>
      </div>
    </footer>
  );
}
