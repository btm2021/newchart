const CACHE_NAME = 'husky-v1';
const ASSETS = [
    '/',
    '/index.html',
    '/styles.css',
    '/menu.js',
    '/embed-app.js',
    '/favicon.ico'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});
