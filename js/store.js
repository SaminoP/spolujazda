// Offline-first úložisko (localStorage) + jednoduchý pub/sub
import { uid } from './util.js';
import { convertLegacy } from './legacy.js';

const TYPES = ['ride', 'fuel', 'transfer'];

const KEY = 'pnbr.v1';
export const DEFAULTS = {
  price: 7.5,
  consumption: 6.5,
  czkPrice: 200,
  czkRate: 25,
  firebase: '',
  fbEmail: '',
  auto: { enabled: false, time: '19:00', rules: [{ dow: 0, dir: 'PB' }, { dow: 5, dir: 'BP' }], since: 0 },
};

/** Starý formát jazdy (skupiny cash/czk + kind) -> nový (zoznam pasažierov s `method`). */
function migrate(it) {
  if (!it || it.type !== 'ride' || it.deleted || !it.pax || it.pax.every(p => p.method)) return it;
  const pax = it.pax.map(p => ({ method: 'bank', price: p.price, note: p.note || p.name || '', paid: !!p.paid, moved: !!p.moved }));
  for (let i = 0; i < (it.cash?.count || 0); i++) pax.push({ method: 'cash', price: it.cash.price, note: '', paid: false, moved: false });
  for (let i = 0; i < (it.czk?.count || 0); i++) pax.push({ method: 'czk', price: it.czk.price, rate: it.czk.rate || 25, note: '', paid: false, moved: false });
  const { cash, czk, ...rest } = it;
  return { ...rest, pax, solo: pax.length === 0 };
}

let db = load();
const subs = new Set();

function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && Array.isArray(d.items)) return { settings: { ...DEFAULTS, ...d.settings }, items: d.items.map(migrate) };
  } catch { /* poškodené dáta -> prázdna DB */ }
  return { settings: { ...DEFAULTS }, items: [] };
}

function persist(silent = false) {
  let ok = true;
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { ok = false; }
  if (!silent) subs.forEach(fn => fn());
  return ok;
}

export const subscribe = fn => { subs.add(fn); return () => subs.delete(fn); };
export const settings = () => db.settings;
export const setSettings = patch => { Object.assign(db.settings, patch); return persist(true); };

/** Všetky záznamy vrátane zmazaných (tombstones – kvôli synchronizácii). */
export const allItems = () => db.items;
export const items = () => db.items.filter(i => !i.deleted);
export const transfers = () => db.items.filter(i => i.type === 'transfer' && !i.deleted);
export const byId = id => db.items.find(i => i.id === id && !i.deleted);

export function upsert(item) {
  item.id ||= uid();
  item.updatedAt = Date.now();
  const i = db.items.findIndex(x => x.id === item.id);
  const prev = i >= 0 ? db.items[i] : null;
  if (i >= 0) db.items[i] = item; else db.items.push(item);
  const ok = persist();
  if (!ok) { // úložisko plné -> vráť späť
    if (prev) db.items[i] = prev; else db.items.pop();
  }
  return ok;
}

export function remove(id) {
  const i = db.items.findIndex(x => x.id === id);
  if (i < 0) return;
  db.items[i] = { id, type: db.items[i].type, deleted: true, updatedAt: Date.now() };
  persist();
}

/** Zlúči záznamy (novší vyhráva). Používa import aj cloud. */
export function mergeItems(list, silent = false) {
  let changed = 0;
  for (let it of list) {
    it = migrate(it);
    if (!it || !it.id || !TYPES.includes(it.type)) continue;
    const i = db.items.findIndex(x => x.id === it.id);
    if (i < 0) { db.items.push(it); changed++; }
    else if ((it.updatedAt || 0) > (db.items[i].updatedAt || 0)) { db.items[i] = it; changed++; }
  }
  if (changed) persist(silent);
  return changed;
}

export const exportJSON = () => JSON.stringify({
  app: 'pn-brno', version: 1, exportedAt: new Date().toISOString(),
  settings: { ...db.settings, firebase: '' }, items: items(),
}, null, 1);

export function importJSON(text) {
  const d = JSON.parse(text);
  const now = Date.now();
  let list;
  if (d && Array.isArray(d.items)) {
    list = d.items.filter(i => i && TYPES.includes(i.type)).map(i => ({ ...i, id: i.id || uid(), updatedAt: i.updatedAt || now }));
  } else if (d && (d.trips || d.refuels || d.transfers || Array.isArray(d))) {
    // záloha zo starej aplikácie
    list = convertLegacy(Array.isArray(d) ? { trips: d } : d);
  } else throw new Error('Súbor nemá správny formát.');
  const n = mergeItems(list);
  if (d.settings) {
    const { price, consumption, czkPrice, czkRate } = d.settings;
    setSettings(Object.fromEntries(Object.entries({ price, consumption, czkPrice, czkRate }).filter(([, v]) => typeof v === 'number')));
  }
  return { total: list.length, added: n };
}

export function wipe() {
  db.items = db.items.map(i => ({ id: i.id, type: i.type, deleted: true, updatedAt: Date.now() }));
  persist();
}
