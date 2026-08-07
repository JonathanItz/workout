const STORAGE_KEY = 'workout-tracker-v1';

/** The hour the app stops defaulting to the Morning tab. */
const EVENING_STARTS_AT = 12;

/** How many weeks the streak calendar shows. */
const CALENDAR_WEEKS = 8;

/** Local (not UTC) YYYY-MM-DD — the day boundary should follow the user's clock. */
function todayKey(d = new Date()) {
	const pad = (n) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Date maths on a YYYY-MM-DD key. Goes through local Date so DST can't drop a day. */
function shiftKey(key, days) {
	const d = new Date(`${key}T00:00:00`);
	d.setDate(d.getDate() + days);
	return todayKey(d);
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
		// { [YYYY-MM-DD]: { count, total } } for previous days
		history: {},
		date: todayKey(),
		tab: 'morning',
		view: 'today',

		async init() {
			this.restore();
			this.tab = new Date().getHours() < EVENING_STARTS_AT ? 'morning' : 'evening';

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
				for (const id of Object.keys(this.completed)) {
					if (!ids.has(id)) delete this.completed[id];
				}
				// Now that the schedule is known, record today's target so tomorrow's
				// rollover can archive an accurate "x of y".
				this.persist();
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
				if (count > 0) this.history[state.date] = { count, total: state.total || count };
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
					JSON.stringify({
						date: this.date,
						total: this.total,
						completed: this.completed,
						history: this.history,
					})
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

		// ---- Scheduling -------------------------------------------------------

		/** `days` is 0=Sun … 6=Sat; a workout with no `days` runs every day. */
		get todaysWorkouts() {
			const dow = new Date(`${this.date}T00:00:00`).getDay();
			return this.workouts.filter((w) => !Array.isArray(w.days) || w.days.includes(dow));
		},

		/** Workouts in a given tab. `period: "any"` shows up in both. */
		inPeriod(period) {
			return this.todaysWorkouts.filter((w) => w.period === period || w.period === 'any');
		},

		/** e.g. "Tue · Thu · Sat" for a workout that only runs some days. */
		scheduleLabel(workout) {
			if (!Array.isArray(workout.days)) return '';
			const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
			return workout.days.map((d) => names[d]).join(' · ');
		},

		// ---- Current tab ------------------------------------------------------

		get tabWorkouts() {
			return this.inPeriod(this.tab);
		},

		get todo() {
			return this.tabWorkouts.filter((w) => !this.completed[w.id]);
		},

		get done() {
			return this.tabWorkouts
				.filter((w) => this.completed[w.id])
				.sort((a, b) => this.completed[b.id].localeCompare(this.completed[a.id]));
		},

		get tabTotal() {
			return this.tabWorkouts.length;
		},

		get tabDoneCount() {
			return this.done.length;
		},

		get percent() {
			return this.tabTotal ? Math.round((this.tabDoneCount / this.tabTotal) * 100) : 0;
		},

		get tabAllDone() {
			return this.tabTotal > 0 && this.tabDoneCount === this.tabTotal;
		},

		get minutesLeft() {
			return this.todo.reduce((sum, w) => sum + (w.minutes || 0), 0);
		},

		/** "2/5" for the segmented control badges. */
		tabScore(period) {
			const list = this.inPeriod(period);
			return `${list.filter((w) => this.completed[w.id]).length}/${list.length}`;
		},

		// ---- Whole day --------------------------------------------------------

		get total() {
			return this.todaysWorkouts.length;
		},

		get doneCount() {
			return this.todaysWorkouts.filter((w) => this.completed[w.id]).length;
		},

		get dayAllDone() {
			return this.total > 0 && this.doneCount === this.total;
		},

		// ---- Streak & history -------------------------------------------------

		/**
		 * What happened on a given day, or null if nothing did. Today comes from live
		 * state — it only lands in `history` at tomorrow's rollover.
		 */
		record(key) {
			if (key === this.date) {
				return this.doneCount > 0 ? { count: this.doneCount, total: this.total } : null;
			}
			const entry = this.history[key];
			if (!entry) return null;
			// Older entries were stored as a bare count.
			const count = typeof entry === 'number' ? entry : entry.count;
			const total = typeof entry === 'number' ? entry : entry.total || count;
			return count > 0 ? { count, total } : null;
		},

		/** Every day with at least one workout ticked off, oldest first. */
		get activeDays() {
			const keys = Object.keys(this.history).filter((k) => this.record(k));
			if (this.doneCount > 0) keys.push(this.date);
			return [...new Set(keys)].sort();
		},

		/** Consecutive days ending today (or yesterday, if today is still empty). */
		get streak() {
			let cursor = this.record(this.date) ? this.date : shiftKey(this.date, -1);
			let streak = 0;
			while (this.record(cursor)) {
				streak++;
				cursor = shiftKey(cursor, -1);
			}
			return streak;
		},

		get bestStreak() {
			const days = this.activeDays;
			let best = 0;
			let run = 0;
			days.forEach((key, i) => {
				run = i > 0 && days[i - 1] === shiftKey(key, -1) ? run + 1 : 1;
				best = Math.max(best, run);
			});
			return best;
		},

		get daysMoved() {
			return this.activeDays.length;
		},

		/** Days where everything scheduled got ticked off. */
		get perfectDays() {
			return this.activeDays.filter((key) => {
				const r = this.record(key);
				return r && r.total > 0 && r.count >= r.total;
			}).length;
		},

		/**
		 * A flat Sun-first run of days ending with the current week — the 7-column
		 * grid lays it out in rows, so no week nesting is needed.
		 */
		get calendarCells() {
			const today = new Date(`${this.date}T00:00:00`);
			const start = new Date(today);
			// Back up to the Sunday that starts the first row.
			start.setDate(start.getDate() - today.getDay() - (CALENDAR_WEEKS - 1) * 7);

			return Array.from({ length: CALENDAR_WEEKS * 7 }, (_, i) => {
				const cur = new Date(start);
				cur.setDate(start.getDate() + i);
				const key = todayKey(cur);
				const rec = this.record(key);
				return {
					key,
					day: cur.getDate(),
					isToday: key === this.date,
					future: key > this.date,
					full: Boolean(rec && rec.total > 0 && rec.count >= rec.total),
					partial: Boolean(rec) && !(rec.total > 0 && rec.count >= rec.total),
					label: rec ? `${this.formatDay(key)} — ${rec.count}/${rec.total}` : this.formatDay(key),
				};
			});
		},

		cellClass(cell) {
			if (cell.future) return 'border-2 border-dashed border-petal/60 text-petal';
			if (cell.full) return 'bg-rosy text-white';
			if (cell.partial) return 'bg-petal text-berry';
			return 'border-2 border-petal bg-white text-faded';
		},

		get historyRows() {
			return [...this.activeDays]
				.reverse()
				.slice(0, 14)
				.map((date) => {
					const { count, total } = this.record(date);
					return {
						date,
						count,
						total,
						percent: total ? Math.min(100, Math.round((count / total) * 100)) : 0,
						label: date === this.date ? 'Today' : this.formatDay(date),
					};
				});
		},

		resetToday() {
			this.completed = {};
			this.persist();
		},

		// ---- Presentation -----------------------------------------------------

		/** Flat chip colours, keyed off the workout's tag. */
		tagClass(tag) {
			return {
				Cardio: 'bg-blush text-berry',
				Legs: 'bg-[#f0e4fb] text-[#7d54b3]',
				Core: 'bg-[#e4ecfb] text-[#4a6aa8]',
				'Upper body': 'bg-[#dcf1ea] text-[#2f7a63]',
				Strength: 'bg-[#ffe8d6] text-[#c2652a]',
				Mobility: 'bg-[#fdf0cd] text-[#96701c]',
				Habit: 'bg-[#dff2f7] text-[#2b7a8c]',
			}[tag] || 'bg-blush text-berry';
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

		/** Circumference math for the progress ring (r = 34). */
		get ringDash() {
			const c = 2 * Math.PI * 34;
			return `${(this.percent / 100) * c} ${c}`;
		},
	};
}
