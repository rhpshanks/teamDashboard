/** The vocabulary the daily update uses. "blocked" is the exception flag —
 *  it is not part of the everyday three, but keeps its panel and tile for the
 *  days something is genuinely stuck. */
export type TaskStatus = "worked" | "in-progress" | "scheduled" | "blocked";

export type Category =
  | "dev"
  | "ops"
  | "art"
  | "audio"
  | "design"
  | "qa"
  | "liveops"
  | "marketing"
  | "biz";

export interface Member {
  id: string;
  name: string;
  role: string;
  initials: string;
  disciplines: string[];
  active: boolean;
}

export interface Project {
  id: string;
  name: string;
  short: string;
  genre: string;
  downloads: string | null;
  phase: string;
  bundleId: string | null;
  kind: "game" | "workstream";
  storeUrl: string | null;
}

export interface Entry {
  id: string;
  date: string; // YYYY-MM-DD
  memberId: string;
  projectId: string;
  title: string;
  category: Category;
  status: TaskStatus;
  /** Optional. Daily updates usually arrive as prose without time tracking, so
   *  the board falls back to task counts whenever hours aren't recorded rather
   *  than showing invented numbers. */
  hours?: number;
  note?: string;
}

export interface Meta {
  studio: string;
  boardTitle: string;
  asOf: string;
  sampleData: boolean;
  timezone: string;
  note?: string;
}

export interface DashboardData {
  meta: Meta;
  members: Member[];
  projects: Project[];
  entries: Entry[];
}

export const STATUS_ORDER: TaskStatus[] = [
  "worked",
  "in-progress",
  "scheduled",
  "blocked",
];

export const STATUS_LABEL: Record<TaskStatus, string> = {
  worked: "Worked",
  "in-progress": "In progress",
  scheduled: "Scheduled",
  blocked: "Blocked",
};

/** Colour by role: worked = status good, blocked = status critical,
 *  in-progress = the accent series hue, scheduled = recessive muted. */
export const STATUS_COLOR: Record<TaskStatus, string> = {
  worked: "var(--st-good)",
  "in-progress": "var(--series-1)",
  scheduled: "var(--axis)",
  blocked: "var(--st-critical)",
};

export const CATEGORY_LABEL: Record<Category, string> = {
  dev: "Development",
  ops: "Build & tooling",
  art: "Art",
  audio: "Audio",
  design: "Design",
  qa: "QA",
  liveops: "Live ops",
  marketing: "Marketing",
  biz: "Publishing",
};

/** Avatar hues — a labelled identity channel, not a chart series: every avatar
 *  carries the person's initials inside the mark and their name beside it, and
 *  no chart encodes a member by hue (the trend is one series, bars are one hue,
 *  the heatmap is sequential). This order was picked by running the palette
 *  validator over candidate 6-hue subsets: it is the only candidate clearing the
 *  normal-vision floor on the light surface (worst pair DeltaE 15.6), with CVD
 *  separation in the 6-8 band that the initials + name satisfy. Six hues cannot
 *  clear the all-pairs CVD gate in both modes — no subset of the palette can —
 *  which is why identity never rests on the colour here. */
export const AVATAR_SLOTS = [
  "var(--series-1)", // blue
  "var(--series-7)", // violet
  "var(--series-3)", // aqua
  "var(--series-4)", // yellow
  "var(--series-8)", // red
  "var(--series-6)", // green
  "var(--series-2)", // orange
  "var(--series-5)", // magenta
];
