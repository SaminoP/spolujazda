// Čistá logika kalkulácie jazdy (bez DOM).
// Model: jazda = zoznam pasažierov. KAŽDÝ pasažier má vlastný spôsob platby (bank | cash | czk) a vlastnú sumu.
import { round2, num, clamp, todayISO } from './util.js';

export const KM = 150;
export const DIRS = { PB: { from: 'PN', to: 'Brno' }, BP: { from: 'Brno', to: 'PN' } };
export const routeLabel = dir => `${DIRS[dir]?.from ?? 'PN'} ➔ ${DIRS[dir]?.to ?? 'Brno'}`;
export const METHODS = [['bank', '🏦', 'Účet'], ['cash', '💵', 'Hotovosť'], ['czk', '💱', 'CZK']];
export const PRESETS = { eur: [7, 7.5, 8], czk: [150, 200, 250] };

/** Suma pasažiera v EUR (CZK sa prepočíta jeho kurzom). */
export const pEur = p => (p.method === 'czk' ? (p.rate > 0 ? p.price / p.rate : 0) : p.price);

const mkRow = (d, from) => {
  const method = from?.method || 'bank';
  return {
    method, pm: method,
    price: from ? from.price : d.defPrice,
    noteOn: false, note: '', paid: false, moved: false,
  };
};

export function newDraft(s) {
  const d = {
    dir: 'PB', date: todayISO(), count: 1,
    defPrice: s.price, defCzk: s.czkPrice, czkRate: s.czkRate,
    consumption: s.consumption, rows: [],
  };
  d.rows.push(mkRow(d));
  return d;
}

/** Udržiava konzistenciu: počet riadkov = count (nový pasažier kopíruje posledného), zmena spôsobu platby zresetuje sumu na vhodnú predvolenú. */
export function normalize(d) {
  d.count = clamp(Math.round(num(d.count)), 0, 8);
  while (d.rows.length < d.count) d.rows.push(mkRow(d, d.rows[d.rows.length - 1]));
  d.rows.length = d.count;
  for (const r of d.rows) {
    if (r.pm !== r.method) {
      if ((r.method === 'czk') !== (r.pm === 'czk')) r.price = r.method === 'czk' ? d.defCzk : d.defPrice;
      r.paid = false; r.moved = false;
      r.pm = r.method;
    }
  }
  d.hasPax = d.count > 0;
  d.hasCzk = d.rows.some(r => r.method === 'czk');
  return d;
}

/** Koncept formulára -> záznam jazdy. */
export function buildRide(d) {
  const rate = num(d.czkRate) > 0 ? num(d.czkRate) : 25;
  const pax = d.rows.map(r => ({
    method: r.method,
    price: round2(num(r.price)),
    ...(r.method === 'czk' ? { rate } : {}),
    note: r.noteOn ? (r.note || '').trim() : '',
    paid: r.method === 'bank' && !!r.paid,
    moved: r.method === 'bank' && !!r.moved,
  }));
  const cons = num(d.consumption);
  return {
    id: d.id, type: 'ride', date: d.date, dir: d.dir, km: KM,
    consumption: cons, liters: round2(KM * cons / 100), solo: pax.length === 0, pax,
  };
}

export function rideTotals(r) {
  let bank = 0, cash = 0, czkK = 0, czkE = 0, bankN = 0, cashN = 0, czkN = 0, paidN = 0, paidSum = 0;
  for (const p of r.pax) {
    if (p.method === 'bank') { bank += p.price; bankN++; if (p.paid) { paidN++; paidSum += p.price; } }
    else if (p.method === 'cash') { cash += p.price; cashN++; }
    else { czkK += p.price; czkE += pEur(p); czkN++; }
  }
  return { bank, cash, czkK, czkE, bankN, cashN, czkN, paidN, paidSum, total: bank + cash + czkE, people: r.pax.length };
}

/** Záznam jazdy -> koncept formulára (úprava). */
export function rideToDraft(r, s) {
  const d = newDraft(s);
  Object.assign(d, { id: r.id, dir: r.dir, date: r.date, consumption: r.consumption });
  const czkRow = r.pax.find(p => p.method === 'czk');
  if (czkRow) d.czkRate = czkRow.rate || d.czkRate;
  d.rows = r.pax.map(p => ({
    method: p.method, pm: p.method, price: p.price, noteOn: !!p.note, note: p.note || '', paid: !!p.paid, moved: !!p.moved,
  }));
  d.count = d.rows.length;
  return normalize(d);
}

export const paxLabel = (p, i) => p.name || p.note || `Pasažier ${i + 1}`;
