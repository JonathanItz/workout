// Bump VERSION to push a new build to installed devices.
const VERSION = 'v1';
const SHELL = `movement-shell-${VERSION}`;
const RUNTIME = `movement-runtime-${VERSION}`;

// Same-origin files the app needs to boot. Paths resolve against this script's
// location, so the app still works from a GitHub Pages subpath.
const SHELL_FILES = [
	'./',
	'./index.html',
	'./app.js',
	'./workouts.json',
	'./manifest.webmanifest',
	'./icons/icon-192.png',
	'./icons/icon-512.png',
	'./icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
	event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== RUNTIME).map((k) => caches.delete(k))))
			.then(() => self.clients.claim())
	);
});

/** Network first, falling back to whatever we cached last. */
async function networkFirst(request, cacheName, cacheKey = request) {
	const cache = await caches.open(cacheName);
	try {
		const response = await fetch(request);
		if (response.ok) cache.put(cacheKey, response.clone());
		return response;
	} catch {
		const cached = await cache.match(cacheKey, { ignoreSearch: true });
		if (cached) return cached;
		throw new Error('offline and not cached');
	}
}

/** Serve from cache immediately, refresh in the background. */
async function staleWhileRevalidate(request, cacheName) {
	const cache = await caches.open(cacheName);
	const cached = await cache.match(request);
	const network = fetch(request)
		.then((response) => {
			// Opaque (cross-origin) responses have status 0 but are still worth keeping.
			if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
			return response;
		})
		.catch(() => cached);
	return cached || network;
}

self.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;

	const url = new URL(request.url);
	const sameOrigin = url.origin === self.location.origin;

	// Navigations: try the network so updates land, fall back to the cached page.
	if (request.mode === 'navigate') {
		event.respondWith(networkFirst(request, SHELL, './index.html'));
		return;
	}

	// The "database" — always prefer a fresh copy. app.js appends a cache-busting
	// query, so store and look it up under a stable key.
	if (sameOrigin && url.pathname.endsWith('/workouts.json')) {
		event.respondWith(networkFirst(request, SHELL, './workouts.json'));
		return;
	}

	// Everything else — our own assets plus the Tailwind/Alpine/Google Fonts CDNs.
	event.respondWith(staleWhileRevalidate(request, sameOrigin ? SHELL : RUNTIME));
});
