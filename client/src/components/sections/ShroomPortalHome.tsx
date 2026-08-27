import {
  lazy,
  Suspense,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { flushSync } from "react-dom";
import gsap from "gsap";
import { Flip } from "gsap/Flip";
import {
  Activity,
  Armchair,
  BedDouble,
  Bot,
  CarFront,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleGauge,
  Code2,
  FlaskConical,
  Footprints,
  Hand,
  HeartPulse,
  KeyRound,
  MessageCircle,
  PawPrint,
  ScanLine,
  SlidersHorizontal,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import PressureParticleField from "@/components/effects/PressureParticleField";
import type { SystemSceneKey } from "@/components/effects/SystemScenePreview";
import { SHROOM_VISION_LOGO } from "@/assets/shroomVisionLogo";
import "./ShroomPortalHome.css";

gsap.registerPlugin(Flip);

const SystemScenePreview = lazy(
  () => import("@/components/effects/SystemScenePreview")
);
const SystemDisplayHud = lazy(() => import("./SystemDisplayHud"));

type ShroomPortalHomeProps = {
  onOpenJuqiao: () => void;
};

type SystemOption = {
  key: SystemSceneKey;
  index: string;
  eyebrow: string;
  title: string;
  description: string;
  metric: string;
  accent: string;
};

type PortalModule = {
  label: string;
  icon: LucideIcon;
};

type PortalCard = {
  scene: SystemSceneKey;
  theme: string;
  title: string;
  subtitle: string;
  detail: string;
  icon: LucideIcon;
  modules: PortalModule[];
};

const SYSTEM_OPTIONS: SystemOption[] = [
  {
    key: "shroom",
    index: "00",
    eyebrow: "SHROOM CORE",
    title: "感知视觉母体",
    description: "以蘑菇粒子作为所有柔性传感场景的视觉起点。",
    metric: "柔性 / 小点距 / 可死折",
    accent: "#63d5ff",
  },
  {
    key: "care",
    index: "01",
    eyebrow: "CARE SYSTEM",
    title: "床垫实时监控",
    description: "持续识别压力、在离床与异常变化，触发实时报警。",
    metric: "实时监控 / SOS 报警",
    accent: "#3df2a4",
  },
  {
    key: "chair",
    index: "02",
    eyebrow: "CUSTOM SYSTEM",
    title: "座椅实时调节",
    description: "感知坐姿与受力分布，驱动座椅分区支撑实时变化。",
    metric: "姿态识别 / 分区调节",
    accent: "#6f83ff",
  },
  {
    key: "robot",
    index: "03",
    eyebrow: "PRECISION SYSTEM",
    title: "机器人实时感应",
    description: "把触碰、抓握与局部压力转化为机器人的触觉反馈。",
    metric: "触觉感应 / 精密反馈",
    accent: "#ff9f43",
  },
];

const PORTAL_CARDS: PortalCard[] = [
  {
    scene: "care",
    theme: "theme-green",
    title: "康养解决方案",
    subtitle: "聚焦健康管理与智慧养老场景",
    detail: "实时监测心率、呼吸、在离床等数据，与异常预警。",
    icon: HeartPulse,
    modules: [
      { label: "智能床垫", icon: BedDouble },
      { label: "宠物检测", icon: PawPrint },
      { label: "高精密小垫", icon: CircleGauge },
    ],
  },
  {
    scene: "chair",
    theme: "theme-blue",
    title: "座椅定制方案",
    subtitle: "覆盖汽车座椅与人体工学椅场景",
    detail: "采集乘坐姿态与压力分布数据，优化座椅舒适性与安全性。",
    icon: Armchair,
    modules: [
      { label: "汽车座椅", icon: CarFront },
      { label: "人体工学椅", icon: Armchair },
      { label: "自适应座椅", icon: SlidersHorizontal },
    ],
  },
  {
    scene: "robot",
    theme: "theme-orange",
    title: "具身智能方案",
    subtitle: "面向机器人与智能硬件场景",
    detail: "多点触觉感知与力反馈，支持人机交互与精细操作。",
    icon: Bot,
    modules: [
      { label: "触觉手套", icon: Hand },
      { label: "智能鞋垫", icon: Footprints },
      { label: "机器人皮肤", icon: ScanLine },
    ],
  },
  {
    scene: "shroom",
    theme: "theme-cyan",
    title: "定制LAB",
    subtitle: "面向定制需求与方案创新探索",
    detail: "采集足垫压力分布数据，输出一份精准的足垫压力分布报告。",
    icon: FlaskConical,
    modules: [
      { label: "智能足垫", icon: Footprints },
      { label: "智能步道", icon: Activity },
      { label: "握力评估", icon: Hand },
    ],
  },
];

export default function ShroomPortalHome({
  onOpenJuqiao,
}: ShroomPortalHomeProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const portalPageRef = useRef<HTMLElement>(null);
  const selectorRef = useRef<HTMLDivElement>(null);
  const selectorPanelRef = useRef<HTMLDivElement>(null);
  const systemListButtonRef = useRef<HTMLButtonElement>(null);
  const sceneCopyRef = useRef<HTMLDivElement>(null);
  const sharedParticleRootRef = useRef<HTMLDivElement | null>(null);
  const modalTimelineRef = useRef<gsap.core.Timeline | null>(null);
  const particleFlipRef = useRef<gsap.core.Timeline | null>(null);
  const particleReturningRef = useRef(false);
  const toastTimerRef = useRef<number | null>(null);
  const [homeParticleHost, setHomeParticleHost] =
    useState<HTMLDivElement | null>(null);
  const [selectorParticleHost, setSelectorParticleHost] =
    useState<HTMLDivElement | null>(null);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [particleAtSelector, setParticleAtSelector] = useState(false);
  const [sceneExpanded, setSceneExpanded] = useState(false);
  const [activeScene, setActiveScene] = useState<SystemSceneKey>("shroom");
  const [accessKey, setAccessKey] = useState("");
  const [saveKey, setSaveKey] = useState(true);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackContent, setFeedbackContent] = useState("");
  const [toast, setToast] = useState<{
    message: string;
    error: boolean;
  } | null>(null);

  const activeSystem =
    SYSTEM_OPTIONS.find(option => option.key === activeScene) ??
    SYSTEM_OPTIONS[0];

  const showToast = (message: string, error = false) => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToast({ message, error });
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 2400);
  };

  const openSelector = (scene: SystemSceneKey = "care") => {
    const particleRoot = sharedParticleRootRef.current;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const particleState =
      particleRoot && !reduceMotion
        ? Flip.getState(particleRoot, { props: "opacity,filter" })
        : null;

    particleFlipRef.current?.kill();
    particleFlipRef.current = null;
    particleReturningRef.current = false;
    portalPageRef.current?.classList.remove("is-particle-returning");
    selectorPanelRef.current?.classList.remove("is-particle-bridging");

    flushSync(() => {
      setSceneExpanded(false);
      setActiveScene(scene);
      setParticleAtSelector(true);
      setSelectorOpen(true);
    });

    if (!particleState || !particleRoot) return;

    selectorPanelRef.current?.classList.add("is-particle-bridging");
    particleFlipRef.current = Flip.from(particleState, {
      absolute: true,
      duration: 1.08,
      ease: "power3.inOut",
      nested: true,
      scale: true,
      onStart: () => window.dispatchEvent(new Event("resize")),
      onComplete: () => {
        particleFlipRef.current = null;
        selectorPanelRef.current?.classList.remove("is-particle-bridging");
        window.dispatchEvent(new Event("resize"));
      },
    });
  };

  const closeSelector = () => {
    if (!selectorOpen || particleReturningRef.current) return;

    const particleRoot = sharedParticleRootRef.current;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const particleState =
      particleRoot && !reduceMotion
        ? Flip.getState(particleRoot, { props: "opacity,filter" })
        : null;

    particleFlipRef.current?.kill();
    particleFlipRef.current = null;

    if (!particleState || !particleRoot) {
      setParticleAtSelector(false);
      setSelectorOpen(false);
      return;
    }

    particleReturningRef.current = true;
    portalPageRef.current?.classList.add("is-particle-returning");
    selectorPanelRef.current?.classList.add("is-particle-bridging");

    flushSync(() => {
      setParticleAtSelector(false);
      setSelectorOpen(false);
    });

    particleFlipRef.current = Flip.from(particleState, {
      absolute: true,
      duration: 1.08,
      ease: "power3.inOut",
      nested: true,
      scale: true,
      onStart: () => window.dispatchEvent(new Event("resize")),
      onComplete: () => {
        particleFlipRef.current = null;
        particleReturningRef.current = false;
        portalPageRef.current?.classList.remove("is-particle-returning");
        selectorPanelRef.current?.classList.remove("is-particle-bridging");
        window.dispatchEvent(new Event("resize"));
      },
    });
  };

  const switchSystemCamera = (expanded: boolean) => {
    const particleRoot = sharedParticleRootRef.current;
    particleRoot?.dispatchEvent(new Event("system-scene:framing-capture"));
    const beforeRect = particleRoot?.getBoundingClientRect();

    flushSync(() => setSceneExpanded(expanded));
    window.dispatchEvent(new Event("resize"));

    const afterRect = particleRoot?.getBoundingClientRect();
    if (
      particleRoot &&
      beforeRect &&
      afterRect &&
      beforeRect.width > 0 &&
      beforeRect.height > 0 &&
      afterRect.width > 0 &&
      afterRect.height > 0
    ) {
      particleRoot.dispatchEvent(
        new CustomEvent("system-scene:framing-transition", {
          detail: {
            framing: expanded ? "focused" : "preview",
            from: {
              x: beforeRect.x,
              y: beforeRect.y,
              width: beforeRect.width,
              height: beforeRect.height,
            },
            to: {
              x: afterRect.x,
              y: afterRect.y,
              width: afterRect.width,
              height: afterRect.height,
            },
            duration: 1.08,
          },
        })
      );
    }

    window.requestAnimationFrame(() => {
      window.dispatchEvent(new Event("resize"));
      if (expanded) {
        systemListButtonRef.current?.focus();
      } else {
        selectorPanelRef.current
          ?.querySelector<HTMLButtonElement>(".system-option.is-active")
          ?.focus();
      }
    });
  };

  const enterSelectedSystem = () => {
    if (!sceneExpanded) switchSystemCamera(true);
  };

  const returnToSystemList = () => {
    if (sceneExpanded) switchSystemCamera(false);
  };

  const handleEnter = () => {
    try {
      if (saveKey && accessKey.trim()) {
        localStorage.setItem("shroom-home-effects-key", accessKey.trim());
      } else if (!saveKey) {
        localStorage.removeItem("shroom-home-effects-key");
      }
    } catch (_error) {
      // Local storage is optional for this visual prototype.
    }

    window.dispatchEvent(
      new CustomEvent("shroom:enter", {
        detail: { accessKey: accessKey.trim() },
      })
    );
    openSelector("care");
  };

  const handleAccessKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") handleEnter();
  };

  const submitFeedback = () => {
    if (!feedbackContent.trim()) {
      showToast("请先填写反馈内容", true);
      return;
    }
    setFeedbackContent("");
    setFeedbackOpen(false);
    showToast("反馈内容已记录");
  };

  useEffect(() => {
    try {
      setAccessKey(localStorage.getItem("shroom-home-effects-key") ?? "");
    } catch (_error) {
      // Browsers can disable local storage without affecting the page.
    }

    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
      particleFlipRef.current?.kill();
      portalPageRef.current?.classList.remove("is-particle-returning");
    };
  }, []);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    const listenerCleanups: Array<() => void> = [];
    const context = gsap.context(() => {
      const timeline = gsap.timeline({
        defaults: { ease: "power3.out" },
      });

      timeline
        .from(".portal-topbar", {
          y: reduceMotion ? 0 : -18,
          autoAlpha: 0,
          duration: reduceMotion ? 0 : 0.62,
        })
        .from(
          ".portal-hero > *",
          {
            y: reduceMotion ? 0 : 22,
            autoAlpha: 0,
            duration: reduceMotion ? 0 : 0.68,
            stagger: reduceMotion ? 0 : 0.08,
          },
          reduceMotion ? 0 : "-=0.32"
        )
        .from(
          ".portal-access",
          {
            y: reduceMotion ? 0 : 28,
            scale: reduceMotion ? 1 : 0.988,
            autoAlpha: 0,
            duration: reduceMotion ? 0 : 0.78,
          },
          reduceMotion ? 0 : "-=0.4"
        )
        .from(
          ".portal-card",
          {
            y: reduceMotion ? 0 : 30,
            autoAlpha: 0,
            duration: reduceMotion ? 0 : 0.72,
            stagger: reduceMotion ? 0 : 0.085,
          },
          reduceMotion ? 0 : "-=0.44"
        )
        .from(
          ".portal-footer",
          {
            autoAlpha: 0,
            duration: reduceMotion ? 0 : 0.42,
          },
          reduceMotion ? 0 : "-=0.28"
        );

      if (!finePointer || reduceMotion) return;

      gsap.utils.toArray<HTMLElement>(".portal-card").forEach(card => {
        gsap.set(card, {
          transformPerspective: 1100,
          transformOrigin: "50% 50%",
        });
        const rotateX = gsap.quickTo(card, "rotationX", {
          duration: 0.42,
          ease: "power3.out",
        });
        const rotateY = gsap.quickTo(card, "rotationY", {
          duration: 0.42,
          ease: "power3.out",
        });

        const handlePointerMove = (event: PointerEvent) => {
          const bounds = card.getBoundingClientRect();
          const x = (event.clientX - bounds.left) / bounds.width - 0.5;
          const y = (event.clientY - bounds.top) / bounds.height - 0.5;
          rotateX(-y * 5);
          rotateY(x * 5);
        };
        const handlePointerLeave = () => {
          rotateX(0);
          rotateY(0);
        };

        card.addEventListener("pointermove", handlePointerMove);
        card.addEventListener("pointerleave", handlePointerLeave);
        listenerCleanups.push(() => {
          card.removeEventListener("pointermove", handlePointerMove);
          card.removeEventListener("pointerleave", handlePointerLeave);
        });
      });
    }, root);

    return () => {
      listenerCleanups.forEach(cleanup => cleanup());
      context.revert();
    };
  }, []);

  useLayoutEffect(() => {
    const selector = selectorRef.current;
    const panel = selectorPanelRef.current;
    if (!selector || !panel) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const context = gsap.context(() => {
      const listItems = gsap.utils.toArray<HTMLElement>("[data-system-option]");
      const scene = selector.querySelector<HTMLElement>(
        ".system-selector-scene"
      );
      const closeRing =
        selector.querySelector<HTMLElement>(".system-close-ring");
      const closeLineA = selector.querySelector<HTMLElement>(
        ".system-close-line-a"
      );
      const closeLineB = selector.querySelector<HTMLElement>(
        ".system-close-line-b"
      );

      gsap.set(selector, {
        autoAlpha: 0,
        visibility: "hidden",
        pointerEvents: "none",
      });
      gsap.set(panel, { y: reduceMotion ? 0 : 26, scale: 0.985, autoAlpha: 0 });
      gsap.set(listItems, { x: reduceMotion ? 0 : -18, autoAlpha: 0 });
      if (scene) gsap.set(scene, { x: reduceMotion ? 0 : 26, autoAlpha: 0 });
      if (closeRing) gsap.set(closeRing, { scale: 0, rotation: -90 });
      if (closeLineA) gsap.set(closeLineA, { scaleX: 0, rotation: 0 });
      if (closeLineB) gsap.set(closeLineB, { scaleX: 0, rotation: 0 });

      const timeline = gsap.timeline({
        paused: true,
        defaults: { ease: "power3.out" },
        onStart: () => {
          gsap.set(selector, {
            visibility: "visible",
            pointerEvents: "auto",
          });
        },
        onReverseComplete: () => {
          gsap.set(selector, {
            visibility: "hidden",
            pointerEvents: "none",
          });
          if (!particleReturningRef.current) {
            particleFlipRef.current?.kill();
            particleFlipRef.current = null;
            selectorPanelRef.current?.classList.remove("is-particle-bridging");
          }
          setParticleAtSelector(false);
          setSceneExpanded(false);
        },
      });

      timeline
        .to(selector, {
          autoAlpha: 1,
          duration: reduceMotion ? 0 : 0.3,
        })
        .to(
          panel,
          {
            y: 0,
            scale: 1,
            autoAlpha: 1,
            duration: reduceMotion ? 0 : 0.62,
          },
          0
        )
        .to(
          listItems,
          {
            x: 0,
            autoAlpha: 1,
            duration: reduceMotion ? 0 : 0.48,
            stagger: reduceMotion ? 0 : 0.055,
          },
          reduceMotion ? 0 : 0.18
        );

      if (scene) {
        timeline.to(
          scene,
          {
            x: 0,
            autoAlpha: 1,
            duration: reduceMotion ? 0 : 0.58,
          },
          reduceMotion ? 0 : 0.14
        );
      }
      if (closeRing) {
        timeline.to(
          closeRing,
          {
            scale: 1,
            rotation: 0,
            duration: reduceMotion ? 0 : 0.38,
            ease: "back.out(1.7)",
          },
          reduceMotion ? 0 : 0.34
        );
      }
      if (closeLineA && closeLineB) {
        timeline
          .to(
            closeLineA,
            {
              scaleX: 1,
              rotation: 45,
              duration: reduceMotion ? 0 : 0.28,
            },
            reduceMotion ? 0 : 0.48
          )
          .to(
            closeLineB,
            {
              scaleX: 1,
              rotation: -45,
              duration: reduceMotion ? 0 : 0.28,
            },
            reduceMotion ? 0 : 0.52
          );
      }

      modalTimelineRef.current = timeline;
    }, selector);

    return () => {
      modalTimelineRef.current?.kill();
      modalTimelineRef.current = null;
      context.revert();
    };
  }, []);

  useEffect(() => {
    const timeline = modalTimelineRef.current;
    if (!timeline) return;

    if (selectorOpen) {
      timeline.play();
      const frame = window.requestAnimationFrame(() => {
        selectorPanelRef.current?.focus();
      });
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        window.cancelAnimationFrame(frame);
        document.body.style.overflow = previousOverflow;
      };
    }

    timeline.reverse();
  }, [selectorOpen]);

  useLayoutEffect(() => {
    const copy = sceneCopyRef.current;
    if (!copy || !selectorOpen) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const context = gsap.context(() => {
      gsap.fromTo(
        "[data-scene-copy]",
        { y: reduceMotion ? 0 : 10, autoAlpha: 0 },
        {
          y: 0,
          autoAlpha: 1,
          duration: reduceMotion ? 0 : 0.42,
          stagger: reduceMotion ? 0 : 0.055,
          ease: "power3.out",
          overwrite: "auto",
        }
      );
      gsap.fromTo(
        ".system-scene-scan",
        { xPercent: -110, autoAlpha: 0 },
        {
          xPercent: 110,
          autoAlpha: reduceMotion ? 0 : 0.62,
          duration: reduceMotion ? 0 : 0.8,
          ease: "power2.inOut",
        }
      );
    }, copy);

    return () => context.revert();
  }, [activeScene, selectorOpen]);

  return (
    <div ref={rootRef} className="shroom-vision-home">
      <main ref={portalPageRef} className="portal-page">
        <PressureParticleField className="pressure-field" />

        <div
          ref={setHomeParticleHost}
          className="portal-mushroom-ambient"
          aria-hidden="true"
        />

        <header className="portal-topbar">
          <div className="portal-brand">
            <img
              className="portal-logo"
              src={SHROOM_VISION_LOGO}
              alt="SHROOM"
              draggable={false}
            />
            <span className="portal-brand-name">Shroom Vision</span>
          </div>

          <div className="portal-topbar-actions">
            <div className="portal-status" role="status">
              <span className="portal-status-dot" aria-hidden="true" />
              <span>系统已就绪</span>
            </div>
            <button
              className="portal-sdk-button"
              type="button"
              title="SDK 定制"
              onClick={onOpenJuqiao}
            >
              <Code2 className="portal-sdk-icon" size={17} aria-hidden="true" />
              <span>SDK 定制</span>
            </button>
          </div>
        </header>

        <section className="portal-hero">
          <div className="portal-hero-tag">
            <span className="portal-hero-tag-mark" aria-hidden="true">
              <Check size={10} strokeWidth={2.4} />
            </span>
            <span>柔性压力感知 · 全场景解决方案</span>
          </div>
          <h1>Shroom Vision</h1>
          <p className="portal-hero-desc">
            面向康养、汽车、具身智能等行业场景，一站式完成压力可视化展示、动态数据采集与专业报告输出。
          </p>
        </section>

        <section className="portal-access" aria-label="访问密钥">
          <div className="portal-access-title">
            <span className="portal-access-icon" aria-hidden="true">
              <KeyRound size={39} strokeWidth={1.55} />
            </span>
            <h2>访问密钥</h2>
          </div>

          <div className="portal-access-main">
            <input
              value={accessKey}
              onChange={event => setAccessKey(event.target.value)}
              onKeyDown={handleAccessKeyDown}
              type="text"
              autoComplete="off"
              aria-label="访问密钥"
              placeholder="请输入访问密钥（演示可直接进入）"
            />
            <button
              className="portal-enter-button"
              type="button"
              onClick={handleEnter}
              aria-haspopup="dialog"
              aria-expanded={selectorOpen}
            >
              <span>进入系统</span>
              <ChevronRight size={21} aria-hidden="true" />
            </button>
          </div>

          <label className="portal-access-save">
            <input
              type="checkbox"
              checked={saveKey}
              onChange={event => setSaveKey(event.target.checked)}
            />
            <span>保存密钥（下次自动填入）</span>
          </label>
        </section>

        <section className="portal-grid" aria-label="行业方案">
          {PORTAL_CARDS.map(card => {
            const CardIcon = card.icon;
            return (
              <article key={card.title} className={`portal-card ${card.theme}`}>
                <button
                  type="button"
                  className="portal-card-action"
                  onClick={() => openSelector(card.scene)}
                  aria-label={`打开${card.title}粒子场景`}
                >
                  <div className="portal-card-head">
                    <span className="portal-card-icon">
                      <CardIcon
                        className="portal-icon-glyph"
                        size={35}
                        strokeWidth={1.35}
                        aria-hidden="true"
                      />
                    </span>
                    <span className="portal-card-title">
                      <strong>{card.title}</strong>
                      <small>{card.subtitle}</small>
                    </span>
                  </div>
                  <span className="portal-card-divider" />
                  <span className="portal-module-list">
                    {card.modules.map(module => {
                      const ModuleIcon = module.icon;
                      return (
                        <span key={module.label} className="module-row">
                          <span className="module-icon">
                            <ModuleIcon
                              className="portal-icon-glyph"
                              size={24}
                              strokeWidth={1.45}
                              aria-hidden="true"
                            />
                          </span>
                          <span className="module-label">{module.label}</span>
                        </span>
                      );
                    })}
                  </span>
                  <span className="portal-card-detail">{card.detail}</span>
                  <span className="portal-card-hint">
                    <span>查看粒子场景</span>
                    <ChevronRight size={15} aria-hidden="true" />
                  </span>
                </button>
              </article>
            );
          })}
        </section>

        <footer className="portal-footer">
          <span>Shroom Vision</span>
          <span className="portal-footer-dot" aria-hidden="true" />
          <span>© {new Date().getFullYear()} JQ Industries</span>
        </footer>

        <button
          className="feedback-trigger"
          type="button"
          aria-expanded={feedbackOpen}
          onClick={() => setFeedbackOpen(open => !open)}
        >
          <MessageCircle size={18} strokeWidth={1.7} aria-hidden="true" />
          <span>反馈</span>
          <ChevronRight size={16} aria-hidden="true" />
        </button>

        <section
          className={`feedback-panel ${feedbackOpen ? "is-open" : ""}`}
          aria-label="意见反馈"
          aria-hidden={!feedbackOpen}
        >
          <div className="feedback-panel-head">
            <h3>意见反馈</h3>
            <button
              className="feedback-close"
              type="button"
              aria-label="关闭反馈"
              onClick={() => setFeedbackOpen(false)}
            >
              ×
            </button>
          </div>
          <label htmlFor="feedbackContent">反馈内容</label>
          <textarea
            id="feedbackContent"
            value={feedbackContent}
            onChange={event => setFeedbackContent(event.target.value)}
            placeholder="请描述你遇到的问题或建议"
          />
          <button
            className="feedback-submit"
            type="button"
            onClick={submitFeedback}
          >
            提交反馈
          </button>
        </section>

        <div
          className={`toast ${toast ? "is-visible" : ""} ${
            toast?.error ? "is-error" : ""
          }`}
          role="status"
          aria-live="polite"
        >
          {toast?.message}
        </div>
      </main>

      <div
        ref={selectorRef}
        className={`system-selector-backdrop ${
          sceneExpanded ? "is-system-active" : ""
        }`}
        role="presentation"
        onMouseDown={event => {
          if (event.target === event.currentTarget) closeSelector();
        }}
      >
        <div
          ref={selectorPanelRef}
          className={`system-selector-panel ${
            sceneExpanded ? "is-scene-expanded" : ""
          }`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="system-selector-title"
          tabIndex={-1}
          onKeyDown={event => {
            if (event.key !== "Escape") return;
            if (sceneExpanded) {
              returnToSystemList();
            } else {
              closeSelector();
            }
          }}
        >
          <aside className="system-selector-list">
            <div className="system-selector-heading">
              <span className="system-selector-kicker">
                SHROOM SYSTEM INDEX
              </span>
              <h2 id="system-selector-title">选择系统</h2>
              <p>单击系统切换粒子预览，确认后从右侧进入完整展示。</p>
            </div>

            <div
              className="system-options"
              role="listbox"
              aria-label="系统列表"
            >
              {SYSTEM_OPTIONS.map(option => {
                const active = activeScene === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    role="option"
                    aria-selected={active}
                    data-system-option
                    className={`system-option ${active ? "is-active" : ""}`}
                    style={
                      { "--system-accent": option.accent } as CSSProperties
                    }
                    onClick={() => setActiveScene(option.key)}
                  >
                    <span className="system-option-index">{option.index}</span>
                    <span className="system-option-copy">
                      <small>{option.eyebrow}</small>
                      <strong>{option.title}</strong>
                    </span>
                    <span className="system-option-arrow" aria-hidden="true">
                      <ChevronRight size={17} />
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="system-selector-note">
              <Sparkles size={16} strokeWidth={1.5} aria-hidden="true" />
              <span>
                悬停只高亮，单击才切换。列表可独立滚动以容纳更多系统。
              </span>
            </div>
          </aside>

          <section
            className="system-selector-scene"
            aria-label={`${activeSystem.title}粒子场景`}
          >
            <div
              ref={setSelectorParticleHost}
              className="system-scene-particle-host"
              aria-hidden="true"
            />
            <div className="system-scene-grid" aria-hidden="true" />
            <div className="system-scene-vignette" aria-hidden="true" />

            {sceneExpanded && (
              <>
                <div className="system-display-toolbar">
                  <button
                    ref={systemListButtonRef}
                    type="button"
                    className="system-display-back"
                    onClick={returnToSystemList}
                  >
                    <ChevronLeft size={17} aria-hidden="true" />
                    <span>系统列表</span>
                  </button>
                  <div className="system-display-identity">
                    <small>{activeSystem.eyebrow}</small>
                    <strong>{activeSystem.title}</strong>
                  </div>
                </div>

                <Suspense fallback={null}>
                  <SystemDisplayHud
                    scene={activeSystem.key}
                    title={activeSystem.title}
                    accent={activeSystem.accent}
                  />
                </Suspense>
              </>
            )}

            <div
              ref={sceneCopyRef}
              key={activeSystem.key}
              className="system-scene-copy"
              style={
                { "--system-accent": activeSystem.accent } as CSSProperties
              }
            >
              <span className="system-scene-scan" aria-hidden="true" />
              <span data-scene-copy className="system-scene-eyebrow">
                LIVE PARTICLE SCENE / {activeSystem.index}
              </span>
              <h3 data-scene-copy>{activeSystem.title}</h3>
              <p data-scene-copy>{activeSystem.description}</p>
              <span data-scene-copy className="system-scene-metric">
                {activeSystem.metric}
              </span>
              {!sceneExpanded && (
                <button
                  type="button"
                  className="system-scene-enter"
                  onClick={enterSelectedSystem}
                >
                  <span>进入该系统</span>
                  <ChevronRight size={18} aria-hidden="true" />
                </button>
              )}
            </div>

            <div className="system-scene-status" aria-hidden="true">
              <span />
              MORPH ENGINE ONLINE
            </div>
          </section>

          <button
            type="button"
            className="system-selector-close"
            onClick={closeSelector}
            aria-label="关闭系统列表"
          >
            <span className="system-close-ring" />
            <span className="system-close-line system-close-line-a" />
            <span className="system-close-line system-close-line-b" />
          </button>
        </div>
      </div>

      <Suspense fallback={null}>
        <SystemScenePreview
          activeScene={particleAtSelector ? activeScene : "shroom"}
          host={particleAtSelector ? selectorParticleHost : homeParticleHost}
          framing={
            particleAtSelector
              ? sceneExpanded
                ? "focused"
                : "preview"
              : "home"
          }
          onRootReady={root => {
            sharedParticleRootRef.current = root;
          }}
        />
      </Suspense>
    </div>
  );
}
