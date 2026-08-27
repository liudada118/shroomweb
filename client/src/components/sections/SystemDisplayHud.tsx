import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  Activity,
  Cable,
  ChevronDown,
  Gauge,
  PanelTop,
  RadioTower,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import type { SystemSceneKey } from "@/components/effects/SystemScenePreview";
import "./SystemDisplayHud.css";

type SystemDisplayHudProps = {
  scene: SystemSceneKey;
  title: string;
  accent: string;
};

type HudMetric = {
  label: string;
  value: string;
  detail: string;
};

type TrendPoint = {
  index: number;
  response: number;
  coverage: number;
};

type HudConfig = {
  device: string;
  channel: string;
  chartTitle: string;
  primaryLabel: string;
  metrics: HudMetric[];
  phase: number;
  threshold: number;
  settings: [number, number, number];
};

const HUD_CONFIG: Record<SystemSceneKey, HudConfig> = {
  shroom: {
    device: "SHROOM FLEX ARRAY",
    channel: "64 CH / 120 HZ",
    chartTitle: "感知响应趋势",
    primaryLabel: "响应强度",
    metrics: [
      { label: "响应强度", value: "78%", detail: "NORMALIZED" },
      { label: "感知节点", value: "3,600", detail: "POINTS" },
      { label: "响应延迟", value: "18 ms", detail: "ESTIMATE" },
    ],
    phase: 0.2,
    threshold: 78,
    settings: [72, 48, 78],
  },
  care: {
    device: "BED MATRIX / 32×32",
    channel: "1,024 CH / 60 HZ",
    chartTitle: "床面压力与接触面积",
    primaryLabel: "峰值压力",
    metrics: [
      { label: "峰值压力", value: "31.8 kPa", detail: "LIVE PEAK" },
      { label: "接触面积", value: "68%", detail: "BED AREA" },
      { label: "风险状态", value: "稳定", detail: "NO ALERT" },
    ],
    phase: 1.1,
    threshold: 74,
    settings: [68, 62, 74],
  },
  chair: {
    device: "SEAT ARRAY / 24×32",
    channel: "768 CH / 80 HZ",
    chartTitle: "坐姿平衡与分区支撑",
    primaryLabel: "支撑平衡",
    metrics: [
      { label: "支撑平衡", value: "92%", detail: "BALANCED" },
      { label: "激活分区", value: "6 / 8", detail: "ZONES" },
      { label: "调节响应", value: "24 ms", detail: "ESTIMATE" },
    ],
    phase: 2.4,
    threshold: 82,
    settings: [76, 54, 82],
  },
  robot: {
    device: "TACTILE SKIN / 16×16",
    channel: "256 CH / 240 HZ",
    chartTitle: "触觉强度与接触覆盖",
    primaryLabel: "触觉强度",
    metrics: [
      { label: "触觉强度", value: "8.4 N", detail: "FORCE" },
      { label: "活动触点", value: "27", detail: "CONTACTS" },
      { label: "反馈延迟", value: "12 ms", detail: "ESTIMATE" },
    ],
    phase: 3.2,
    threshold: 70,
    settings: [84, 36, 70],
  },
};

const SETTING_LABELS = ["灵敏度", "数据平滑", "报警阈值"];

function createTrendPoint(index: number, phase: number): TrendPoint {
  const response =
    51 +
    Math.sin(index * 0.36 + phase) * 15 +
    Math.sin(index * 0.13 + phase * 0.7) * 7;
  const coverage =
    46 +
    Math.cos(index * 0.27 + phase * 0.6) * 11 +
    Math.sin(index * 0.09) * 5;

  return {
    index,
    response: Math.round(Math.max(8, Math.min(94, response))),
    coverage: Math.round(Math.max(8, Math.min(90, coverage))),
  };
}

function createInitialTrend(phase: number) {
  return Array.from({ length: 34 }, (_, index) =>
    createTrendPoint(index, phase)
  );
}

