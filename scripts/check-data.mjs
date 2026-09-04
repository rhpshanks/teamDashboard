#!/usr/bin/env node
/**
 * Validates data/*.json before you push. Run: npm run check
 * Catches the mistakes a hand-edited daily update actually makes —
 * unknown ids, bad dates, bad status values, duplicate entry ids.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => JSON.parse(readFileSync(join(root, "data", f), "utf8"));

const STATUSES = ["worked", "in-progress", "scheduled", "blocked"];
const CATEGORIES = ["dev", "ops", "art", "audio", "design", "qa", "liveops", "marketing", "biz"];

const errors = [];
const warnings = [];

let team, projects, entries, meta;
try {
  team = read("team.json");
  projects = read("projects.json");
  entries = read("entries.json");
  meta = read("meta.json");
} catch (err) {
  console.error(`\n  Could not parse a data file — check for a trailing comma.\n  ${err.message}\n`);
  process.exit(1);
}

const memberIds = new Set(team.members.map((m) => m.id));
const projectIds = new Set(projects.projects.map((p) => p.id));
const seen = new Set();

for (const [i, e] of entries.entries.entries()) {
  const at = `entries[${i}] ${e.id ?? "(no id)"}`;
  if (!e.id) errors.push(`${at}: missing id`);
  else if (seen.has(e.id)) errors.push(`${at}: duplicate id`);
  else seen.add(e.id);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date ?? "")) errors.push(`${at}: date must be YYYY-MM-DD, got "${e.date}"`);
  if (!memberIds.has(e.memberId)) errors.push(`${at}: unknown memberId "${e.memberId}"`);
  if (!projectIds.has(e.projectId)) errors.push(`${at}: unknown projectId "${e.projectId}"`);
  if (!STATUSES.includes(e.status)) errors.push(`${at}: status must be one of ${STATUSES.join(", ")}`);
  if (!CATEGORIES.includes(e.category)) errors.push(`${at}: category must be one of ${CATEGORIES.join(", ")}`);
  if (e.hours !== undefined && (typeof e.hours !== "number" || e.hours <= 0))
    errors.push(`${at}: hours is optional, but when present must be a positive number`);
  if (!e.title || !e.title.trim()) errors.push(`${at}: title is empty`);
}

const newest = entries.entries.reduce((a, e) => (e.date > a ? e.date : a), "0000-00-00");
// asOf is the board's "today". It may legitimately run ahead of the newest
// entry (nobody logged anything yet today); it must never lag behind one.
if (meta.asOf < newest) {
  warnings.push(`meta.asOf is "${meta.asOf}" but there are entries dated "${newest}" — bump asOf, or the board will silently use ${newest} as today.`);
}
if (meta.sampleData) {
  warnings.push('meta.sampleData is true — the board shows a "Sample data" pill. Set it to false once the data is real.');
}

const perDay = new Map();
for (const e of entries.entries) {
  const k = `${e.date}|${e.memberId}`;
  perDay.set(k, (perDay.get(k) ?? 0) + (e.hours ?? 0));
}
for (const [k, h] of perDay) {
  if (h > 14) warnings.push(`${k.replace("|", " — ")}: ${h}h logged in one day, which looks like a typo.`);
}

console.log(`\n  ${entries.entries.length} entries · ${memberIds.size} members · ${projectIds.size} projects`);
for (const w of warnings) console.log(`  ! ${w}`);
if (errors.length) {
  console.error(`\n  ${errors.length} error(s):`);
  for (const e of errors) console.error(`  x ${e}`);
  console.error("");
  process.exit(1);
}
console.log("  Data looks good.\n");
