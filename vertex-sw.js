self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; }
  catch { data = { body: event.data ? event.data.text() : '' }; }
  event.waitUntil(self.registration.showNotification(data.title || 'VERTEX HAMMAMI', {
    body: data.body || 'Nuova prenotazione ricevuta!',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'vertex-booking',
    renotify: true,
    // Always open the new admin root; ignore any old admin URL in queued push payloads.
    data: { url: `${self.location.origin}/` }
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = `${self.location.origin}/?view=bookings&status=pending`;
  event.waitUntil(self.clients.openWindow(url));
});
