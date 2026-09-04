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
  "id": "e0014",
  "date": "2026-09-04",
  "memberId": "m-bilal",
  "projectId": "pc-horror-game",
  "title": "Fix ANR on cold start",
  "category": "dev",
  "status": "in-progress",
  "note": "Optional — shown as a callout, used for blocker context."
}
```

| Field | Notes |
|---|---|
| `id` | Any unique string. Keep incrementing `e0001`, `e0002`, … |
| `date` | `YYYY-MM-DD` |
| `memberId` | Must match an `id` in `team.json` |
| `projectId` | Must match an `id` in `projects.json` |
| `category` | `dev` · `ops` · `art` · `audio` · `design` · `qa` · `liveops` · `marketing` · `biz` |
| `status` | `worked` · `in-progress` · `scheduled` — plus `blocked` for the exception case |
| `hours` | **Optional.** Positive number; halves are fine (`2.5`) |
| `note` | Optional. Worth filling in for anything `blocked` |

**On `status`:** the day-to-day vocabulary is three tags — `worked` (touched and finished), `in-progress` (still open), `scheduled` (lined up, not started). `blocked` is a fourth, used only when something is genuinely stuck; it drives the "Blocked" panel and the open-blockers tile, both of which stay quiet when nothing carries it.

**On `hours`:** updates usually arrive as prose with no time tracking, so the board measures effort in **task counts** by default and never invents numbers. Record `hours` on entries and it switches to hours automatically — the tiles, effort bars, heatmap and log all relabel themselves. It's all-or-nothing per view: hours are used as soon as any entry in the visible range has them.

Entries whose `memberId` or `projectId` doesn't exist are **dropped**, not rendered blank — so a typo shows up as a missing row. `npm run check` reports them.

### `data/team.json`

```json
{ "id": "m-bilal", "name": "Bilal Bin Sabir", "role": "Developer",
  "initials": "BI", "disciplines": ["dev", "ops"], "active": true }
```

Set `active: false` for someone who has left — their history stays, but they drop out of the filters and cards.

### `data/projects.json`

The projects currently in flight (PC Horror Game, Naval Idle Clicker, Glitch Website), the 12 published games, and the non-game workstreams (publisher outreach, ASO). Projects with no logged work simply don't appear on the board, so it's safe to keep the whole back catalogue listed here. `phase` is free text; `live`, `soft-launch`, `in-development` and `active` get a coloured dot.

### `data/meta.json`

```json
{ "studio": "GlitchTech", "boardTitle": "Team Activity Dashboard",
  "asOf": "2026-09-04", "sampleData": false, "timezone": "Asia/Karachi" }
```

`asOf` is the board's "today". It may run ahead of the newest entry — that just means nobody has logged anything yet today — but it must never lag behind one; `npm run check` warns if it does. The freshness pill in the header reports how current the *data* is ("Data through yesterday"), not what `asOf` says, so a quiet day reads as quiet rather than as fresh. `sampleData: true` shows an amber **Sample data** pill in the header — a way to mark the board as not-yet-real without taking it offline.

---

## What's on the board

- **Main** — today's headline number, who worked, stat tiles with period-over-period deltas, a daily activity trend, the status mix, and effort split by project and by discipline. Blocked work gets its own panel.
- **Team** — a per-person / per-day activity heatmap, plus a card per person: tasks, projects, completion rate, and what they spent the most effort on.
- **Projects** — a card per project: task counts, completion, contributors, last touched, and a link to the Play Store listing where the game is published.
- **Activities** — the full filterable feed, with a table view for reading or copying the raw numbers.

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

Colour is assigned by the job it does. The activity trend is a single series, so bars and lines wear one hue and identity comes from the row label rather than a rainbow of ranks. The heatmap is a single-hue sequential ramp normalised to the 90th percentile, so one busy day doesn't flatten the rest. Task status uses a reserved status palette, and every status ships with a **distinct shape** as well as a colour — so the meaning survives colour-blindness, greyscale printing and forced-colors mode. Every chart has a table-view fallback in the Activities tab.