export default function SystemDisplayHud({
  scene,
  title,
  accent,
}: SystemDisplayHudProps) {
  const config = HUD_CONFIG[scene];
  const frameRef = useRef(34);
  const [trend, setTrend] = useState(() => createInitialTrend(config.phase));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [deviceModalOpen, setDeviceModalOpen] = useState(false);
  const [demoConnected, setDemoConnected] = useState(false);
  const latest = trend.at(-1)?.response ?? 0;
  const gradientId = `system-hud-gradient-${scene}`;

  useEffect(() => {
    frameRef.current = 34;
    setTrend(createInitialTrend(config.phase));

    const interval = window.setInterval(() => {
      const nextPoint = createTrendPoint(frameRef.current, config.phase);
      frameRef.current += 1;
      setTrend(current => [...current.slice(1), nextPoint]);
    }, 460);

    return () => window.clearInterval(interval);
  }, [config.phase]);

  return (
    <div
      className={`system-display-hud ${mobileOpen ? "is-mobile-open" : ""} ${
        deviceModalOpen ? "is-device-modal-open" : ""
      }`}
      style={{ "--system-accent": accent } as CSSProperties}
    >
      <button
        className={`system-device-launch ${demoConnected ? "is-connected" : ""}`}
        type="button"
        onClick={() => setDeviceModalOpen(true)}
      >
        <Cable size={15} aria-hidden="true" />
        <span>{demoConnected ? "演示设备已连接" : "连接设备"}</span>
        <i aria-hidden="true" />
      </button>

      <button
        className="system-hud-mobile-toggle"
        type="button"
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen(open => !open)}
      >
        <PanelTop size={15} aria-hidden="true" />
        <span>{mobileOpen ? "收起监控" : "实时监控"}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>

      <section className="system-data-dock" aria-label="系统实时监控展示">
        <header className="system-data-dock-head">
          <span className="system-data-dock-title">
            <Activity size={14} aria-hidden="true" />
            实时感知控制台
          </span>
          <span className="system-data-dock-source">
            <i aria-hidden="true" />
            SIMULATED LIVE FRAME
          </span>
          <span className="system-data-dock-frame">
            FRAME {String(186 + frameRef.current).padStart(4, "0")}
          </span>
        </header>

        <div className="system-data-dock-body">
          <section className="system-dock-metrics" aria-label="实时摘要">
            <div className="system-dock-section-title">
              <Gauge size={13} aria-hidden="true" />
              <span>实时摘要</span>
            </div>
            <div className="system-dock-metric-grid">
              {config.metrics.map(metric => (
                <div key={metric.label} className="system-dock-metric">
                  <span>{metric.label}</span>
                  <strong>{metric.value}</strong>
                  <small>{metric.detail}</small>
                </div>
              ))}
            </div>
          </section>

          <section className="system-dock-chart" aria-label="实时趋势图示意">
            <div className="system-dock-chart-head">
              <span>{config.chartTitle}</span>
              <span className="system-dock-chart-value">
                <small>{config.primaryLabel}</small>
                <strong>{latest}%</strong>
              </span>
            </div>
            <div className="system-dock-chart-legend" aria-hidden="true">
              <span className="is-response">响应</span>
              <span className="is-coverage">覆盖</span>
            </div>
            <div className="system-dock-chart-canvas">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={trend}
                  margin={{ top: 6, right: 2, bottom: 0, left: -21 }}
                >
                  <defs>
                    <linearGradient
                      id={gradientId}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor={accent}
                        stopOpacity={0.32}
                      />
                      <stop
                        offset="100%"
                        stopColor={accent}
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    vertical={false}
                    stroke="rgba(121, 174, 218, 0.1)"
                    strokeDasharray="2 5"
                  />
                  <XAxis dataKey="index" hide />
                  <YAxis
                    domain={[0, 100]}
                    ticks={[0, 50, 100]}
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fill: "rgba(154, 184, 211, 0.34)",
                      fontSize: 8,
                    }}
                  />
                  <ReferenceLine
                    y={config.threshold}
                    stroke="rgba(255, 148, 111, 0.38)"
                    strokeDasharray="4 5"
                  />
                  <Area
                    type="monotone"
                    dataKey="response"
                    stroke={accent}
                    strokeWidth={1.8}
                    fill={`url(#${gradientId})`}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="coverage"
                    stroke="rgba(188, 220, 242, 0.5)"
                    strokeWidth={1}
                    dot={false}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="system-dock-settings" aria-label="可视化调节示意">
            <div className="system-dock-section-title">
              <SlidersHorizontal size={13} aria-hidden="true" />
              <span>可视化调节</span>
              <small>PRESET A</small>
            </div>
            <div className="system-dock-setting-list">
              {config.settings.map((value, index) => (
                <label
                  key={SETTING_LABELS[index]}
                  className="system-dock-setting"
                >
                  <span>
                    <small>{SETTING_LABELS[index]}</small>
                    <output>{value}%</output>
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={value}
                    disabled
                    aria-label={`${SETTING_LABELS[index]}示意值`}
                    style={
                      { "--setting-progress": `${value}%` } as CSSProperties
                    }
                  />
                </label>
              ))}
            </div>
          </section>
        </div>
      </section>

      {deviceModalOpen && (
        <div
          className="system-device-modal-backdrop"
          role="presentation"
          onMouseDown={event => {
            if (event.target === event.currentTarget) setDeviceModalOpen(false);
          }}
        >
          <section
            className="system-device-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="system-device-modal-title"
          >
            <header className="system-device-modal-head">
              <span>
                <RadioTower size={17} aria-hidden="true" />
                <span>
                  <small>DEVICE CONNECTION</small>
                  <strong id="system-device-modal-title">连接设备</strong>
                </span>
              </span>
              <button
                type="button"
                aria-label="关闭设备连接弹窗"
                onClick={() => setDeviceModalOpen(false)}
              >
                <X size={17} aria-hidden="true" />
              </button>
            </header>

            <div className="system-device-modal-body">
              <div className="system-device-candidate">
                <span className="system-device-candidate-icon">
                  <Sparkles size={18} aria-hidden="true" />
                </span>
                <span>
                  <small>AVAILABLE DEVICE</small>
                  <strong>{config.device}</strong>
                  <em>{config.channel}</em>
                </span>
                <i aria-hidden="true" />
              </div>

              <div className="system-device-modal-fields">
                <label>
                  <span>串口</span>
                  <select defaultValue="COM 03">
                    <option>COM 03</option>
                    <option>COM 05</option>
                  </select>
                </label>
                <label>
                  <span>波特率</span>
                  <select defaultValue="115200">
                    <option>115200</option>
                    <option>230400</option>
                  </select>
                </label>
              </div>

              <p>
                当前仅演示设备连接流程，不读取串口或传感器数据。
              </p>
            </div>

            <footer className="system-device-modal-actions">
              <button type="button" onClick={() => setDeviceModalOpen(false)}>
                取消
              </button>
              <button
                type="button"
                onClick={() => {
                  setDemoConnected(true);
                  setDeviceModalOpen(false);
                }}
              >
                <RadioTower size={15} aria-hidden="true" />
                演示连接
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
