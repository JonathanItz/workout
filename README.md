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

## Installing it (PWA)

It's installable to the home screen and runs offline.

- **iPhone:** open in Safari → Share → *Add to Home Screen*. (Chrome/Firefox on iOS can't install — iOS only allows it from Safari.)
- **Android:** Chrome shows an *Install app* prompt, or use ⋮ → *Add to Home screen*.
- **Desktop:** an install icon appears in the Chrome/Edge address bar.

Installability needs **https**, which GitHub Pages gives you. On `localhost` it also works; over plain http on a LAN IP it won't.

Pieces: [manifest.webmanifest](manifest.webmanifest), [sw.js](sw.js) (caches the app shell plus the Tailwind/Alpine/fonts CDNs, so it opens with no signal), and [icons/](icons/).

### Icons

Generated from the 💪 emoji by [tools/make-icons.py](tools/make-icons.py) (macOS + Pillow):

```bash
python3 -m venv .venv && .venv/bin/pip install Pillow
.venv/bin/python tools/make-icons.py
```

Change `EMOJI` at the top of that script to swap the icon.

### Shipping an update

Installed devices keep serving from the service worker cache. After changing `index.html`, `app.js`, or `workouts.json`, bump `VERSION` in [sw.js](sw.js) — the new worker takes over on the next launch.

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
