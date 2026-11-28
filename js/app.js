// Vstupný bod: navigácia, globálne klávesnicové pravidlá, PWA, inicializácia modulov
import * as store from './store.js';
import { initRide } from './ride.js';
import { initFuel, refreshStations } from './fuel.js';
import { initHistory, renderHistory, editRideById } from './history.js';
import { startAuto, tick } from './auto.js';
import { initStats, renderStats } from './stats.js';
import { initAccount, gateAuth } from './account.js';
import * as sync from './sync.js';
import { $, $$, vibrate } from './util.js';

const TABS = ['ride', 'fuel', 'history', 'stats'];

function go(name, { fromUser = false } = {}) {
  if (!TABS.includes(name)) name = 'ride';
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  $$('[data-go]').forEach(b => {
    const on = b.dataset.go === name;
    b.classList.toggle('on', on);
    b.setAttribute('aria-selected', on);
  });
  document.activeElement?.blur?.();
  if (fromUser) { vibrate(8); window.scrollTo({ top: 0 }); }
  try { localStorage.setItem('pnbr.tab', name); } catch { /* ignore */ }
}

// --- navigácia ---
$('.rail').addEventListener('click', e => {
  const b = e.target.closest('[data-go]');
  if (b) go(b.dataset.go, { fromUser: true });
});

// --- klávesnica na mobile ---
// 1) ťuknutie mimo poľa schová klávesnicu
document.addEventListener('pointerdown', e => {
  const a = document.activeElement;
  if (!a || !/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return;
  if (e.target.closest('input,textarea,select')) return;
  a.blur();
}, { capture: true, passive: true });
// 2) Enter / „Hotovo" zavrie klávesnicu
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.matches?.('input:not([type=file]),select')) e.target.blur();
});
// 3) pri vstupe do číselného poľa označ obsah (rýchle prepísanie)
document.addEventListener('focusin', e => {
  const el = e.target;
  if (el.matches?.('input[inputmode="decimal"],input[inputmode="numeric"]') && !el.readOnly) setTimeout(() => { try { el.select(); } catch { /* ignore */ } }, 0);
});
// 4) readonly/auto polia nikdy nezískajú focus (poistka popri CSS pointer-events:none)
document.addEventListener('focusin', e => { if (e.target.matches?.('input.auto[readonly]')) e.target.blur(); });

// --- init ---
initRide();
initFuel();
initHistory();
initStats();
initAccount();

store.subscribe(() => {
  renderHistory();
  renderStats();
  refreshStations();
});

let start = 'ride';
try { start = localStorage.getItem('pnbr.tab') || 'ride'; } catch { /* ignore */ }
go(start);

// --- cloud + pravidelné jazdy ---
sync.autoStart();
gateAuth();
startAuto({ onEdit: editRideById });

/** Otvorí úpravu jazdy; ak ju cloud ešte nedoručil (otvorené z notifikácie), chvíľu počká. */
function openRideWhenReady(id, tries = 40) {
  if (store.byId(id)) return editRideById(id);
  if (tries > 0) setTimeout(() => openRideWhenReady(id, tries - 1), 300);
}
const qs = new URLSearchParams(location.search);
if (qs.get('edit')) { openRideWhenReady(qs.get('edit')); history.replaceState(null, '', location.pathname); }
navigator.serviceWorker?.addEventListener('message', e => {
  if (e.data?.type !== 'edit') return;
  tick();
  if (e.data.id) openRideWhenReady(e.data.id);
});

// --- PWA ---
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(() => {}));
}
