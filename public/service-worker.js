self.addEventListener('install', e => {
    e.waitUntil(
        caches.open('moleflap3-v1').then(cache => {
            return cache.addAll([
                '/',
                '/bundle.min.js',
                '/style.css',
                '/mole_people.jpg',
                '/icon-16.jpg',
                '/icon-32.jpg',
                '/icon-64.jpg',
                '/icon-96.jpg',
                '/icon-128.jpg',
                '/icon-144.jpg'
            ])
                .then(() => self.skipWaiting())
        })
    )
})

self.addEventListener('activate',  event => {
    event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request)
        })
    )
})
