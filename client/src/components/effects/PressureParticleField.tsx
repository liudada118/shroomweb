import { useEffect, useRef, type CSSProperties } from "react";

type PressureParticleFieldProps = {
  className?: string;
  style?: CSSProperties;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export default function PressureParticleField({
  className,
  style,
}: PressureParticleFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pointer = { x: -1000, y: -1000, active: false };
    let width = 0;
    let height = 0;
    let pixelRatio = 1;
    let animationFrame = 0;
    let isVisible = true;
    let disposed = false;

    const resize = () => {
      const parent = canvas.parentElement ?? canvas;
      const bounds = parent.getBoundingClientRect();
      width = Math.max(1, Math.round(bounds.width || window.innerWidth));
      height = Math.max(1, Math.round(bounds.height || window.innerHeight));
      pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    };

    const draw = (time = 0) => {
      animationFrame = 0;
      if (disposed) return;

      context.clearRect(0, 0, width, height);

      const startY = Math.max(0, height * 0.58);
      const spacing = width < 700 ? 24 : 22;
      const waveX = width * (0.5 + Math.sin(time * 0.00012) * 0.16);
      const waveY = height * (0.88 + Math.cos(time * 0.00016) * 0.04);
      const secondX = width * (0.22 + Math.cos(time * 0.0001) * 0.1);
      const secondY = height * 0.96;

      for (let y = startY; y <= height + spacing; y += spacing) {
        const fade = clamp((y - startY) / Math.max(1, height - startY), 0, 1);
        for (let x = 0; x <= width + spacing; x += spacing) {
          const waveDistance = Math.hypot((x - waveX) * 0.72, y - waveY);
          const secondDistance = Math.hypot((x - secondX) * 0.8, y - secondY);
          const pointerDistance = pointer.active
            ? Math.hypot(x - pointer.x, y - pointer.y)
            : 1000;
          const wave = Math.max(0, 1 - waveDistance / 410);
          const secondWave = Math.max(0, 1 - secondDistance / 300);
          const pointerWave = Math.max(0, 1 - pointerDistance / 220);
          const energy = clamp(
            wave * 0.72 + secondWave * 0.42 + pointerWave * 0.72,
            0,
            1
          );
          const radius = 0.65 + energy * 1.15;
          const alpha = (0.05 + energy * 0.42) * fade;

          context.beginPath();
          context.arc(x, y, radius, 0, Math.PI * 2);
          context.fillStyle = `rgba(${Math.round(35 + energy * 20)}, ${Math.round(
            112 + energy * 84
          )}, 255, ${alpha})`;
          context.fill();
        }
      }

      if (!reducedMotion.matches && isVisible) {
        animationFrame = window.requestAnimationFrame(draw);
      }
    };

    const requestDraw = () => {
      if (animationFrame || reducedMotion.matches || !isVisible) return;
      animationFrame = window.requestAnimationFrame(draw);
    };

    const onPointerMove = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect();
      pointer.x = event.clientX - bounds.left;
      pointer.y = event.clientY - bounds.top;
      pointer.active = true;
    };

    const onPointerLeave = () => {
      pointer.active = false;
    };

    const onMotionChange = () => {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      draw(0);
      requestDraw();
    };

    const resizeObserver = new ResizeObserver(() => {
      resize();
      draw(0);
    });

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting;
        if (isVisible) requestDraw();
      },
      { threshold: 0.01 }
    );

    resizeObserver.observe(canvas.parentElement ?? canvas);
    intersectionObserver.observe(canvas);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("mouseleave", onPointerLeave);
    window.addEventListener("blur", onPointerLeave);
    reducedMotion.addEventListener("change", onMotionChange);

    resize();
    draw(0);
    requestDraw();

    return () => {
      disposed = true;
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("mouseleave", onPointerLeave);
      window.removeEventListener("blur", onPointerLeave);
      reducedMotion.removeEventListener("change", onMotionChange);
      window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={style}
      aria-hidden="true"
    />
  );
}
