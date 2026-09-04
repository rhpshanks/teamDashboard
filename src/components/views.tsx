"use client";

import { useMemo, useState } from "react";
import {
  BarList,
  HeatAxis,
  HeatRow,
  HeatScale,
  heatScaleMax,
  Sparkline,
  StatusMix,
  TrendChart,
  type BarDatum,
} from "./charts";
import { Avatar, Card, StatusBadge, StatusIcon, Tile } from "./ui";
import {
  byDay,
  compact,
  fmtLong,
  hasHours,
  hoursFmt,
  pctChange,
  relativeDay,
  rollupMembers,
  rollupProjects,
  statusSplit,
  sumBy,
} from "@/lib/analytics";
import {
  CATEGORY_LABEL,
  STATUS_LABEL,
  STATUS_ORDER,
  STATUS_COLOR,
  type Category,
  type Entry,
  type Member,
  type Project,
  type TaskStatus,
} from "@/lib/types";

export interface ViewProps {
  entries: Entry[];
  prevEntries: Entry[];
  members: Member[];
  projects: Project[];
  days: string[];
  today: string;
  memberIndex: Map<string, number>;
  onSelectProject: (id: string) => void;
  onSelectMember: (id: string) => void;
  activeProject: string;
  activeMember: string;
  goToTable: () => void;
}

const memberOf = (members: Member[], id: string) => members.find((m) => m.id === id);
const projectOf = (projects: Project[], id: string) => projects.find((p) => p.id === id);

/* ============================================================
   Overview
   ============================================================ */

