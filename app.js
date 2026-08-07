const STORAGE_KEY = 'workout-tracker-v1';

/** Local (not UTC) YYYY-MM-DD — the day boundary should follow the user's clock. */
function todayKey(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

function workoutApp() {
  return {
    loading: true,
    error: '',
    title: 'Daily Movement',
    subtitle: '',
    workouts: [],
    // { [workoutId]: ISO timestamp } for today only
    completed: {},
    // { [YYYY-MM-DD]: number of workouts completed that day }
    history: {},
    date: todayKey(),
    showHistory: false,

    async init() {
      this.restore();

      // Roll over if the tab was left open across midnight.
      setInterval(() => this.restore(), 60 * 1000);

      try {
        const res = await fetch(`workouts.json?v=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        this.title = data.title || this.title;
        this.subtitle = data.subtitle || '';
        this.workouts = data.workouts || [];
        // Drop completions for workouts that no longer exist in the JSON.
        const ids = new Set(this.workouts.map((w) => w.id));
        let changed = false;
        for (const id of Object.keys(this.completed)) {
          if (!ids.has(id)) {
            delete this.completed[id];
            changed = true;
          }
        }
        if (changed) this.persist();
      } catch (e) {
        this.error = 'Could not load workouts.json — if you opened this file directly, serve it over http instead.';
      } finally {
        this.loading = false;
      }
    },

    /** Read localStorage and roll the day over if the stored date is stale. */
    restore() {
      const state = loadState() || {};
      this.history = state.history || {};
      const today = todayKey();

      if (state.date && state.date !== today) {
        // Archive yesterday's tally, then reset everything back to "to do".
        const count = Object.keys(state.completed || {}).length;
        if (count > 0) this.history[state.date] = count;
        this.completed = {};
        this.date = today;
        this.persist();
      } else {
        this.completed = state.completed || {};
        this.date = today;
      }
    },

    persist() {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ date: this.date, completed: this.completed, history: this.history })
        );
      } catch {
        /* storage full or blocked — the UI still works for this session */
      }
    },

    toggle(workout) {
      if (this.completed[workout.id]) {
        delete this.completed[workout.id];
      } else {
        this.completed[workout.id] = new Date().toISOString();
      }
      this.persist();
    },

    isDone(workout) {
      return Boolean(this.completed[workout.id]);
    },

    get todo() {
      return this.workouts.filter((w) => !this.completed[w.id]);
    },

    get done() {
      return this.workouts
        .filter((w) => this.completed[w.id])
        .sort((a, b) => this.completed[b.id].localeCompare(this.completed[a.id]));
    },

    get total() {
      return this.workouts.length;
    },

    get doneCount() {
      return this.done.length;
    },

    get percent() {
      return this.total ? Math.round((this.doneCount / this.total) * 100) : 0;
    },

    get allDone() {
      return this.total > 0 && this.doneCount === this.total;
    },

    get minutesLeft() {
      return this.todo.reduce((sum, w) => sum + (w.minutes || 0), 0);
    },

    /** Consecutive days ending today (or yesterday, if today is still empty) with ≥1 completion. */
    get streak() {
      const days = { ...this.history };
      if (this.doneCount > 0) days[this.date] = this.doneCount;

      let streak = 0;
      const cursor = new Date();
      if (!days[todayKey(cursor)]) cursor.setDate(cursor.getDate() - 1);
      while (days[todayKey(cursor)]) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
      }
      return streak;
    },

    get historyRows() {
      return Object.entries(this.history)
        .sort((a, b) => b[0].localeCompare(a[0]))
        .slice(0, 14)
        .map(([date, count]) => ({ date, count, label: this.formatDay(date) }));
    },

    get prettyDate() {
      return new Date(`${this.date}T00:00:00`).toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      });
    },

    formatDay(dateStr) {
      return new Date(`${dateStr}T00:00:00`).toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    },

    formatTime(iso) {
      if (!iso) return '';
      return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    },

    resetToday() {
      this.completed = {};
      this.persist();
    },

    /** Circumference math for the progress ring (r = 34). */
    get ringDash() {
      const c = 2 * Math.PI * 34;
      return `${(this.percent / 100) * c} ${c}`;
    },
  };
}
