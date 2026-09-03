import entriesJson from "../../data/entries.json";
import membersJson from "../../data/team.json";
import metaJson from "../../data/meta.json";
import projectsJson from "../../data/projects.json";
import type { DashboardData, Entry, Member, Meta, Project } from "./types";

/** Reads the JSON data files. Unknown member/project ids are dropped rather
 *  than rendering as blanks, so a typo in a daily update is visible as a
 *  missing row instead of a broken card. */
export function loadDashboardData(): DashboardData {
  const members = (membersJson.members as unknown as Member[]).filter((m) => m.active !== false);
  const projects = projectsJson.projects as unknown as Project[];
  const memberIds = new Set(members.map((m) => m.id));
  const projectIds = new Set(projects.map((p) => p.id));

  const entries = (entriesJson.entries as unknown as Entry[]).filter(
    (e) => memberIds.has(e.memberId) && projectIds.has(e.projectId)
  );

  const meta = metaJson as unknown as Meta;

  // If asOf wasn't bumped, fall back to the newest entry so "today" is honest.
  const newest = entries.reduce((a, e) => (e.date > a ? e.date : a), meta.asOf);

  return { meta: { ...meta, asOf: newest }, members, projects, entries };
}
