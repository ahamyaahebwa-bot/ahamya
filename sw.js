// Cedar Park: the website no longer works offline and no longer uses a service worker.
//
// KEEP THIS FILE on the website. Browsers that visited the old version still have the old
// service worker; when they next check this address they receive THIS version, which
// deletes every saved copy of the site and then removes itself.
self.addEventListener("install", function () {
    self.skipWaiting();
});

self.addEventListener("activate", function (event) {
    event.waitUntil(
        caches.keys()
            .then(function (keys) { return Promise.all(keys.map(function (k) { return caches.delete(k); })); })
            .then(function () { return self.registration.unregister(); })
    );
});

// No "fetch" handler on purpose: every request goes straight to the internet.