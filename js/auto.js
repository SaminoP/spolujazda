// Pravidelné jazdy (nedeľa PN➔Brno, piatok Brno➔PN, 19:00 …).
//  • Hlavnú prácu robí SERVER (Netlify plánovaná funkcia): o stanovenom čase jazdu vytvorí v cloude a pošle push
//    notifikáciu aj keď je aplikácia zatvorená.
//  • Aplikácia tu drží nastavenie (zrkadlí ho do cloudu) a navyše „dobieha" zmeškané termíny lokálne, takže
//    jazda nikdy nechýba ani bez servera/internetu. ID jazdy = dátum + smer, preto sa nikdy nezdvojí.
import * as store from './store.js';
import * as sync from './sync.js';
import { KM, routeLabel, rideTotals } from './calc.js';
import { eur, fmtDate, pad, round2 } from './util.js';
import { confirmDialog } from './ui.js';

export const DAYS = ['Nedeľa', 'Pondelok', 'Utorok', 'Streda', 'Štvrtok', 'Piatok', 'Sobota'];
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const cfg = () => store.settings().auto;

export function saveCfg(patch) {
  const next = { ...cfg(), ...patch };
  store.setSettings({ auto: next });
  sync.pushAutoConfig(next);
}

/** Termíny, ktoré nastali po `c.since` (max. 14 dní späť). */
export function dueOccurrences(c, now = new Date()) {
  const [h, m] = (c.time || '19:00').split(':').map(Number);
  const out = [];
  for (let k = 13; k >= 0; k--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - k, h || 0, m || 0, 0, 0);
    for (const r of c.rules) {
      if (d.getDay() === r.dow && d <= now && d.getTime() > (c.since || 0)) out.push({ id: `auto-${iso(d)}-${r.dir}`, date: iso(d), dir: r.dir });
    }
  }
  return out;
}

/** Šablóna: pasažieri z poslednej jazdy v rovnakom smere (platby vynulované), inak 1 pasažier na účet. */
function buildAuto(o) {
  const s = store.settings();
  const last = store.items().filter(i => i.type === 'ride' && i.dir === o.dir)
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.updatedAt || 0) - (a.updatedAt || 0))[0];
  const pax = last
    ? last.pax.map(p => ({ ...p, paid: false, moved: false }))
    : [{ method: 'bank', price: s.price, note: '', paid: false, moved: false }];
  const cons = last?.consumption ?? s.consumption;
  return { id: o.id, type: 'ride', date: o.date, dir: o.dir, km: KM, consumption: cons, liters: round2(KM * cons / 100), solo: pax.length === 0, pax, auto: true };
}

/** Vytvorí všetky zmeškané jazdy lokálne. Vráti zoznam nových. */
export function createDue() {
  const c = cfg();
  if (!c?.enabled) return [];
  const known = new Set(store.allItems().map(i => i.id)); // aj zmazané -> zmazaná jazda sa nevytvorí znova
  const due = dueOccurrences(c);
  if (!due.length) return [];
  const created = due.filter(o => !known.has(o.id)).map(buildAuto).filter(r => store.upsert(r));
  saveCfg({ since: Date.now() });
  return created;
}

const rideText = ride => {
  const t = rideTotals(ride);
  return `${fmtDate(ride.date)} · ${t.people ? `${t.people} pas.` : 'sám'} · ${eur(t.total)}\nChceš v jazde zmeniť údaje?`;
};

let openEdit = () => {};

/** Otvorená aplikácia: dialóg „Jazda pridaná – upraviť?". (Zatvorená aplikácia dostane push zo servera.) */
export async function announce(rides) {
  if (!rides.length || document.visibilityState !== 'visible') return;
  const last = rides[rides.length - 1];
  const yes = await confirmDialog(`${routeLabel(last.dir)} · ${rideText(last)}${rides.length > 1 ? `\n(+ ${rides.length - 1} ďalšie)` : ''}`,
    { title: 'Jazda automaticky pridaná ✓', ok: 'Upraviť údaje', cancel: 'Nechať', danger: false });
  if (yes) openEdit(last.id);
}

export function tick() {
  const created = createDue();
  announce(created);
  return created;
}

export function startAuto({ onEdit }) {
  openEdit = onEdit;
  tick();
  setInterval(tick, 30000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') tick(); });
}