export function OverviewView(p: ViewProps) {
  const { entries, prevEntries, members, projects, days, today } = p;

  /* Daily updates usually arrive as prose with no time tracking, so effort is
     measured in tasks unless hours were actually recorded. */
  const useHours = hasHours(entries);
  const effortOf = (tasks: number, hrs: number) => (useHours ? hrs : tasks);
  const unit = useHours ? "h" : "";
  const effortWord = useHours ? "Hours" : "Tasks";

  const series = useMemo(() => byDay(entries, days), [entries, days]);

  const latestDay = useMemo(() => {
    const dates = entries.map((e) => e.date);
    return dates.length ? dates.reduce((a, b) => (a > b ? a : b)) : today;
  }, [entries, today]);

  const todayEntries = entries.filter((e) => e.date === latestDay);
  const todayPeople = [...new Set(todayEntries.map((e) => e.memberId))];
  const todayProjects = [...new Set(todayEntries.map((e) => e.projectId))];

  const worked = entries.filter((e) => e.status === "worked").length;
  const prevWorked = prevEntries.filter((e) => e.status === "worked").length;
  const hours = entries.reduce((s, e) => s + (e.hours ?? 0), 0);
  const prevHours = prevEntries.reduce((s, e) => s + (e.hours ?? 0), 0);
  const blockers = entries.filter((e) => e.status === "blocked");
  const prevBlockers = prevEntries.filter((e) => e.status === "blocked").length;
  const activeProjects = new Set(entries.map((e) => e.projectId)).size;
  const prevActiveProjects = new Set(prevEntries.map((e) => e.projectId)).size;

  const projectBars: BarDatum[] = useMemo(() => {
    const rolls = rollupProjects(entries, projects);
    const top = rolls.slice(0, 9);
    const rest = rolls.slice(9);
    const bars = top.map((r) => ({
      id: r.project.id,
      label: r.project.short,
      value: effortOf(r.tasks, r.hours),
    }));
    if (rest.length) {
      bars.push({
        id: "__other",
        label: `Other (${rest.length} project${rest.length > 1 ? "s" : ""})`,
        value:
          Math.round(rest.reduce((s, r) => s + effortOf(r.tasks, r.hours), 0) * 10) / 10,
      });
    }
    return bars;
  }, [entries, projects, useHours]);

  const disciplineBars: BarDatum[] = useMemo(() => {
    const m = sumBy(entries, (e) => e.category, (e) => (useHours ? (e.hours ?? 0) : 1));
    return [...m.entries()]
      .map(([k, v]) => ({
        id: k,
        label: CATEGORY_LABEL[k as Category] ?? k,
        value: Math.round(v * 10) / 10,
      }))
      .sort((a, b) => b.value - a.value);
  }, [entries, useHours]);

  /* Person-days actually worked — averaging over the whole team × every
     calendar day would understate the load with weekends in the range. */
  const personDays = useMemo(
    () => new Set(entries.map((e) => `${e.date}|${e.memberId}`)).size,
    [entries]
  );

  const split = statusSplit(entries);
  const sparkTasks = series.slice(-12).map((d) => d.tasks);
  const sparkHours = series.slice(-12).map((d) => d.hours);
  const sparkBlockers = useMemo(() => {
    const m = new Map(days.map((d) => [d, 0]));
    for (const e of entries) if (e.status === "blocked") m.set(e.date, (m.get(e.date) ?? 0) + 1);
    return days.slice(-12).map((d) => m.get(d) ?? 0);
  }, [entries, days]);

  return (
    <div className="stack">
      {/* ---- hero: the single big number for this view ---- */}
      <div className="card hero">
        <div>
          <span className="hero-label">{relativeDay(latestDay, today)}</span>
          <div className="hero-figure">{todayEntries.length}</div>
          <div className="hero-line">
            {todayEntries.length === 0
              ? "No activity logged yet."
              : `tasks logged by ${todayPeople.length} ${
                  todayPeople.length === 1 ? "person" : "people"
                } across ${todayProjects.length} project${todayProjects.length === 1 ? "" : "s"}`}
          </div>
        </div>

        <div className="hero-divider" aria-hidden="true" />

        <div className="hero-copy">
          <span className="hero-label">Who worked</span>
          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            {todayPeople.length === 0 && <span className="hero-line">Nobody logged in yet</span>}
            {todayPeople.map((id) => {
              const m = memberOf(members, id);
              if (!m) return null;
              const mine = todayEntries.filter((e) => e.memberId === id);
              return (
                <button
                  key={id}
                  className="chip"
                  onClick={() => p.onSelectMember(id)}
                  title={`${m.name} — ${mine.length} task${
                    mine.length === 1 ? "" : "s"
                  }${
                    useHours
                      ? `, ${hoursFmt(mine.reduce((s, e) => s + (e.hours ?? 0), 0))}h`
                      : ""
                  }`}
                  style={{ paddingLeft: 3 }}
                >
                  <Avatar
                    initials={m.initials}
                    index={p.memberIndex.get(m.id) ?? 0}
                    title={m.name}
                  />
                  {m.name}
                  <b style={{ color: "var(--text-1)" }}>{mine.length}</b>
                </button>
              );
            })}
          </div>
        </div>

        {blockers.length > 0 && (
          <>
            <div className="hero-divider" aria-hidden="true" />
            <div className="hero-copy">
              <span className="hero-label">Needs attention</span>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginTop: 8,
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                <StatusIcon status="blocked" size={14} />
                {blockers.length} blocked task{blockers.length === 1 ? "" : "s"}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ---- stat tiles ---- */}
      <div className="grid g-tiles">
        <Tile
          label="Tasks worked"
          value={compact(worked)}
          delta={pctChange(worked, prevWorked)}
          deltaLabel="vs previous period"
          spark={sparkTasks}
        />
        <Tile
          label={useHours ? "Hours logged" : "Tasks logged"}
          value={compact(useHours ? Math.round(hours) : entries.length)}
          delta={
            useHours
              ? pctChange(hours, prevHours)
              : pctChange(entries.length, prevEntries.length)
          }
          deltaLabel="vs previous period"
          spark={useHours ? sparkHours : sparkTasks}
        />
        <Tile
          label="Projects touched"
          value={String(activeProjects)}
          delta={pctChange(activeProjects, prevActiveProjects)}
          deltaLabel="vs previous period"
        />
        <Tile
          label="Open blockers"
          value={String(blockers.length)}
          delta={pctChange(blockers.length, prevBlockers)}
          deltaLabel="vs previous period"
          higherIsBetter={false}
          accent={blockers.length ? "var(--st-critical)" : undefined}
          spark={sparkBlockers}
        />
      </div>

      {/* ---- trend + status mix ---- */}
      <div className="grid g-2">
        <Card
          title="Daily activity"
          sub="Tasks logged per day. Shaded columns are weekends."
          action={
            <button className="link-btn" onClick={p.goToTable}>
              View as table
            </button>
          }
        >
          <TrendChart points={series} showHours={useHours} />
        </Card>

        <Card title="Status mix" sub={`Across ${entries.length} logged tasks`}>
          <StatusMix split={split} total={entries.length} />

          <div
            className="metric-row"
            style={{
              marginTop: 18,
              paddingTop: 16,
              borderTop: "1px solid var(--border)",
              justifyContent: "space-between",
            }}
          >
            <div className="metric">
              <span className="metric-v">
                {entries.length ? Math.round((worked / entries.length) * 100) : 0}%
              </span>
              <span className="metric-l">worked</span>
            </div>
            <div className="metric">
              <span className="metric-v">{(entries.length / days.length).toFixed(1)}</span>
              <span className="metric-l">tasks logged per day</span>
            </div>
            <div className="metric">
              <span className="metric-v">
                {personDays
                  ? hoursFmt(
                      Math.round(
                        ((useHours ? hours : entries.length) / personDays) * 10
                      ) / 10
                    )
                  : "—"}
              </span>
              <span className="metric-l">
                {useHours ? "hours" : "tasks"} per person per day
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* ---- where the effort went ---- */}
      <div className="grid g-halves">
        <Card
          title="Effort by project"
          sub={`${effortWord} logged — click a row to filter the board`}
        >
          <BarList
            data={projectBars}
            unit={unit}
            onSelect={(id) => id !== "__other" && p.onSelectProject(id)}
            activeId={p.activeProject === "all" ? null : p.activeProject}
          />
        </Card>
        <Card title="Effort by discipline" sub={`${effortWord} logged`}>
          <BarList data={disciplineBars} unit={unit} labelWidth={104} />
        </Card>
      </div>

      {/* ---- blockers ---- */}
      {blockers.length > 0 && (
        <Card
          title="Blocked — needs a decision or an unblock"
          sub={`${blockers.length} task${blockers.length === 1 ? "" : "s"} waiting`}
          pad={false}
        >
          <div className="feed">
            {blockers
              .slice()
              .sort((a, b) => (a.date < b.date ? 1 : -1))
              .map((e) => (
                <EntryRow key={e.id} e={e} {...p} showDate />
              ))}
          </div>
        </Card>
      )}

      {/* ---- latest day feed ---- */}
      <Card
        title={`${relativeDay(latestDay, today)} — ${fmtLong(latestDay)}`}
        sub={`${todayEntries.length} task${todayEntries.length === 1 ? "" : "s"} logged`}
        pad={false}
      >
        <div className="feed">
          {todayEntries.length === 0 && <div className="empty">Nothing logged for this day.</div>}
          {todayEntries.map((e) => (
            <EntryRow key={e.id} e={e} {...p} />
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ============================================================
   Shared entry row
   ============================================================ */

function EntryRow({
  e,
  members,
  projects,
  memberIndex,
  onSelectProject,
  today,
  showDate,
}: ViewProps & { e: Entry; showDate?: boolean }) {
  const m = memberOf(members, e.memberId);
  const proj = projectOf(projects, e.projectId);
  return (
    <div className="feed-row">
      {m && <Avatar initials={m.initials} index={memberIndex.get(m.id) ?? 0} title={m.name} />}
      <div className="feed-main">
        <div className="feed-title">{e.title}</div>
        <div className="feed-meta">
          <span>{m?.name ?? "Unassigned"}</span>
          <span aria-hidden="true">·</span>
          <button
            className="chip"
            onClick={() => onSelectProject(e.projectId)}
            title={`Filter to ${proj?.name ?? e.projectId}`}
          >
            {proj?.short ?? e.projectId}
          </button>
          <span className="chip">{CATEGORY_LABEL[e.category] ?? e.category}</span>
          {showDate && (
            <>
              <span aria-hidden="true">·</span>
              <span>{relativeDay(e.date, today)}</span>
            </>
          )}
        </div>
        {e.note && <div className="feed-note">{e.note}</div>}
      </div>
      <div className="feed-side">
        {typeof e.hours === "number" && e.hours > 0 && (
          <span className="hours">{hoursFmt(e.hours)}h</span>
        )}
        <StatusBadge status={e.status} />
      </div>
    </div>
  );
}

/* ============================================================
   Team
   ============================================================ */

export function TeamView(p: ViewProps) {
  const { entries, members, projects, days, today, memberIndex } = p;
  const useHours = hasHours(entries);
  const rolls = useMemo(
    () =>
      rollupMembers(entries, members, days).sort(
        (a, b) => b.hours - a.hours || b.tasks - a.tasks
      ),
    [entries, members, days]
  );
  const cellsOf = (r: (typeof rolls)[number]) => (useHours ? r.perDay : r.perDayTasks);
  const maxCell = heatScaleMax(rolls.flatMap(cellsOf));

  return (
    <div className="stack">
      <Card
        title="Who worked when"
        sub={`${useHours ? "Hours" : "Tasks"} logged per person per day · ${days.length} days`}
        action={<HeatScale label={useHours ? "more hours" : "more tasks"} />}
      >
        <div className="heat" style={{ gridTemplateColumns: "auto 1fr" }}>
          {rolls.map((r) => (
            <div key={r.member.id} style={{ display: "contents" }}>
              <div className="heat-name">
                <Avatar
                  initials={r.member.initials}
                  index={memberIndex.get(r.member.id) ?? 0}
                  title={r.member.name}
                />
                {r.member.name}
              </div>
              <HeatRow values={cellsOf(r)} days={days} max={maxCell} unit={useHours ? "h" : ""} />
            </div>
          ))}
          <div />
          <HeatAxis days={days} />
        </div>
      </Card>

      <div className="grid g-cards">
        {rolls.map((r) => {
          const total = r.tasks || 1;
          const topProjects = [...sumBy(
            entries.filter((e) => e.memberId === r.member.id),
            (e) => e.projectId,
            (e) => (useHours ? (e.hours ?? 0) : 1)
          ).entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);
          return (
            <div className="card mcard" key={r.member.id}>
              <div className="mcard-head">
                <Avatar
                  initials={r.member.initials}
                  index={memberIndex.get(r.member.id) ?? 0}
                  size="lg"
                  title={r.member.name}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="mcard-name">{r.member.name}</div>
                  <div className="mcard-role">{r.member.role}</div>
                </div>
                <Sparkline values={cellsOf(r).slice(-12)} />
              </div>

              <div className="metric-row">
                <div className="metric">
                  <span className="metric-v">{r.tasks}</span>
                  <span className="metric-l">tasks</span>
                </div>
                {useHours && (
                  <div className="metric">
                    <span className="metric-v">{hoursFmt(r.hours)}</span>
                    <span className="metric-l">hours</span>
                  </div>
                )}
                <div className="metric">
                  <span className="metric-v">{r.projects.length}</span>
                  <span className="metric-l">projects</span>
                </div>
                <div className="metric">
                  <span className="metric-v">
                    {r.tasks ? Math.round((r.worked / total) * 100) : 0}%
                  </span>
                  <span className="metric-l">worked</span>
                </div>
              </div>

              <div>
                <div className="meter">
                  {STATUS_ORDER.map((s) => {
                    const n =
                      s === "worked"
                        ? r.worked
                        : s === "in-progress"
                          ? r.active
                          : s === "blocked"
                            ? r.blocked
                            : r.tasks - r.worked - r.active - r.blocked;
                    return n > 0 ? (
                      <i
                        key={s}
                        style={{ width: `${(n / total) * 100}%`, background: STATUS_COLOR[s] }}
                        title={`${STATUS_LABEL[s]}: ${n}`}
                      />
                    ) : null;
                  })}
                </div>
                <div className="legend" style={{ paddingTop: 8, gap: 10 }}>
                  {r.active > 0 && (
                    <span className="legend-item">
                      <StatusIcon status="in-progress" /> {r.active} in progress
                    </span>
                  )}
                  {r.blocked > 0 && (
                    <span className="legend-item">
                      <StatusIcon status="blocked" /> {r.blocked} blocked
                    </span>
                  )}
                  {r.active === 0 && r.blocked === 0 && (
                    <span className="legend-item">
                      <StatusIcon status="worked" /> Nothing in progress or blocked
                    </span>
                  )}
                </div>
              </div>

              <div className="taglist">
                {topProjects.map(([pid, h]) => (
                  <button key={pid} className="chip" onClick={() => p.onSelectProject(pid)}>
                    {projectOf(projects, pid)?.short ?? pid}
                    <b style={{ color: "var(--text-1)" }}>
                      {hoursFmt(Math.round(h * 10) / 10)}
                      {useHours ? "h" : ""}
                    </b>
                  </button>
                ))}
              </div>

              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Last logged {r.lastActive ? relativeDay(r.lastActive, today).toLowerCase() : "—"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================
   Projects
   ============================================================ */

const PHASE_TONE: Record<string, string> = {
  live: "var(--st-good)",
  "soft-launch": "var(--series-1)",
  active: "var(--series-7)",
};

export function ProjectsView(p: ViewProps) {
  const { entries, projects, members, today, memberIndex } = p;
  const useHours = hasHours(entries);
  const rolls = useMemo(() => rollupProjects(entries, projects), [entries, projects]);

  if (!rolls.length) return <div className="card empty">No project activity in this range.</div>;

  return (
    <div className="grid g-cards">
      {rolls.map((r) => {
        const total = r.tasks || 1;
        const scheduled = r.tasks - r.worked - r.active - r.blocked;
        return (
          <div className="card mcard" key={r.project.id}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="mcard-name" style={{ lineHeight: 1.25 }}>
                  {r.project.short}
                </div>
                <div className="mcard-role">
                  {r.project.genre}
                  {r.project.downloads ? ` · ${r.project.downloads} installs` : ""}
                </div>
              </div>
              <span className="chip">
                <span className="dot" style={{ background: PHASE_TONE[r.project.phase] ?? "var(--text-muted)" }} />
                {r.project.phase}
              </span>
            </div>

            <div className="metric-row">
              {useHours && (
                <div className="metric">
                  <span className="metric-v">{hoursFmt(r.hours)}</span>
                  <span className="metric-l">hours</span>
                </div>
              )}
              <div className="metric">
                <span className="metric-v">{r.tasks}</span>
                <span className="metric-l">tasks</span>
              </div>
              <div className="metric">
                <span className="metric-v">{Math.round((r.worked / total) * 100)}%</span>
                <span className="metric-l">worked</span>
              </div>
            </div>

            <div>
              <div className="meter">
                {r.worked > 0 && (
                  <i style={{ width: `${(r.worked / total) * 100}%`, background: STATUS_COLOR.worked }} />
                )}
                {r.active > 0 && (
                  <i style={{ width: `${(r.active / total) * 100}%`, background: STATUS_COLOR["in-progress"] }} />
                )}
                {r.blocked > 0 && (
                  <i style={{ width: `${(r.blocked / total) * 100}%`, background: STATUS_COLOR.blocked }} />
                )}
                {scheduled > 0 && (
                  <i style={{ width: `${(scheduled / total) * 100}%`, background: STATUS_COLOR.scheduled }} />
                )}
              </div>
              <div className="legend" style={{ paddingTop: 8, gap: 10 }}>
                <span className="legend-item">
                  <StatusIcon status="worked" /> {r.worked}
                </span>
                {r.active > 0 && (
                  <span className="legend-item">
                    <StatusIcon status="in-progress" /> {r.active}
                  </span>
                )}
                {r.blocked > 0 && (
                  <span className="legend-item">
                    <StatusIcon status="blocked" /> {r.blocked}
                  </span>
                )}
                {scheduled > 0 && (
                  <span className="legend-item">
                    <StatusIcon status="scheduled" /> {scheduled}
                  </span>
                )}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={{ display: "flex" }}>
                {r.members.map((id, i) => {
                  const m = memberOf(members, id);
                  if (!m) return null;
                  return (
                    <span key={id} style={{ marginLeft: i === 0 ? 0 : -7 }}>
                      <Avatar
                        initials={m.initials}
                        index={memberIndex.get(m.id) ?? 0}
                        title={m.name}
                      />
                    </span>
                  );
                })}
              </div>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {r.members.length} contributor{r.members.length === 1 ? "" : "s"}
              </span>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
                fontSize: 12,
                color: "var(--text-muted)",
                alignItems: "center",
              }}
            >
              <span>Last touched {r.lastTouched ? relativeDay(r.lastTouched, today).toLowerCase() : "—"}</span>
              <span style={{ display: "flex", gap: 10 }}>
                <button className="link-btn" style={{ padding: 0 }} onClick={() => p.onSelectProject(r.project.id)}>
                  Filter
                </button>
                {r.project.storeUrl && (
                  <a
                    className="link-btn"
                    style={{ padding: 0, display: "inline-block", textDecoration: "underline" }}
                    href={r.project.storeUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    Store
                  </a>
                )}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ============================================================
   Log — feed + the table view every chart falls back to
   ============================================================ */

export function LogView(p: ViewProps & { mode: "feed" | "table"; setMode: (m: "feed" | "table") => void }) {
  const { entries, members, projects, today, mode, setMode } = p;
  const useHours = hasHours(entries);

  const grouped = useMemo(() => {
    const m = new Map<string, Entry[]>();
    for (const e of entries) {
      if (!m.has(e.date)) m.set(e.date, []);
      m.get(e.date)!.push(e);
    }
    return [...m.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [entries]);

  const toggle = (
    <div className="seg">
      <button aria-pressed={mode === "feed"} onClick={() => setMode("feed")}>
        Feed
      </button>
      <button aria-pressed={mode === "table"} onClick={() => setMode("table")}>
        Table
      </button>
    </div>
  );

  if (!entries.length)
    return (
      <Card title="Activity log" action={toggle}>
        <div className="empty">No tasks match these filters.</div>
      </Card>
    );

  if (mode === "table")
    return (
      <Card title="Activity log" sub={`${entries.length} tasks`} action={toggle} pad={false}>
        <div className="tablewrap">
          <table className="data">
            <thead>
              <tr>
                <th>Date</th>
                <th>Person</th>
                <th>Project</th>
                <th>Task</th>
                <th>Discipline</th>
                <th>Status</th>
                {useHours && <th className="num">Hours</th>}
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{e.date}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{memberOf(members, e.memberId)?.name ?? "—"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{projectOf(projects, e.projectId)?.short ?? e.projectId}</td>
                  <td>
                    {e.title}
                    {e.note && (
                      <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 2 }}>{e.note}</div>
                    )}
                  </td>
                  <td>{CATEGORY_LABEL[e.category] ?? e.category}</td>
                  <td>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
                      <StatusIcon status={e.status} />
                      {STATUS_LABEL[e.status]}
                    </span>
                  </td>
                  {useHours && <td className="num">{hoursFmt(e.hours ?? 0)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    );

  return (
    <Card title="Activity log" sub={`${entries.length} tasks`} action={toggle} pad={false}>
      <div className="feed">
        {grouped.map(([date, list]) => (
          <div key={date}>
            <div className="feed-day">
              <span>
                {relativeDay(date, today)} · {fmtLong(date)}
              </span>
              <span style={{ fontWeight: 500, color: "var(--text-muted)" }}>
                {list.length} task{list.length === 1 ? "" : "s"}
                {useHours
                  ? ` · ${hoursFmt(
                      Math.round(list.reduce((s, e) => s + (e.hours ?? 0), 0) * 10) / 10
                    )}h`
                  : ""}
              </span>
            </div>
            {list.map((e) => (
              <EntryRow key={e.id} e={e} {...p} />
            ))}
          </div>
        ))}
      </div>
    </Card>
  );
}
