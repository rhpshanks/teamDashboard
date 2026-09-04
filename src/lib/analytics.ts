import type { Entry, Member, Project, TaskStatus } from "./types";
import { STATUS_ORDER } from "./types";

/* ---------------- dates ---------------- */

export function parseISO(d: string): Date {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

export function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number): string {
  const d = parseISO(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return toISO(d);
}

export function dayDiff(a: string, b: string): number {
  return Math.round((parseISO(a).getTime() - parseISO(b).getTime()) / 86400000);
}

export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  let cur = from;
  while (cur <= to) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MO = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function weekday(iso: string): string {
  return WD[parseISO(iso).getUTCDay()];
}

export function isWeekend(iso: string): boolean {
  const d = parseISO(iso).getUTCDay();
  return d === 0 || d === 6;
}

export function fmtShort(iso: string): string {
  const d = parseISO(iso);
  return `${MO[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

export function fmtLong(iso: string): string {
  const d = parseISO(iso);
  return `${WD[d.getUTCDay()]}, ${MO[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

export function relativeDay(iso: string, today: string): string {
  const diff = dayDiff(today, iso);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return `${diff} days ago`;
  return fmtShort(iso);
}

/* ---------------- formatting ---------------- */

export function compact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (Math.abs(n) >= 10_000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toLocaleString("en-US");
}

export function hoursFmt(h: number): string {
  return h % 1 === 0 ? String(h) : h.toFixed(1);
}

/* ---------------- aggregation ---------------- */

/** True when at least one entry in the set records hours. Daily updates
 *  usually arrive as prose, so most of the board measures effort in tasks and
 *  only switches to hours when they are actually recorded. */
export function hasHours(entries: Entry[]): boolean {
  return entries.some((e) => typeof e.hours === "number" && e.hours > 0);
}

const hrs = (e: Entry) => e.hours ?? 0;

export interface DayPoint {
  date: string;
  tasks: number;
  hours: number;
  worked: number;
  people: number;
}

export function byDay(entries: Entry[], days: string[]): DayPoint[] {
  const map = new Map<string, { tasks: number; hours: number; worked: number; people: Set<string> }>();
  for (const d of days) map.set(d, { tasks: 0, hours: 0, worked: 0, people: new Set() });
  for (const e of entries) {
    const slot = map.get(e.date);
    if (!slot) continue;
    slot.tasks += 1;
    slot.hours += hrs(e);
    if (e.status === "worked") slot.worked += 1;
    slot.people.add(e.memberId);
  }
  return days.map((d) => {
    const s = map.get(d)!;
    return {
      date: d,
      tasks: s.tasks,
      hours: Math.round(s.hours * 10) / 10,
      worked: s.worked,
      people: s.people.size,
    };
  });
}

export function countBy<T>(items: T[], key: (t: T) => string): Map<string, number> {
  const m = new Map<string, number>();
  for (const it of items) {
    const k = key(it);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

export function sumBy<T>(items: T[], key: (t: T) => string, value: (t: T) => number): Map<string, number> {
  const m = new Map<string, number>();
  for (const it of items) {
    const k = key(it);
    m.set(k, (m.get(k) ?? 0) + value(it));
  }
  return m;
}

export function statusCounts(entries: Entry[]): Record<TaskStatus, number> {
  const out = { worked: 0, "in-progress": 0, scheduled: 0, blocked: 0 } as Record<TaskStatus, number>;
  for (const e of entries) out[e.status] += 1;
  return out;
}

export interface ProjectRoll {
  project: Project;
  tasks: number;
  hours: number;
  worked: number;
  blocked: number;
  active: number;
  members: string[];
  lastTouched: string | null;
}

export function rollupProjects(
  entries: Entry[],
  projects: Project[]
): ProjectRoll[] {
  const index = new Map<string, ProjectRoll>();
  for (const p of projects) {
    index.set(p.id, {
      project: p,
      tasks: 0,
      hours: 0,
      worked: 0,
      blocked: 0,
      active: 0,
      members: [],
      lastTouched: null,
    });
  }
  const seen = new Map<string, Set<string>>();
  for (const e of entries) {
    const r = index.get(e.projectId);
    if (!r) continue;
    r.tasks += 1;
    r.hours += hrs(e);
    if (e.status === "worked") r.worked += 1;
    if (e.status === "blocked") r.blocked += 1;
    if (e.status === "in-progress") r.active += 1;
    if (!r.lastTouched || e.date > r.lastTouched) r.lastTouched = e.date;
    if (!seen.has(e.projectId)) seen.set(e.projectId, new Set());
    seen.get(e.projectId)!.add(e.memberId);
  }
  for (const [pid, set] of seen) index.get(pid)!.members = [...set];
  return [...index.values()]
    .filter((r) => r.tasks > 0)
    .map((r) => ({ ...r, hours: Math.round(r.hours * 10) / 10 }))
    .sort((a, b) => b.hours - a.hours || b.tasks - a.tasks);
}

export interface MemberRoll {
  member: Member;
  tasks: number;
  hours: number;
  worked: number;
  blocked: number;
  active: number;
  projects: string[];
  /** Hours per day, and task counts per day — the heatmap uses whichever the
   *  data actually supports. */
  perDay: number[];
  perDayTasks: number[];
  lastActive: string | null;
}

export function rollupMembers(
  entries: Entry[],
  members: Member[],
  days: string[]
): MemberRoll[] {
  const dayIndex = new Map(days.map((d, i) => [d, i]));
  return members.map((m) => {
    const mine = entries.filter((e) => e.memberId === m.id);
    const perDay = new Array(days.length).fill(0);
    const perDayTasks = new Array(days.length).fill(0);
    for (const e of mine) {
      const i = dayIndex.get(e.date);
      if (i !== undefined) {
        perDay[i] += hrs(e);
        perDayTasks[i] += 1;
      }
    }
    const projects = [...new Set(mine.map((e) => e.projectId))];
    const dates = mine.map((e) => e.date).sort();
    return {
      member: m,
      tasks: mine.length,
      hours: Math.round(mine.reduce((s, e) => s + hrs(e), 0) * 10) / 10,
      worked: mine.filter((e) => e.status === "worked").length,
      blocked: mine.filter((e) => e.status === "blocked").length,
      active: mine.filter((e) => e.status === "in-progress").length,
      projects,
      perDay: perDay.map((h) => Math.round(h * 10) / 10),
      perDayTasks,
      lastActive: dates.length ? dates[dates.length - 1] : null,
    };
  });
}

export function statusSplit(entries: Entry[]) {
  const counts = statusCounts(entries);
  const total = entries.length || 1;
  return STATUS_ORDER.map((s) => ({
    status: s,
    count: counts[s],
    pct: (counts[s] / total) * 100,
  })).filter((s) => s.count > 0);
}

/** Percentage change vs a comparison value; null when there's no baseline. */
export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}
