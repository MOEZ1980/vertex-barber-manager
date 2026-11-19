(() => {
  'use strict';

  // Browser-side publishable Supabase key only. The password and service-role key are never stored here.
  const SUPABASE_URL = 'https://xdyrujptrggyhltljmlm.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_PJLP34HkqWKZbwhsN65KKA_12wdK7V8';
  const SESSION_KEY = 'vertex_apex_session_v1';
  const API_BOOKINGS = '/functions/v1/admin-bookings';
  const $ = (selector) => document.querySelector(selector);
  const dayFormat = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome' });
  const dateTimeFormat = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const fullDateFormat = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const monthFormat = new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric' });
  const romeClock = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const dayNames = ['LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB', 'DOM'];
  const labels = { pending: 'In attesa', confirmed: 'Confermato', rejected: 'Rifiutato', cancelled: 'Annullato', blocked: 'Orario bloccato' };
  let visibleMonth = new Date();
  let selectedDate = new Date();
  let bookings = [];
  let barbers = [];
  let session = readSession();
  let busy = false;
  let editingBookingId = '';

  function isBlockedTime(item) {
    const status = String(item.status || '').trim().toLowerCase();
    const customerName = String(item.customer_name || '').trim().toLocaleUpperCase('it-IT');
    const serviceName = String(item.service_name || '').trim().toLocaleLowerCase('it-IT');
    return status === 'blocked' || customerName === 'BLOCCATO' || /^pausa(?:\b|\s|·)/i.test(serviceName);
  }

  function readSession() {
    try { const value = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); return value?.access_token && value?.refresh_token ? value : null; }
    catch { localStorage.removeItem(SESSION_KEY); return null; }
  }
  function saveSession(value) {
    session = { access_token: value.access_token, refresh_token: value.refresh_token, expires_at: Date.now() + Math.max(0, Number(value.expires_in || 3600)) * 1000 };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }
  function clearSession() { session = null; localStorage.removeItem(SESSION_KEY); }
  function message(text, kind = 'info', login = false) {
    const el = login ? $('#loginMessage') : $('#appMessage');
    el.textContent = text;
    el.className = login ? `form-message ${kind}` : `app-message ${kind}`;
    el.hidden = false;
  }
  function showApp(isSignedIn) {
    $('#loginView').hidden = isSignedIn;
    $('#dashboardView').hidden = !isSignedIn;
    $('#logoutButton').hidden = !isSignedIn;
    $('#mobileNav').hidden = !isSignedIn;
  }
  async function refreshSession(force = false) {
    if (!session) throw new Error('Sessione terminata. Accedi di nuovo.');
    if (!force && session.expires_at > Date.now() + 90000) return session.access_token;
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
      body: JSON.stringify({ refresh_token: session.refresh_token })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { clearSession(); throw new Error(data.error_description || data.msg || 'Sessione scaduta. Accedi di nuovo.'); }
    saveSession(data);
    return session.access_token;
  }
  async function api(path, body, auth = true) {
    if (auth && session) await refreshSession();
    const send = () => fetch(SUPABASE_URL + path, {
      method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, ...(auth && session ? { Authorization: `Bearer ${session.access_token}` } : {}) },
      body: JSON.stringify(body)
    });
    let response = await send();
    if (response.status === 401 && auth && session) { await refreshSession(true); response = await send(); }
    const raw = await response.text();
    let data = {}; try { data = raw ? JSON.parse(raw) : {}; } catch { data = { error: raw.slice(0, 300) }; }
    if (!response.ok) throw new Error(data.error_description || data.msg || data.error || data.message || `Errore HTTP ${response.status}`);
    return data;
  }
  function vapidToBytes(base64) {
    const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
    const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(raw, (character) => character.charCodeAt(0));
  }
  $('#enableNotifications')?.addEventListener('click', async (event) => {
    const button = event.currentTarget; const status = $('#pushStatus');
    if (!session) { status.textContent = 'Accedi come amministratore prima di attivare le notifiche.'; return; }
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) { status.textContent = 'Le notifiche Push non sono supportate su questo dispositivo/browser.'; return; }
    button.disabled = true; status.textContent = 'Attivazione notifiche in corso…';
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error('Permesso notifiche non concesso.');
      const registration = await navigator.serviceWorker.register('./vertex-sw.js');
      const keyData = await api('/functions/v1/vertex-push', { action: 'public_key' });
      if (!keyData.publicKey) throw new Error('Chiave pubblica Push non disponibile.');
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidToBytes(keyData.publicKey) });
      const result = await api('/functions/v1/vertex-push', { action: 'subscribe', subscription: subscription.toJSON() });
      if (!result.success) throw new Error('Registrazione dispositivo non riuscita.');
      status.textContent = '✅ Questo dispositivo è registrato per ricevere le notifiche.';
    } catch (error) { status.textContent = `Notifiche non attivate: ${error.message}`; }
    finally { button.disabled = false; }
  });
  $('#testPushNotification')?.addEventListener('click', async (event) => {
    const button = event.currentTarget; const status = $('#pushStatus');
    if (!session) { status.textContent = 'Accedi come amministratore per inviare una prova.'; return; }
    button.disabled = true; status.textContent = 'Invio notifica di prova…';
    try {
      const result = await api('/functions/v1/vertex-push-send', { action: 'test' });
      status.textContent = `Prova completata · Inviate: ${result.sent ?? 0} · Non inviate: ${result.failed ?? 0}`;
    } catch (error) { status.textContent = `Prova non riuscita: ${error.message}`; }
    finally { button.disabled = false; }
  });
  const romeDay = (value) => dayFormat.format(new Date(value));
  const bookingTime = (value) => new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value));
  function currentMonthKey() { return `${visibleMonth.getFullYear()}-${String(visibleMonth.getMonth() + 1).padStart(2, '0')}`; }
  function filteredBookings() {
    const filter = $('#statusFilter').value;
    return bookings.filter((booking) => {
      if (!booking.starts_at || !Number.isFinite(new Date(booking.starts_at).getTime())) return false;
      const date = new Date(booking.starts_at);
      const key = `${date.toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' }).slice(0, 7)}`;
      return key === currentMonthKey() && (filter === 'all' || booking.status === filter);
    }).sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
  }
  function setSelectedDate(date) {
    selectedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    $('#selectedDateTitle').textContent = fullDateFormat.format(selectedDate);
    renderCalendar(); renderDay();
    if (window.innerWidth < 900) $('#dayPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function renderCalendar() {
    const grid = $('#calendarGrid'); grid.replaceChildren();
    $('#monthTitle').textContent = monthFormat.format(visibleMonth).replace(/^./, (c) => c.toLocaleUpperCase('it-IT'));
    dayNames.forEach((name) => { const label = document.createElement('div'); label.className = 'calendar-cell weekday'; label.textContent = name; grid.append(label); });
    const first = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7;
    const start = new Date(first.getFullYear(), first.getMonth(), first.getDate() - offset);
    const todayKey = romeDay(Date.now());
    const monthBookings = filteredBookings();
    for (let i = 0; i < 42; i++) {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const key = dayFormat.format(date);
      const items = monthBookings.filter((item) => romeDay(item.starts_at) === key && !['cancelled', 'rejected', 'unblocked'].includes(String(item.status || '').toLowerCase()));
      const cell = document.createElement('button'); cell.type = 'button'; cell.className = 'calendar-cell';
      if (date.getMonth() !== visibleMonth.getMonth()) cell.classList.add('other');
      if (key === todayKey) cell.classList.add('today');
      if (key === dayFormat.format(selectedDate)) cell.classList.add('chosen');
      const dayNumber = document.createElement('span'); dayNumber.textContent = String(date.getDate()); cell.append(dayNumber);
      items.slice(0, 2).forEach((item) => { const chip = document.createElement('span'); chip.className = 'appointment-chip'; chip.title = `${bookingTime(item.starts_at)} ${item.customer_name || 'Cliente'}`; chip.textContent = `${bookingTime(item.starts_at)} ${item.customer_name || 'Cliente'}`; cell.append(chip); });
      if (items.length > 2) { const extra = document.createElement('small'); extra.className = 'more-count'; extra.textContent = `+${items.length - 2}`; cell.append(extra); }
      cell.setAttribute('aria-label', `${fullDateFormat.format(date)}${items.length ? `, ${items.length} appuntamenti` : ''}`);
      cell.addEventListener('click', () => setSelectedDate(date)); grid.append(cell);
    }
  }
  function actionButton(text, action, style = '') {
    const button = document.createElement('button'); button.type = 'button'; button.className = `booking-action ${style}`.trim(); button.textContent = text;
    button.disabled = busy; button.addEventListener('click', action); return button;
  }
  function renderBookingCard(booking) {
    const blocked = isBlockedTime(booking);
    const card = document.createElement('article'); card.className = `booking-card ${blocked ? 'blocked' : ''}`;
    const heading = document.createElement('div'); heading.className = 'booking-heading';
    const name = document.createElement('strong'); name.textContent = blocked ? 'Orario bloccato' : booking.customer_name || 'Cliente';
    const time = document.createElement('span'); time.textContent = `${bookingTime(booking.starts_at)}${booking.ends_at ? ` – ${bookingTime(booking.ends_at)}` : ''}`;
    heading.append(name, time); card.append(heading);
    const details = document.createElement('p'); details.className = 'booking-details'; details.textContent = blocked ? (booking.service_name || 'Blocco orario') : `${booking.service_name || 'Servizio'} · ${booking.customer_phone || 'Nessun telefono'}`; card.append(details);
    const status = document.createElement('span'); status.className = `booking-status ${blocked ? 'blocked' : booking.status || ''}`; status.textContent = blocked ? 'Orario bloccato' : labels[booking.status] || booking.status || '—'; card.append(status);
    const actions = document.createElement('div'); actions.className = 'booking-actions';
    const archived = ['cancelled', 'rejected'].includes(String(booking.status || '').toLowerCase());
    if (!blocked && !archived && booking.status !== 'unblocked') actions.append(actionButton('Modifica', () => openEdit(booking), 'edit-action'));
    if (!blocked && archived) actions.append(actionButton('Elimina', () => deleteBooking(booking), 'danger'));
    if (!blocked && booking.status === 'pending') {
      actions.append(actionButton('Conferma', () => changeStatus(booking, 'confirmed')), actionButton('Rifiuta', () => changeStatus(booking, 'rejected'), 'danger'));
    }
    if (!blocked && booking.status === 'confirmed') actions.append(actionButton('Annulla', () => changeStatus(booking, 'cancelled'), 'secondary'));
    if (blocked) actions.append(actionButton('Sblocca', () => unblockTime(booking), 'secondary'));
    card.append(actions); return card;
  }
  function renderDay() {
    const host = $('#dayAppointments'); host.replaceChildren();
    const key = dayFormat.format(selectedDate);
    const items = filteredBookings().filter((booking) => romeDay(booking.starts_at) === key);
    $('#dayCount').textContent = String(items.length);
    if (!items.length) { const empty = document.createElement('div'); empty.className = 'empty-state'; empty.innerHTML = '<div class="empty-symbol">✦</div><strong>Nessun appuntamento in questa data</strong><p>Quando arrivano prenotazioni, le trovi qui.</p>'; host.append(empty); return; }
    items.forEach((item) => host.append(renderBookingCard(item)));
  }
  function renderMonthList() {
    const host = $('#monthAppointments'); host.replaceChildren();
    const items = filteredBookings();
    if (!items.length) { const empty = document.createElement('div'); empty.className = 'empty-row'; empty.innerHTML = '<span>—</span><div><strong>Nessun appuntamento per questo filtro</strong><p>Prova un altro stato o un altro mese.</p></div>'; host.append(empty); return; }
    const groups = new Map(); items.forEach((item) => { const key = romeDay(item.starts_at); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(item); });
    groups.forEach((entries, key) => {
      const group = document.createElement('section'); group.className = 'date-group';
      const title = document.createElement('button'); title.type = 'button'; title.className = 'date-group-title'; title.textContent = fullDateFormat.format(new Date(`${key}T12:00:00`)); title.addEventListener('click', () => setSelectedDate(new Date(`${key}T12:00:00`))); group.append(title);
      entries.forEach((item) => group.append(renderBookingCard(item))); host.append(group);
    });
  }
  function renderStats() {
    const today = dayFormat.format(new Date());
    $('#todayCount').textContent = String(bookings.filter((item) => item.status !== 'cancelled' && item.status !== 'rejected' && romeDay(item.starts_at) === today).length);
    $('#pendingCount').textContent = String(bookings.filter((item) => item.status === 'pending').length);
    $('#activeCount').textContent = String(bookings.filter((item) => ['pending', 'confirmed'].includes(item.status)).length);
  }
  function renderAll() { renderStats(); renderCalendar(); renderDay(); renderMonthList(); }
  async function loadBookings() {
    if (busy) return; busy = true; $('#refreshButton').disabled = true; $('#refreshButton').textContent = '…';
    try {
      const data = await api(API_BOOKINGS, { action: 'list' });
      const list = Array.isArray(data) ? data : Array.isArray(data.bookings) ? data.bookings : Array.isArray(data.data) ? data.data : null;
      if (!list) throw new Error('Il servizio ha restituito un formato inatteso.');
      bookings = list; busy = false; renderAll(); if (!$('#blocksView').hidden) renderBlockedTimes(); message(`Aggiornato · ${bookings.length} prenotazioni`, 'success');
    } catch (error) { message(`Aggiornamento non riuscito: ${error.message}`, 'error'); }
    finally { busy = false; $('#refreshButton').disabled = false; $('#refreshButton').textContent = '↻'; }
  }
  async function loadBarbers() {
    try {
      const data = await api(API_BOOKINGS, { action: 'barbers_list' });
      barbers = Array.isArray(data.barbers) ? data.barbers : [];
      renderBarbers();
    } catch (error) { message(`Elenco barbieri non aggiornato: ${error.message}`, 'error'); }
  }
  function renderBarbers() {
    const host = $('#barberList'); if (!host) return;
    host.replaceChildren();
    barbers.forEach((barber) => {
      const row = document.createElement('article'); row.className = 'client-row barber-row';
      const name = document.createElement('strong'); name.textContent = barber.name;
      const state = document.createElement('small'); state.textContent = barber.is_active ? 'Attivo' : 'Non attivo';
      const toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'booking-action secondary'; toggle.textContent = barber.is_active ? 'Disattiva' : 'Attiva';
      toggle.addEventListener('click', async () => {
        toggle.disabled = true;
        try {
          if (!barber.is_active && Number(barber.id) !== 1) {
            const name = window.prompt('Inserisci il nome del barbiere per attivare questo posto:', barber.name);
            if (name === null) { toggle.disabled = false; return; }
            if (!name.trim() || name.trim().length > 80) throw new Error('Inserisci un nome valido, massimo 80 caratteri.');
            await api(API_BOOKINGS, { action: 'barber_rename_activate', barber_id: barber.id, name: name.trim() });
          } else {
            await api(API_BOOKINGS, { action: 'barber_toggle', barber_id: barber.id, is_active: !barber.is_active });
          }
          await loadBarbers(); message('Stato del barbiere aggiornato.', 'success');
        } catch (error) { toggle.disabled = false; message(`Modifica non riuscita: ${error.message}`, 'error'); }
      });
      row.append(name, state, toggle); host.append(row);
    });
    if (!barbers.length) { const empty = document.createElement('p'); empty.className = 'empty-state compact'; empty.textContent = 'Nessun nome configurato.'; host.append(empty); }
  }
  async function changeStatus(booking, status) {
    if (!booking?.id || busy) return;
    const label = labels[status] || status;
    if (!window.confirm(`Confermi «${booking.customer_name || 'Cliente'}» come «${label}»?`)) return;
    let waTab = null;
    const waUrl = ['confirmed', 'rejected'].includes(status) ? whatsappDraft(booking, status) : '';
    if (waUrl) { waTab = window.open('about:blank', '_blank'); if (waTab) waTab.opener = null; }
    try {
      busy = true; message('Salvataggio in corso…');
      await api(API_BOOKINGS, { action: 'update', id: booking.id, status });
      busy = false;
      if (waTab && !waTab.closed && waUrl) waTab.location.replace(waUrl);
      else if (waUrl) window.location.href = waUrl;
      await loadBookings();
    } catch (error) { busy = false; if (waTab && !waTab.closed) waTab.close(); message(`Modifica non salvata: ${error.message}`, 'error'); }
  }
  async function deleteBooking(booking) {
    if (busy || !booking?.id || !window.confirm(`Eliminare definitivamente la prenotazione di «${booking.customer_name || 'Cliente'}»?`)) return;
    try {
      busy = true; message('Eliminazione in corso…');
      await api('/rest/v1/rpc/vertex_admin_delete_bookings', { p_booking_ids: [booking.id] });
      busy = false; await loadBookings(); message('Prenotazione eliminata.', 'success');
    } catch (error) { busy = false; message(`Eliminazione non riuscita: ${error.message}`, 'error'); }
  }
  async function unblockTime(booking) {
    if (busy || !booking?.id || !window.confirm(`Sbloccare l’orario delle ${bookingTime(booking.starts_at)}?`)) return;
    try { busy = true; await api('/functions/v1/admin-schedule', { action: 'unblock', id: booking.id }); busy = false; await loadBookings(); }
    catch (error) { busy = false; message(`Sblocco non riuscito: ${error.message}`, 'error'); }
  }
  function whatsappDraft(booking, status) {
    const phone = whatsappNumber(booking.customer_phone);
    if (!phone) return '';
    const when = dateTimeFormat.format(new Date(booking.starts_at));
    const maps = 'https://www.google.com/maps/search/?api=1&query=VERTEX%20by%20HAMMAMI&query_place_id=ChIJ46O6CplJeUcRbBb5pm9VDqM';
    const text = status === 'confirmed'
      ? `Ciao ${booking.customer_name || ''},\n\n✅ VERTEX HAMMAMI ha confermato il tuo appuntamento.\n📅 Data e ora: ${when}\n✂️ Servizio: ${booking.service_name || '—'}\n\n📍 Via Terraglio 111, Frescada, Preganziol, Italia\n${maps}\n\nTi aspettiamo!`
      : `Ciao ${booking.customer_name || ''}, mi dispiace, l’orario che hai richiesto non è disponibile. Puoi scegliere un altro orario qui https://www.vertexhammami.it/#prenota. Grazie, VERTEX HAMMAMI.`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  }
  function whatsappNumber(rawValue) {
    const raw = String(rawValue || '').trim();
    let phone = raw.replace(/[^\d+]/g, '');
    if (phone.startsWith('00')) phone = phone.slice(2); else if (phone.startsWith('+')) phone = phone.slice(1); else if (/^3\d{9}$/.test(phone)) phone = `39${phone}`;
    return /^\d{8,15}$/.test(phone) && (raw.startsWith('+') || raw.startsWith('00') || /^393\d{9}$/.test(phone)) ? phone : '';
  }
  function whatsappCustomerDraft(booking, modified = false) {
    const phone = whatsappNumber(booking.customer_phone);
    if (!phone) return '';
    const name = String(booking.customer_name || '').trim();
    const greeting = name ? `Ciao ${name},` : 'Ciao,';
    const when = dateTimeFormat.format(new Date(booking.starts_at));
    const text = modified
      ? `${greeting}\n\nLa tua prenotazione VERTEX HAMMAMI è stata aggiornata.\n📅 Data e ora: ${when}\n✂️ Servizio: ${booking.service_name || '—'}\n\nSe hai domande, rispondi a questo messaggio.\nVERTEX HAMMAMI`
      : `${greeting}\n\nTi contattiamo da VERTEX HAMMAMI.\nA presto!`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  }
  function romeParts(value) {
    const parts = {}; for (const part of romeClock.formatToParts(new Date(value))) if (part.type !== 'literal') parts[part.type] = part.value;
    return { day: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
  }
  function romeToISO(day, time) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Data o ora non valida.');
    const [year, month, date] = day.split('-').map(Number); const [hour, minute] = time.split(':').map(Number); const wall = Date.UTC(year, month - 1, date, hour, minute);
    const options = [wall - 3600000, wall - 7200000].filter((ms) => { const p = romeParts(ms); return p.day === day && p.time === time; });
    if (!options.length) throw new Error('Quest’ora non esiste in Italia per il cambio dell’ora legale.');
    return new Date(Math.min(...options)).toISOString();
  }
  function openEdit(booking) {
    if (busy) return; editingBookingId = booking.id; const start = romeParts(booking.starts_at);
    $('#editName').value = booking.customer_name || ''; $('#editPhone').value = booking.customer_phone || '';
    $('#editService').value = booking.service_name || ''; $('#editPrice').value = booking.price ?? 0;
    $('#editDuration').value = Math.max(5, Math.round((new Date(booking.ends_at) - new Date(booking.starts_at)) / 60000) || 15);
    $('#editDate').value = start.day; $('#editTime').value = start.time; $('#editDialog').showModal();
  }
  $('#blockDate').value = romeParts(Date.now()).day;
  $('#blockForm').addEventListener('submit', async (event) => {
    event.preventDefault(); if (busy) return;
    try {
      const day = $('#blockDate').value; const startTime = $('#blockStart').value; const endTime = $('#blockEnd').value;
      if (endTime <= startTime) throw new Error('L’ora finale deve essere successiva a quella iniziale.');
      const starts_at = romeToISO(day, startTime); const ends_at = romeToISO(day, endTime);
      if (!window.confirm(`Bloccare il ${day} dalle ${startTime} alle ${endTime}?`)) return;
      busy = true; await api('/functions/v1/admin-schedule', { action: 'block', starts_at, ends_at, reason: $('#blockReason').value.trim() });
      busy = false; await loadBookings(); message('Orario bloccato.');
    } catch (error) { busy = false; message(`Blocco non riuscito: ${error.message}`, 'error'); }
  });
  $('#editForm').addEventListener('submit', async (event) => {
    event.preventDefault(); if (busy || !editingBookingId) return;
    try {
      const original = bookings.find((item) => String(item.id) === String(editingBookingId));
      const starts_at = romeToISO($('#editDate').value, $('#editTime').value); const minutes = Number($('#editDuration').value);
      if (!Number.isInteger(minutes) || minutes < 5 || minutes > 240) throw new Error('La durata deve essere tra 5 e 240 minuti.');
      if (!window.confirm('Salvare le modifiche a questa prenotazione?')) return;
      const updated = { ...original, customer_name: $('#editName').value.trim(), customer_phone: $('#editPhone').value.trim(), service_name: $('#editService').value.trim(), starts_at };
      const waUrl = whatsappCustomerDraft(updated, true);
      const waTab = waUrl ? window.open('about:blank', '_blank') : null;
      if (waTab) waTab.opener = null;
      busy = true; await api('/functions/v1/admin-schedule', { action: 'edit', id: editingBookingId, customer_name: updated.customer_name, customer_phone: updated.customer_phone, service_name: updated.service_name, price: Number($('#editPrice').value), starts_at, ends_at: new Date(new Date(starts_at).getTime() + minutes * 60000).toISOString() });
      busy = false; $('#editDialog').close(); await loadBookings(); message('Prenotazione modificata.');
      if (waUrl) { if (waTab && !waTab.closed) waTab.location.replace(waUrl); else window.location.href = waUrl; }
    } catch (error) { busy = false; message(`Modifica non salvata: ${error.message}`, 'error'); }
  });
  $('#cancelEdit').addEventListener('click', () => $('#editDialog').close());
  $('#closeEdit').addEventListener('click', () => $('#editDialog').close());

  $('#loginForm').addEventListener('submit', async (event) => {
    event.preventDefault(); const button = $('#loginButton'); button.disabled = true;
    try {
      const data = await api('/auth/v1/token?grant_type=password', { email: $('#loginEmail').value.trim(), password: $('#loginPassword').value }, false);
      saveSession(data); $('#loginPassword').value = ''; showApp(true); renderCalendar(); setSelectedDate(new Date()); await Promise.all([loadBookings(), loadBarbers()]);
    } catch (error) { message(`Accesso non riuscito: ${error.message}`, 'error', true); }
    finally { button.disabled = false; }
  });
  $('#logoutButton').addEventListener('click', async () => {
    const token = session?.access_token; clearSession(); bookings = []; showApp(false); $('#loginMessage').hidden = true;
    if (token) fetch(`${SUPABASE_URL}/auth/v1/logout`, { method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` } }).catch(() => {});
  });
  $('#refreshButton').addEventListener('click', loadBookings);
  $('#statusFilter').addEventListener('change', renderAll);
  $('#prevMonth').addEventListener('click', () => { visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1); renderAll(); });
  $('#nextMonth').addEventListener('click', () => { visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1); renderAll(); });
  $('#todayButton').addEventListener('click', () => { visibleMonth = new Date(); setSelectedDate(new Date()); window.scrollTo({ top: 0, behavior: 'smooth' }); });
  document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => {
    const view = button.dataset.view;
    document.querySelectorAll('.view').forEach((section) => { section.hidden = section.id !== `${view}View`; });
    document.querySelectorAll('[data-view]').forEach((item) => item.classList.toggle('selected', item.dataset.view === view));
    $('#pageTitle').textContent = view === 'agenda' ? 'Agenda' : view === 'clients' ? 'Clienti' : view === 'blocks' ? 'Orari bloccati' : 'Barbieri';
    if (view === 'clients') renderClients(); if (view === 'blocks') renderBlockedTimes(); window.scrollTo({ top: 0, behavior: 'smooth' });
  }));
  function renderClients() {
    const host = $('#clientList'); if (!host) return;
    host.replaceChildren();
    const query = ($('#clientSearch')?.value || '').trim().toLocaleLowerCase('it-IT');
    const grouped = new Map();
    bookings.filter((item) => !isBlockedTime(item) && String(item.status || '').toLowerCase() !== 'unblocked' && (item.customer_name || item.customer_phone)).forEach((item) => {
      const key = `${String(item.customer_name || '').trim().toLocaleLowerCase('it-IT')}|${String(item.customer_phone || '').replace(/\D/g, '')}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(item);
    });
    const records = [...grouped.values()].map((items) => {
      items.sort((a, b) => new Date(b.starts_at) - new Date(a.starts_at));
      return { latest: items[0], items };
    }).filter(({ latest }) => `${latest.customer_name || ''} ${latest.customer_phone || ''}`.toLocaleLowerCase('it-IT').includes(query));
    records.forEach(({ latest, items }) => {
      const row = document.createElement('article'); row.className = 'client-row client-record';
      const name = document.createElement('strong'); name.textContent = latest.customer_name || 'Cliente';
      const phone = document.createElement('a'); phone.textContent = latest.customer_phone || 'Telefono non disponibile'; if (latest.customer_phone) phone.href = `tel:${String(latest.customer_phone).replace(/[^+\d]/g, '')}`;
      const meta = document.createElement('small'); meta.textContent = `${items.length} prenotazion${items.length === 1 ? 'e' : 'i'} · ultima: ${latest.service_name || 'Servizio'} · ${dateTimeFormat.format(new Date(latest.starts_at))}`;
      row.append(name, phone, meta);
      const actions = document.createElement('div'); actions.className = 'booking-actions client-actions';
      const waUrl = whatsappCustomerDraft(latest);
      if (waUrl) actions.append(actionButton('WhatsApp', () => window.open(waUrl, '_blank', 'noopener'), 'whatsapp-action'));
      const editable = items.find((item) => item.status !== 'blocked' && item.status !== 'unblocked');
      if (editable) actions.append(actionButton('Modifica ultima prenotazione', () => openEdit(editable), 'edit-action'));
      const hasUpcomingActive = items.some((item) => ['pending', 'confirmed'].includes(item.status) && new Date(item.starts_at).getTime() >= Date.now());
      if (!hasUpcomingActive) actions.append(actionButton('Cancella cliente', () => deleteClient(items), 'danger'));
      row.append(actions); host.append(row);
    });
    if (!records.length) { const p = document.createElement('p'); p.className = 'empty-state compact'; p.textContent = 'Nessun cliente trovato.'; host.append(p); }
  }
  async function deleteClient(items) {
    if (busy || !items?.length) return;
    const ids = items.map((item) => String(item.id)).filter(Boolean);
    if (!ids.length) return;
    const customerName = items[0].customer_name || 'questo cliente';
    if (!window.confirm(`Cancellare definitivamente la scheda di ${customerName} e tutte le sue ${ids.length} prenotazioni? Questa operazione non si può annullare.`)) return;
    try {
      busy = true; message('Cancellazione in corso…');
      for (let i = 0; i < ids.length; i += 100) {
        await api('/rest/v1/rpc/vertex_admin_delete_bookings', { p_booking_ids: ids.slice(i, i + 100) });
      }
      busy = false; await loadBookings(); renderClients(); message('Cliente e prenotazioni cancellati.', 'success');
    } catch (error) { busy = false; message(`Cancellazione non riuscita: ${error.message}`, 'error'); }
  }
  
function renderBlockedTimes() {
  const host = $('#blockedTimesList');
  if (!host) return;

  host.replaceChildren();

  const items = bookings
    .filter(item =>
      isBlockedTime(item) &&
!['unblocked', 'cancelled', 'canceled'].includes(String(item.status || '').toLowerCase())    )
    .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));

  if (!items.length) {
    const p = document.createElement('p');
    p.className = 'empty-state compact';
    p.textContent = 'Nessun orario bloccato.';
    host.append(p);
    return;
  }

  const giorno = new Intl.DateTimeFormat('it-IT', {
    timeZone: 'Europe/Rome',
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });

  const ora = new Intl.DateTimeFormat('it-IT', {
    timeZone: 'Europe/Rome',
    hour: '2-digit',
    minute: '2-digit'
  });

  items.forEach(item => {
    const card = renderBookingCard(item);
    const heading = card.querySelector('.booking-heading');
    const start = new Date(item.starts_at);
    const end = new Date(item.ends_at);

    if (heading && !isNaN(start.getTime()) && !isNaN(end.getTime())) {
      const info = document.createElement('div');
      info.style.cssText = 'font-weight:600;line-height:1.6;margin-top:8px;';
      info.textContent =
        `${giorno.format(start)} | ${ora.format(start)} - ${ora.format(end)}`;
      heading.append(info);
    }

    host.append(card);
  });
}

  $('#refreshBlocksButton')?.addEventListener('click', loadBookings);
  $('#clientSearch')?.addEventListener('input', renderClients);
  $('#addBarberForm').addEventListener('submit', async (event) => {
    event.preventDefault(); const input = $('#newBarberName'); const name = input.value.trim(); if (!name || busy) return;
    try { await api(API_BOOKINGS, { action: 'barber_add', name }); input.value = ''; await loadBarbers(); message('Nome aggiunto al team.', 'success'); }
    catch (error) { message(`Impossibile aggiungere il nome: ${error.message}`, 'error'); }
  });
  showApp(false); renderCalendar();
  // Restore a saved login only after validating its refresh token.
  if (session) refreshSession(true).then(() => { showApp(true); Promise.all([loadBookings(), loadBarbers()]); }).catch(() => { clearSession(); showApp(false); });
})();
