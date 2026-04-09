// Service Worker - Comando Vida 2.0
const CACHE_NAME = 'comando-vida-v24';
const ASSETS = [
    './',
    './index.html',
    './css/styles.css',
    './js/app.js',
    './js/store.js',
    './js/ui.js',
    './js/dashboard.js',
    './js/habits.js',
    './js/goals.js',
    './js/planner.js',
    './js/journal.js',
    './js/lifewheel.js',
    './js/stats.js',
    './js/review.js',
    './js/auth.js',
    './js/templates.js',
    './js/firebase-config.js',
    './js/profile.js',
    './js/config.js',
    './js/gamification.js',
    './js/daily-brief.js',
    './js/evening-reflection.js',
    './assets/avatars/avatar-01.svg',
    './assets/avatars/avatar-02.svg',
    './assets/avatars/avatar-03.svg',
    './assets/avatars/avatar-04.svg',
    './assets/avatars/avatar-05.svg',
    './assets/avatars/avatar-06.svg',
    './manifest.json'
];

// Install - cache all assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS))
            .then(() => self.skipWaiting())
    );
});

// Activate - clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

// Fetch - cache first, then network
self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    const isSameOrigin = url.origin === self.location.origin;
    if (!isSameOrigin) return;

    const isNavigation = request.mode === 'navigate';
    const isScriptOrStyle = request.destination === 'script' || request.destination === 'style';
    const isImageOrFont = request.destination === 'image' || request.destination === 'font';

    if (isNavigation) {
        // Navigation: network-first so login/app updates are not stuck in stale cache
        event.respondWith(
            fetch(request)
                .then((response) => {
                    if (response && response.status === 200) {
                        const copy = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', copy));
                    }
                    return response;
                })
                .catch(() => caches.match('./index.html'))
        );
        return;
    }

    if (isScriptOrStyle) {
        // Scripts/styles: network-first so broken cached bundles are not reused
        event.respondWith(
            fetch(request)
                .then((response) => {
                    if (response && response.status === 200) {
                        const copy = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
                    }
                    return response;
                })
                .catch(() => caches.match(request))
        );
        return;
    }

    if (isImageOrFont) {
        // Images/fonts: stale-while-revalidate
        event.respondWith(
            caches.match(request).then((cached) => {
                const networkFetch = fetch(request)
                    .then((response) => {
                        if (response && response.status === 200) {
                            const copy = response.clone();
                            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
                        }
                        return response;
                    })
                    .catch(() => cached);
                return cached || networkFetch;
            })
        );
        return;
    }
});
