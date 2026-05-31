// Wonder Journal - Service Worker v1
const CACHE = 'wonder-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/index.css',
  '/dashboard/dashboard.html',
  '/dashboard/insights.html',
  '/dashboard/calendar.html',
  '/dashboard/settings.html',
  '/dashboard/app.css',
  '/dashboard/app.js',
];

// Reminder texts to rotate
const REMINDERS = [
  { title: '✨ Wonder Journal', body: 'Je hebt vandaag nog niets geschreven. Hoe was je dag?' },
  { title: '📖 Wonder Journal', body: 'Vergeet je streak niet! Schrijf even een paar zinnen.' },
  { title: '🌙 Wonder Journal', body: 'De dag loopt bijna ten einde. Hoe voel je je?' },
  { title: '💜 Wonder Journal', body: 'Jouw verhaal telt. Schrijf iets voor jezelf.' },
  { title: '🔥 Streak Alert!', body: 'Schrijf nu om je streak te behouden!' },
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
      if (res.ok) {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
      }
      return res;
    }).catch(() => cached))
  );
});

self.addEventListener('push', e => {
  const data = e.data?.json() || {};
  const msg = data.reminder
    ? REMINDERS[Math.floor(Math.random() * REMINDERS.length)]
    : { title: data.title || 'Wonder Journal', body: data.body || '' };

  e.waitUntil(
    self.registration.showNotification(msg.title, {
      body: msg.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      vibrate: [200, 100, 200],
      data: { url: '/dashboard/dashboard.html' },
      actions: [{ action: 'open', title: 'Schrijven' }]
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/dashboard/dashboard.html';
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then(list => {
      for (const c of list) {
        if (c.url.includes('dashboard') && 'focus' in c) return c.focus();
      }
      return clients.openWindow(url);
    })
  );
});

// Scheduled reminder check (triggered via client message)
self.addEventListener('message', e => {
  if (e.data?.type === 'SCHEDULE_REMINDER') {
    const now = new Date();
    const target = new Date();
    target.setHours(21, 0, 0, 0);
    if (now > target) target.setDate(target.getDate() + 1);
    const delay = target - now;

    setTimeout(() => {
      // Client will check if entry exists before actually sending push
      self.clients.matchAll().then(list => {
        list.forEach(c => c.postMessage({ type: 'CHECK_REMINDER' }));
      });
    }, delay);
  }

  // Year-end wrapped
  if (e.data?.type === 'YEAREND_WRAPPED') {
    self.registration.showNotification('🎉 Jouw Wonder Jaar in Beeld!', {
      body: e.data.body || 'Bekijk je persoonlijke jaaroverzicht — jouw verhaal van dit jaar.',
      icon: '/icons/icon-192.png',
      data: { url: '/dashboard/insights.html?view=yearwrap' },
      requireInteraction: true
    });
  }
});