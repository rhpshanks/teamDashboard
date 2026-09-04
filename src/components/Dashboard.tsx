"use client";

import { useMemo, useState } from "react";
import { ThemeToggle } from "./ui";
import { LogView, OverviewView, ProjectsView, TeamView, type ViewProps } from "./views";
import { addDays, dateRange, dayDiff, fmtLong, relativeDay } from "@/lib/analytics";
import {
  STATUS_LABEL,
  STATUS_ORDER,
  type DashboardData,
  type TaskStatus,
} from "@/lib/types";

type Tab = "overview" | "team" | "projects" | "log";
type Range = 7 | 14 | 30 | "all";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "team", label: "Team" },
  { id: "projects", label: "Projects" },
  { id: "log", label: "Activity log" },
];

const RANGES: { id: Range; label: string }[] = [
  { id: 7, label: "7 days" },
  { id: 14, label: "14 days" },
  { id: 30, label: "30 days" },
  { id: "all", label: "All" },
];

export default function Dashboard({ data }: { data: DashboardData }) {
  const { meta, members, projects, entries } = data;

  const [tab, setTab] = useState<Tab>("overview");
  const [range, setRange] = useState<Range>(14);
  const [memberId, setMemberId] = useState("all");
  const [projectId, setProjectId] = useState("all");
  const [status, setStatus] = useState<TaskStatus | "all">("all");
  const [q, setQ] = useState("");
  const [logMode, setLogMode] = useState<"feed" | "table">("feed");

  const today = meta.asOf;

  /* The freshness pill reports how current the DATA is, not what asOf was set
     to — "updated today" would be a lie on a day nobody logged anything. */
  const latestEntry = useMemo(
    () => entries.reduce((a, e) => (e.date > a ? e.date : a), ""),
    [entries]
  );
  const earliest = useMemo(
    () => entries.reduce((a, e) => (e.date < a ? e.date : a), today),
    [entries, today]
  );

  const spanDays = range === "all" ? Math.max(1, dayDiff(today, earliest) + 1) : range;
  const from = addDays(today, -(spanDays - 1));
  const days = useMemo(() => dateRange(from, today), [from, today]);

  const prevTo = addDays(from, -1);
  const prevFrom = addDays(prevTo, -(spanDays - 1));

  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (e: (typeof entries)[number]) => {
      if (memberId !== "all" && e.memberId !== memberId) return false;
      if (projectId !== "all" && e.projectId !== projectId) return false;
      if (status !== "all" && e.status !== status) return false;
      if (needle) {
        const proj = projects.find((p) => p.id === e.projectId);
        const mem = members.find((m) => m.id === e.memberId);
        const hay = `${e.title} ${proj?.name ?? ""} ${mem?.name ?? ""} ${e.note ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    };
  }, [memberId, projectId, status, q, projects, members]);

  const sorted = useMemo(
    () => entries.slice().sort((a, b) => (a.date === b.date ? (a.id < b.id ? -1 : 1) : a.date < b.date ? 1 : -1)),
    [entries]
  );

  const filtered = useMemo(
    () => sorted.filter((e) => e.date >= from && e.date <= today && matches(e)),
    [sorted, from, today, matches]
  );

  const prevFiltered = useMemo(
    () => sorted.filter((e) => e.date >= prevFrom && e.date <= prevTo && matches(e)),
    [sorted, prevFrom, prevTo, matches]
  );

  const memberIndex = useMemo(
    () => new Map(members.map((m, i) => [m.id, i])),
    [members]
  );

  const activeProjects = useMemo(() => {
    const used = new Set(entries.map((e) => e.projectId));
    return projects.filter((p) => used.has(p.id));
  }, [entries, projects]);

  const dirty = memberId !== "all" || projectId !== "all" || status !== "all" || q !== "";

  const viewProps: ViewProps = {
    entries: filtered,
    prevEntries: prevFiltered,
    members,
    projects,
    days,
    today,
    memberIndex,
    activeProject: projectId,
    activeMember: memberId,
    onSelectProject: (id) => setProjectId((cur) => (cur === id ? "all" : id)),
    onSelectMember: (id) => setMemberId((cur) => (cur === id ? "all" : id)),
    goToTable: () => {
      setLogMode("table");
      setTab("log");
    },
  };

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              GT
            </span>
            <div>
              <div className="brand-title">
                {meta.studio} · {meta.boardTitle}
              </div>
              <div className="brand-sub">Daily visibility across every project</div>
            </div>
          </div>

          <div className="topbar-spacer" />

          {meta.sampleData && <span className="sample-pill">Sample data</span>}

          <span className="freshness" title={`Most recent entry: ${fmtLong(latestEntry)}`}>
            <span className="pulse" aria-hidden="true" />
            Data through {relativeDay(latestEntry, today).toLowerCase()} · {fmtLong(latestEntry)}
          </span>

          <nav className="tabs" role="tablist" aria-label="Dashboard sections">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                className="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </nav>

          <ThemeToggle />
        </div>
      </header>

      <main className="shell">
        <div className="filterbar">
          <div className="seg" role="group" aria-label="Date range">
            {RANGES.map((r) => (
              <button
                key={String(r.id)}
                aria-pressed={range === r.id}
                onClick={() => setRange(r.id)}
              >
                {r.label}
              </button>
            ))}
          </div>

          <select
            className="control"
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
            aria-label="Filter by person"
          >
            <option value="all">Everyone</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>

          <select
            className="control"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            aria-label="Filter by project"
          >
            <option value="all">All projects</option>
            {activeProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.short}
              </option>
            ))}
          </select>

          <select
            className="control"
            value={status}
            onChange={(e) => setStatus(e.target.value as TaskStatus | "all")}
            aria-label="Filter by status"
          >
            <option value="all">Any status</option>
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>

          <input
            className="control search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search tasks…"
            aria-label="Search tasks"
            type="search"
          />

          {dirty && (
            <button
              className="link-btn"
              onClick={() => {
                setMemberId("all");
                setProjectId("all");
                setStatus("all");
                setQ("");
              }}
            >
              Clear filters
            </button>
          )}

          <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-muted)" }}>
            {filtered.length} of {entries.length} tasks
          </span>
        </div>

        {tab === "overview" && <OverviewView {...viewProps} />}
        {tab === "team" && <TeamView {...viewProps} />}
        {tab === "projects" && <ProjectsView {...viewProps} />}
        {tab === "log" && <LogView {...viewProps} mode={logMode} setMode={setLogMode} />}

        <footer className="footer">
          <span>
            {meta.studio} — showing {days.length} days ending {fmtLong(today)}.
          </span>
          <span>Data lives in /data · edit the JSON and push to update this board.</span>
        </footer>
      </main>
    </>
  );
}
