# GlitchTech — Team Activity Dashboard

A live board showing **what each person worked on, on which project, and where it stands** — updated daily.

Everything the board renders comes from four JSON files in [`data/`](data). There is no database and no backend: you edit the JSON, push to GitHub, and Vercel rebuilds the site automatically. That push-to-update loop is what makes the board "live".

---

## The daily update loop

1. Add today's tasks to `data/entries.json`.
2. Set `meta.asOf` in `data/meta.json` to today's date.
3. `npm run check` — catches typos before they reach the team.
4. Commit and push. Vercel redeploys in about a minute.

```bash
npm run check && git add data && git commit -m "Log for 2026-09-05" && git push
```

---

## Data files

### `data/entries.json` — one object per task, per person, per day

```json
{
  "id": "e0409",
  "date": "2026-09-05",
  "memberId": "m-alex",
  "projectId": "battle-order",
  "title": "Fix ANR on cold start",
  "category": "dev",
  "status": "in-progress",
  "hours": 3,
  "note": "Optional — shown as a callout, used for blocker context."
}
```

| Field | Notes |
|---|---|
| `id` | Any unique string. Keep incrementing `e0001`, `e0002`, … |
| `date` | `YYYY-MM-DD` |
| `memberId` | Must match an `id` in `team.json` |
| `projectId` | Must match an `id` in `projects.json` |
| `category` | `dev` · `art` · `design` · `qa` · `liveops` · `marketing` · `biz` |
| `status` | `done` · `in-progress` · `blocked` · `planned` |
| `hours` | Positive number; halves are fine (`2.5`) |
| `note` | Optional. Worth filling in for anything `blocked` |

Entries whose `memberId` or `projectId` doesn't exist are **dropped**, not rendered blank — so a typo shows up as a missing row. `npm run check` reports them.

### `data/team.json`

```json
{ "id": "m-alex", "name": "Alex", "role": "Lead Unity Developer",
  "initials": "AL", "disciplines": ["dev"], "active": true }
```

Set `active: false` for someone who has left — their history stays, but they drop out of the filters and cards.

### `data/projects.json`

The 12 published games plus the non-game workstreams (publisher outreach, ASO). `phase` is free text; `live`, `soft-launch` and `active` get a coloured dot.

### `data/meta.json`

```json
{ "studio": "GlitchTech", "boardTitle": "Team Activity Dashboard",
  "asOf": "2026-09-04", "sampleData": true, "timezone": "Asia/Karachi" }
```

`asOf` is the board's "today". If you forget to bump it, the app falls back to the newest entry date so the header never lies. `sampleData: true` shows the amber **Sample data** pill — set it to `false` once the seeded names and tasks are replaced with real ones.

---

## What's on the board

- **Overview** — today's headline number, who worked, stat tiles with period-over-period deltas, a daily activity trend, the status mix, and effort split by project and by discipline. Blocked work gets its own panel.
- **Team** — a per-person / per-day hours heatmap, plus a card per person: tasks, hours, projects, completion rate, and what they spent the most time on.
- **Projects** — a card per project: hours, task counts, completion, contributors, last touched, and a link to the Play Store listing.
- **Activity log** — the full filterable feed, with a table view for reading or copying the raw numbers.

Filters (range, person, project, status, search) apply across every tab. Clicking a project bar or a person chip filters the whole board. Light and dark themes follow the OS and can be toggled; the choice is remembered per browser.

---

## Local development

```bash
npm install
npm run dev      # http://localhost:3000
npm run check    # validate data/*.json
npm run build    # production build
```

## Deploying to Vercel

Import this repository at [vercel.com/new](https://vercel.com/new). It's a standard Next.js app — the framework preset, build command and output directory are all detected automatically, and there are no environment variables to set. Every push to `main` redeploys.

---

## Design notes

Charts are hand-rolled SVG and CSS — no chart library — so the marks follow one spec: 2px lines, 4px rounded data-ends anchored to the baseline, 2px surface gaps between touching fills, ≥8px hover markers with a surface ring, and recessive hairline gridlines.

Colour is assigned by the job it does. The activity trend is a single series, so bars and lines wear one hue and identity comes from the row label rather than a rainbow of ranks. The heatmap is a single-hue sequential ramp normalised to the 90th percentile, so one long day doesn't flatten the rest. Task status uses a reserved status palette, and every status ships with a **distinct shape** as well as a colour — so the meaning survives colour-blindness, greyscale printing and forced-colors mode. Every chart has a table-view fallback in the Activity log tab.
