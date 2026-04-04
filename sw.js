// Service Worker - Comando Vida 2.0
const CACHE_NAME = 'comando-vida-v18';
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
    event.respondWith(
        caches.match(event.request)
            .then(cached => cached || fetch(event.request)
                .then(response => {
                    // Cache new successful requests
                    if (response.status === 200) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    }
                    return response;
                })
            )
            .catch(() => {
                // Offline fallback
                if (event.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
            })
    );
});
