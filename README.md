# Daily Movement

A small mobile-first daily workout checklist. Check something off and it slides into a **Completed** list with a timestamp; everything resets to *to do* the next morning.

- **Tailwind CSS** (Play CDN) + **Alpine.js** — no build step, no framework, no server.
- `workouts.json` is the read-only "database" — edit it to change the list.
- Progress, timestamps, a 14-day history and a streak live in `localStorage` (key `workout-tracker-v1`).

## Run locally

The app fetches `workouts.json`, so it needs to be served over http (not opened as a `file://` path):

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy to GitHub Pages

Push these files to a repo, then **Settings → Pages → Source: Deploy from a branch**, pick `main` / `root`. All paths are relative, so it works from a project subpath like `user.github.io/workout/`.

## Editing workouts

Each entry in `workouts.json`:

```json
{
  "id": "squats-15",        // stable, unique — used as the localStorage key
  "name": "15 squats",
  "detail": "Feet shoulder width, chest up",
  "icon": "🦵",
  "tag": "Legs",
  "minutes": 3              // feeds the "~X min left today" estimate
}
```

Changing an `id` drops that workout's completion for the current day; removing a workout cleans up its stored entry automatically.
