// Čistá logika pre serverové funkcie (bez závislostí – dá sa testovať samostatne).
// Zrkadlí pravidlá z js/auto.js a js/calc.js.

const pad = n => String(n).padStart(2, '0');
const DAYS_SHORT = ['Ne', 'Po', 'Ut', 'St', 'Št', 'Pi', 'So'];
export const KM = 150;
const round2 = n => Math.round((n + Number.EPSILON) * 100) / 100;

/** Zložky lokálneho času v časovej zóne `tz` pre okamih `ms`. */
export function tzParts(ms, tz) {
  const f = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map(x => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, mi: +p.minute };
}

/** Lokálny čas v zóne `tz` -> UTC milisekundy. */
export function zonedToUtc(y, m, d, h, mi, tz) {
  const guess = Date.UTC(y, m - 1, d, h, mi);
  let utc = guess;
  for (let i = 0; i < 2; i++) { // dve iterácie zvládnu aj prechod letný/zimný čas
    const p = tzParts(utc, tz);
    utc += guess - Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi);
  }
  return utc;
}

/** Termíny pravidelných jazdy v (lastMs, nowMs]. `cfg`: { enabled, time, rules:[{dow,dir}], tz } */
export function dueOccurrences(cfg, nowMs, afterMs) {
  if (!cfg?.enabled) return [];
  const tz = cfg.tz || 'Europe/Bratislava';
  const [h, mi] = String(cfg.time || '19:00').split(':').map(Number);
  const today = tzParts(nowMs, tz);
  const out = [];
  for (let k = 13; k >= 0; k--) {
    const day = new Date(Date.UTC(today.y, today.m - 1, today.d - k)); // kalendárny deň v zóne
    const y = day.getUTCFullYear(), m = day.getUTCMonth() + 1, d = day.getUTCDate();
    for (const r of cfg.rules || []) {
      if (day.getUTCDay() !== r.dow) continue;
      const at = zonedToUtc(y, m, d, h || 0, mi || 0, tz);
      if (at <= nowMs && at > afterMs) out.push({ id: `auto-${y}-${pad(m)}-${pad(d)}-${r.dir}`, date: `${y}-${pad(m)}-${pad(d)}`, dir: r.dir, at });
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

/** Nová jazda podľa poslednej jazdy v rovnakom smere (platby vynulované), inak 1 pasažier na účet. */
export function buildAutoRide(occ, rides, defaults = {}) {
  const last = rides.filter(r => r.type === 'ride' && !r.deleted && r.dir === occ.dir)
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.updatedAt || 0) - (a.updatedAt || 0))[0];
  const pax = last
    ? last.pax.map(p => ({ ...p, paid: false, moved: false }))
    : [{ method: 'bank', price: defaults.price ?? 7.5, note: '', paid: false, moved: false }];
  const consumption = last?.consumption ?? defaults.consumption ?? 6.5;
  return {
    id: occ.id, type: 'ride', date: occ.date, dir: occ.dir, km: KM, consumption,
    liters: round2(KM * consumption / 100), solo: pax.length === 0, pax, auto: true, updatedAt: Date.now(),
  };
}

export const routeLabel = dir => (dir === 'BP' ? 'Brno ➔ PN' : 'PN ➔ Brno');

/** Text notifikácie ako z Messengeru. */
export function notificationFor(ride) {
  let total = 0;
  for (const p of ride.pax) total += p.method === 'czk' ? (p.rate > 0 ? p.price / p.rate : 0) : p.price;
  const [y, m, d] = ride.date.split('-').map(Number);
  const day = DAYS_SHORT[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  const people = ride.pax.length ? `${ride.pax.length} pas.` : 'sám';
  return {
    title: `Jazda pridaná ✓ ${routeLabel(ride.dir)}`,
    body: `${day} ${d}.${m}.${y} · ${people} · ${total.toFixed(2)} €\nChceš v jazde zmeniť údaje?`,
    tag: ride.id, rideId: ride.id,
  };
}
