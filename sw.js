// Service worker Maxxima: rangkaian dahulu (supaya kemas kini terus sampai), cache sebagai sandaran luar talian.
// Hanya fail aplikasi di domain sendiri — data Supabase TIDAK disimpan dalam cache.
const CACHE = 'maxxima-v26';
const CORE = ['./', 'index.html', 'css/app.css', 'js/main.js', 'assets/logo.png', 'assets/icon-192.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).catch(() => {})); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(fetch(r).then(res => { if (res.ok && res.type === 'basic') { const cp = res.clone(); caches.open(CACHE).then(c => c.put(r, cp)); } return res; })
    .catch(() => caches.match(r).then(m => m || (r.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
});
self.addEventListener('notificationclick', e => {
  e.notification.close(); const link = e.notification.data?.link || '';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(cs => {
    const c = cs.find(x => x.url.startsWith(self.registration.scope)); if (c) { c.focus(); if (link) c.navigate(self.registration.scope + '#' + link).catch(() => {}); return; }
    return self.clients.openWindow(self.registration.scope + (link ? '#' + link : ''));
  }));
});
// Notifikasi push dari pelayan (sampai walaupun app ditutup)
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch { d = { title: 'Maxxima', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Maxxima Badminton Academy', { body: d.body || '', icon: 'assets/icon-192.png', badge: 'assets/icon-192.png', tag: d.id || d.tag, data: { link: d.link || '' }, vibrate: [120, 60, 120] }));
});
self.addEventListener('pushsubscriptionchange', () => { /* app melanggan semula ketika dibuka (ensurePush) */ });
