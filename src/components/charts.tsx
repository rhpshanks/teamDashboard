"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DayPoint } from "@/lib/analytics";
import { fmtLong, fmtShort, hoursFmt, isWeekend } from "@/lib/analytics";
import { STATUS_COLOR, STATUS_LABEL, type TaskStatus } from "@/lib/types";
import { StatusIcon } from "./ui";

/* Measures a container so SVG text renders at true pixel size
   (never via preserveAspectRatio stretching). */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setW(entry.contentRect.width));
    ro.observe(el);
    setW(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function niceMax(v: number): number {
  if (v <= 5) return Math.max(v, 4);
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const norm = v / pow;
  const step = norm <= 1.5 ? 1.5 : norm <= 2 ? 2 : norm <= 3 ? 3 : norm <= 5 ? 5 : 10;
  return step * pow;
}

/* ============================================================
   Trend — tasks logged per day. One series, one axis.
   ============================================================ */

export function TrendChart({
  points,
  height = 216,
  metric = "tasks",
  showHours = true,
}: {
  points: DayPoint[];
  height?: number;
  metric?: "tasks" | "hours";
  /** Hidden when no entry in range records hours. */
  showHours?: boolean;
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const padL = 36;
  const padR = 14;
  const padT = 14;
  const padB = 24;
  const iw = Math.max(10, w - padL - padR);
  const ih = height - padT - padB;

  const values = points.map((p) => (metric === "tasks" ? p.tasks : p.hours));
  const max = niceMax(Math.max(1, ...values));
  const n = points.length;

  const x = useCallback(
    (i: number) => padL + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw),
    [iw, n]
  );
  const y = useCallback((v: number) => padT + ih - (v / max) * ih, [ih, max]);

  const onMove = (ev: React.MouseEvent<SVGSVGElement>) => {
    const rect = ev.currentTarget.getBoundingClientRect();
    const px = ev.clientX - rect.left;
    const i = Math.round(((px - padL) / (iw || 1)) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  };

  if (w === 0) return <div ref={ref} style={{ height }} />;

  const line = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(values[i]).toFixed(1)}`)
    .join(" ");
  const area = `${line} L${x(n - 1).toFixed(1)},${(padT + ih).toFixed(1)} L${x(0).toFixed(
    1
  )},${(padT + ih).toFixed(1)} Z`;

  const ticks = [0, max / 2, max];
  const labelEvery = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 74))));
  const hp = hover !== null ? points[hover] : null;

  return (
    <div className="chart-wrap" ref={ref}>
      <svg
        width={w}
        height={height}
        role="img"
        aria-label={`Daily ${metric} logged, ${fmtShort(points[0].date)} to ${fmtShort(
          points[n - 1].date
        )}`}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        {ticks.map((t, i) => (
          <g key={i}>
            <line
              x1={padL}
              x2={padL + iw}
              y1={y(t)}
              y2={y(t)}
              stroke={i === 0 ? "var(--axis)" : "var(--grid)"}
              strokeWidth={1}
            />
            <text className="tick" x={padL - 8} y={y(t) + 3.5} textAnchor="end">
              {t % 1 === 0 ? t : t.toFixed(1)}
            </text>
          </g>
        ))}

        {/* weekend shading — recessive, tells you why the line dips */}
        {points.map((p, i) =>
          isWeekend(p.date) ? (
            <rect
              key={p.date}
              x={x(i) - (iw / Math.max(1, n - 1)) / 2}
              y={padT}
              width={iw / Math.max(1, n - 1)}
              height={ih}
              fill="var(--wash)"
            />
          ) : null
        )}

        <path d={area} fill="var(--series-1)" opacity={0.1} />
        <path
          d={line}
          fill="none"
          stroke="var(--series-1)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {hover !== null && (
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1={padT}
            y2={padT + ih}
            stroke="var(--axis)"
            strokeWidth={1}
          />
        )}

        {/* end marker, and the hovered point, both with a 2px surface ring */}
        <circle
          cx={x(n - 1)}
          cy={y(values[n - 1])}
          r={4}
          fill="var(--series-1)"
          stroke="var(--surface-1)"
          strokeWidth={2}
        />
        {hover !== null && hover !== n - 1 && (
          <circle
            cx={x(hover)}
            cy={y(values[hover])}
            r={4}
            fill="var(--series-1)"
            stroke="var(--surface-1)"
            strokeWidth={2}
          />
        )}

        {points.map((p, i) =>
          i % labelEvery === 0 || i === n - 1 ? (
            <text
              key={p.date}
              className="tick"
              x={x(i)}
              y={height - 6}
              textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
            >
              {fmtShort(p.date)}
            </text>
          ) : null
        )}
      </svg>

      {hp && (
        <div
          className="tooltip"
          style={{ left: Math.max(74, Math.min(w - 74, x(hover!))), top: y(values[hover!]) }}
        >
          <div className="tooltip-title">{fmtLong(hp.date)}</div>
          <div className="tooltip-row">
            <span className="tooltip-key">
              <span className="legend-key" style={{ background: "var(--series-1)" }} />
              Tasks logged
            </span>
            <b>{hp.tasks}</b>
          </div>
          {showHours && (
            <div className="tooltip-row">
              <span>Hours</span>
              <b>{hoursFmt(hp.hours)}</b>
            </div>
          )}
          <div className="tooltip-row">
            <span>People active</span>
            <b>{hp.people}</b>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Bar list — magnitude with identity carried by the row label,
   so every bar wears one hue (never a rainbow of ranks).
   ============================================================ */

export interface BarDatum {
  id: string;
  label: string;
  value: number;
  sub?: string;
}

export function BarList({
  data,
  unit = "h",
  onSelect,
  activeId,
  labelWidth = 132,
}: {
  data: BarDatum[];
  unit?: string;
  onSelect?: (id: string) => void;
  activeId?: string | null;
  labelWidth?: number;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (!data.length) return <div className="empty">Nothing in this range.</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      {data.map((d) => {
        const pct = (d.value / max) * 100;
        const on = activeId === d.id;
        const Tag = onSelect ? "button" : "div";
        return (
          <Tag
            key={d.id}
            {...(onSelect
              ? { onClick: () => onSelect(d.id), type: "button" as const }
              : {})}
            title={onSelect ? `Filter to ${d.label}` : undefined}
            style={{
              display: "grid",
              gridTemplateColumns: `${labelWidth}px 1fr 46px`,
              alignItems: "center",
              gap: 10,
              background: on ? "var(--wash)" : "transparent",
              border: 0,
              borderRadius: 7,
              padding: "3px 6px 3px 4px",
              margin: "0 -6px 0 -4px",
              cursor: onSelect ? "pointer" : "default",
              textAlign: "left",
              width: "calc(100% + 10px)",
              font: "inherit",
              color: "inherit",
            }}
          >
            <span
              style={{
                fontSize: 12.5,
                fontWeight: on ? 650 : 500,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {d.label}
            </span>
            <span
              style={{
                display: "block",
                height: 18,
                background: "var(--surface-sunk)",
                borderRadius: 4,
                overflow: "hidden",
              }}
            >
              <span
                style={{
                  display: "block",
                  height: "100%",
                  width: `${Math.max(pct, 1.5)}%`,
                  background: "var(--series-1)",
                  borderRadius: "0 4px 4px 0",
                  transition: "width 0.3s ease",
                }}
              />
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--text-2)",
                fontVariantNumeric: "tabular-nums",
                textAlign: "right",
              }}
            >
              {d.value % 1 === 0 ? d.value : d.value.toFixed(1)}
              <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>{unit}</span>
            </span>
          </Tag>
        );
      })}
    </div>
  );
}

/* ============================================================
   Status mix — one 100% stacked bar, 2px surface gaps,
   legend carries icon + label so colour never stands alone.
   ============================================================ */

export function StatusMix({
  split,
  total,
}: {
  split: { status: TaskStatus; count: number; pct: number }[];
  total: number;
}) {
  const [hover, setHover] = useState<TaskStatus | null>(null);
  if (!total) return <div className="empty">Nothing in this range.</div>;

  return (
    <div className="chart-wrap">
      <div style={{ display: "flex", gap: 2, height: 30 }}>
        {split.map((s, i) => (
          <div
            key={s.status}
            onMouseEnter={() => setHover(s.status)}
            onMouseLeave={() => setHover(null)}
            title={`${STATUS_LABEL[s.status]}: ${s.count} (${s.pct.toFixed(0)}%)`}
            style={{
              width: `${s.pct}%`,
              background: STATUS_COLOR[s.status],
              borderRadius:
                split.length === 1
                  ? 4
                  : i === 0
                    ? "4px 0 0 4px"
                    : i === split.length - 1
                      ? "0 4px 4px 0"
                      : 0,
              display: "grid",
              placeItems: "center",
              opacity: hover && hover !== s.status ? 0.55 : 1,
              transition: "opacity 0.15s",
              minWidth: 3,
            }}
          >
            {s.pct >= 11 && (
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 650,
                  color: s.status === "scheduled" ? "var(--text-1)" : "#fff",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {s.pct.toFixed(0)}%
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="legend">
        {split.map((s) => (
          <span className="legend-item" key={s.status}>
            <StatusIcon status={s.status} />
            {STATUS_LABEL[s.status]}
            <b style={{ color: "var(--text-1)", fontVariantNumeric: "tabular-nums" }}>
              {s.count}
            </b>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   Heatmap — sequential blue ramp, magnitude = hours logged.
   ============================================================ */

const RAMP = [
  "var(--surface-sunk)",
  "var(--seq-100)",
  "var(--seq-200)",
  "var(--seq-400)",
  "var(--seq-500)",
  "var(--seq-600)",
];

/** Normalise against the 90th percentile rather than the single busiest cell,
 *  so one 14-hour outlier doesn't flatten every ordinary day into one shade. */
export function heatScaleMax(values: number[]): number {
  const nonZero = values.filter((v) => v > 0).sort((a, b) => a - b);
  if (!nonZero.length) return 1;
  return nonZero[Math.min(nonZero.length - 1, Math.floor(nonZero.length * 0.9))];
}

export function rampStep(hours: number, max: number): number {
  if (hours <= 0) return 0;
  const r = hours / (max || 1);
  if (r <= 0.25) return 1;
  if (r <= 0.5) return 2;
  if (r <= 0.75) return 3;
  if (r < 1) return 4;
  return 5;
}

/** Date ticks that line up with the heat cells above them. */
export function HeatAxis({ days }: { days: string[] }) {
  const step = Math.max(1, Math.ceil(days.length / 8));
  return (
    <div className="heat-row" aria-hidden="true">
      {days.map((d, i) => (
        <div
          key={d}
          style={{
            flex: "1 1 0",
            minWidth: 5,
            textAlign: "center",
            fontSize: 10.5,
            color: "var(--text-muted)",
            whiteSpace: "nowrap",
            overflow: "visible",
          }}
        >
          {i % step === 0 ? fmtShort(d) : ""}
        </div>
      ))}
    </div>
  );
}

export function HeatRow({
  values,
  days,
  max,
  unit = "h",
  onHover,
}: {
  values: number[];
  days: string[];
  max: number;
  /** "h" when hours are recorded, "" when the cells count tasks instead. */
  unit?: string;
  onHover?: (i: number | null) => void;
}) {
  const describe = (v: number) => {
    if (v <= 0) return "no activity";
    if (unit) return `${hoursFmt(v)}${unit} logged`;
    return `${v} task${v === 1 ? "" : "s"} logged`;
  };
  return (
    <div className="heat-row" onMouseLeave={() => onHover?.(null)}>
      {values.map((v, i) => (
        <div
          key={days[i]}
          className="heat-cell"
          onMouseEnter={() => onHover?.(i)}
          title={`${fmtLong(days[i])} — ${describe(v)}`}
          style={{ background: RAMP[rampStep(v, max)] }}
        />
      ))}
    </div>
  );
}

export function HeatScale({ label = "more hours" }: { label?: string }) {
  return (
    <div className="heat-scale">
      <span style={{ background: RAMP[0], border: "1px solid var(--border)" }} />
      {RAMP.slice(1).map((c, i) => (
        <span key={i} style={{ background: c }} />
      ))}
      <span style={{ width: "auto", marginLeft: 4 }}>{label}</span>
    </div>
  );
}

/* ============================================================
   Sparkline — 12-point trend inside a stat tile.
   ============================================================ */

export function Sparkline({
  values,
  w = 92,
  h = 26,
  color = "var(--series-1)",
}: {
  values: number[];
  w?: number;
  h?: number;
  color?: string;
}) {
  if (values.length < 2) return null;
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => {
    const px = (i / (values.length - 1)) * (w - 6) + 3;
    const py = h - 3 - (v / max) * (h - 6);
    return [px, py] as const;
  });
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg width={w} height={h} aria-hidden="true" style={{ display: "block", flex: "none" }}>
      <path
        d={`${d} L${last[0].toFixed(1)},${h} L3,${h} Z`}
        fill={color}
        opacity={0.1}
      />
      <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r={2.75} fill={color} stroke="var(--surface-1)" strokeWidth={2} />
    </svg>
  );
}
