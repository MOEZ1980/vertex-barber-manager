
 // VERTEX HAMMAMI - Service Worker notifiche
 // Mantiene compatibilita con le notifiche prenotazione esistenti.
 self.addEventListener('install', () => self.skipWaiting());
 self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

 function safeAdminUrl(input) {
   const fallback = `${self.location.origin}/?view=bookings&status=pending`;
   if (typeof input !== 'string' || !input.trim()) return fallback;
   try {
     const parsed = new URL(input, self.location.origin);
     if (parsed.origin !== self.location.origin || !/^https?:$/.test(parsed.protocol)) return fallback;
     return parsed.href;
   } catch { return fallback; }
 }

 self.addEventListener('push', (event) => {
   let payload = {};
   try { payload = event.data ? event.data.json() : {}; }
   catch { payload = {body: event.data ? event.data.text() : ''}; }
   const destination = safeAdminUrl(payload.url || payload.open_url || (payload.data && payload.data.url));
   event.waitUntil(self.registration.showNotification(payload.title || 'VERTEX HAMMAMI', {
     body: payload.body || 'Nuova prenotazione ricevuta!',
     icon: '/icon-192.png',
     badge: '/icon-192.png',
     tag: payload.tag || '
