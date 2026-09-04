"use client";

import { useEffect, useState } from "react";
import { AVATAR_SLOTS, STATUS_COLOR, STATUS_LABEL, type TaskStatus } from "@/lib/types";
import { Sparkline } from "./charts";

/* Each status carries a distinct SHAPE as well as a colour, so the
   meaning survives colour-blindness, greyscale print and forced-colors. */
export function StatusIcon({ status, size = 12 }: { status: TaskStatus; size?: number }) {
  const c = STATUS_COLOR[status];
  const common = { width: size, height: size, viewBox: "0 0 12 12", "aria-hidden": true as const };
  if (status === "done")
    return (
      <svg {...common}>
        <circle cx="6" cy="6" r="6" fill={c} />
        <path d="M3.3 6.2 L5.2 8.1 L8.8 4.2" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (status === "in-progress")
    return (
      <svg {...common}>
        <circle cx="6" cy="6" r="5.1" fill="none" stroke={c} strokeWidth="1.8" />
        <path d="M6 1.8 A4.2 4.2 0 0 1 6 10.2 Z" fill={c} />
      </svg>
    );
  if (status === "blocked")
    return (
      <svg {...common}>
        <path d="M6 0.4 11.6 6 6 11.6 0.4 6 Z" fill={c} />
        <rect x="5.25" y="2.9" width="1.5" height="3.9" rx="0.7" fill="#fff" />
        <circle cx="6" cy="8.6" r="0.85" fill="#fff" />
      </svg>
    );
  return (
    <svg {...common}>
      <circle cx="6" cy="6" r="5" fill="none" stroke={c} strokeWidth="1.7" strokeDasharray="2.4 2.1" />
    </svg>
  );
}

export function StatusBadge({ status }: { status: TaskStatus }) {
  return (
    <span className="status">
      <StatusIcon status={status} />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function Avatar({
  initials,
  index,
  size = "sm",
  title,
}: {
  initials: string;
  index: number;
  size?: "sm" | "lg";
  title?: string;
}) {
  const bg = AVATAR_SLOTS[index] ?? "var(--text-muted)";
  return (
    <span
      className={size === "lg" ? "avatar lg" : "avatar"}
      style={{ background: bg }}
      title={title}
      aria-hidden={title ? undefined : true}
    >
      {initials}
    </span>
  );
}

export function Card({
  title,
  sub,
  action,
  children,
  bodyClass,
  pad = true,
}: {
  title?: string;
  sub?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  bodyClass?: string;
  pad?: boolean;
}) {
  return (
    <section className="card">
      {title && (
        <div className="card-head" style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 className="card-title">{title}</h2>
            {sub && <p className="card-sub">{sub}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={bodyClass ?? (pad ? "card-body" : "")}>{children}</div>
    </section>
  );
}

export function Tile({
  label,
  value,
  delta,
  deltaLabel,
  spark,
  accent,
  higherIsBetter = true,
}: {
  label: string;
  value: string;
  delta?: number | null;
  deltaLabel?: string;
  spark?: number[];
  accent?: string;
  higherIsBetter?: boolean;
}) {
  const dir = delta == null ? "flat" : delta > 0.5 ? "up" : delta < -0.5 ? "down" : "flat";
  const good = dir === "flat" ? "flat" : (dir === "up") === higherIsBetter ? "up" : "down";
  return (
    <div className="card tile">
      <span className="tile-label">{label}</span>
      <span className="tile-value" style={accent ? { color: accent } : undefined}>
        {value}
      </span>
      <div className="tile-foot">
        {delta != null ? (
          <span className={`delta ${good}`}>
            <span aria-hidden="true">{dir === "up" ? "▲" : dir === "down" ? "▼" : "—"}</span>
            {Math.abs(delta).toFixed(0)}%{deltaLabel ? ` ${deltaLabel}` : ""}
          </span>
        ) : (
          <span className="delta flat">no prior data</span>
        )}
        {spark && spark.length > 1 && <Sparkline values={spark} color={accent ?? "var(--series-1)"} />}
      </div>
    </div>
  );
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);

  useEffect(() => {
    const saved = (typeof localStorage !== "undefined" &&
      localStorage.getItem("gt-theme")) as "light" | "dark" | null;
    if (saved) {
      setTheme(saved);
      document.documentElement.setAttribute("data-theme", saved);
    }
  }, []);

  const toggle = () => {
    const current =
      theme ??
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("gt-theme", next);
    } catch {
      /* storage can be unavailable (private mode, blocked site data) */
    }
  };

  return (
    <button className="icon-btn" onClick={toggle} aria-label="Toggle light and dark theme" title="Toggle theme">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    </button>
  );
}
