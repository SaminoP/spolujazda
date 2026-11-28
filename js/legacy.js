// Prevod dát zo starej aplikácie (Firestore kolekcie trips / refuels / transfers a JSON záloha) do nového formátu.
// ID sú stabilné (legacy-…), takže opakovaný prevod nič nezdvojí.
import { num, round2 } from './util.js';

const stamp = (o, fallback) => (typeof o.id === 'number' && o.id > 1e11 ? o.id : fallback);

export function tripToRide(t, key) {
  const pax = [];
  const row = (method, price, extra = {}) => pax.push({ method, price: round2(price), note: '', paid: false, moved: false, ...extra });

  if (!t.noPassengers) {
    // bežní pasažieri (jednotné alebo individuálne ceny)
    let reg = [];
    if (t.individualPrices && Array.isArray(t.passengerPrices) && t.passengerPrices.length) reg = t.passengerPrices.map(num);
    else reg = Array.from({ length: t.passengers || 0 }, () => num(t.pricePerPerson ?? 7.5));

    // hotovosť: prvých N bežných pasažierov (staré dáta bez `cashAmount` = celá jazda v hotovosti)
    const hasCash = !!t.hasCashPayment || num(t.cashAmount) > 0;
    const cashN = hasCash ? Math.min(t.cashPassengers || (t.cashAmount === undefined ? reg.length : 1), reg.length) : 0;
    const cashEach = cashN && t.cashAmount !== undefined ? num(t.cashAmount) / cashN : null;
    reg.forEach((price, i) => (i < cashN ? row('cash', cashEach ?? price) : row('bank', price)));

    if (t.hasDiscountPassengers) {
      for (let j = 0; j < (t.discountPassengers || 0); j++) row('bank', num(t.discountPrice ?? 5), { note: t.discountNote || '' });
    }
    if (t.hasCzkPayment) {
      const rate = num(t.czkRate) > 0 ? num(t.czkRate) : 25;
      for (let k = 0; k < (t.czkPassengers || 0); k++) row('czk', num(t.czkPricePerPerson ?? 200), { rate });
    }
  }
  // fajky „zaplatené" sú v starom formáte podľa poradia pasažierov
  const flags = Array.isArray(t.paidPassengers) ? t.paidPassengers : [];
  pax.forEach((p, i) => { if (p.method === 'bank') p.paid = !!flags[i]; });

  const km = t.distanceKm || 150;
  const cons = num(t.fuelConsumption) > 0 ? num(t.fuelConsumption) : 6.5;
  return {
    id: `legacy-trip-${key}`, type: 'ride', date: t.date, dir: t.routeType === 'brno-pn' ? 'BP' : 'PB',
    km, consumption: cons, liters: t.fuelConsumedLiters != null ? num(t.fuelConsumedLiters) : round2(km * cons / 100),
    solo: pax.length === 0, pax, legacy: true, updatedAt: stamp(t, Date.now()),
  };
}

export function refuelToFuel(r, key) {
  const total = num(r.totalPrice), liters = num(r.liters);
  return {
    id: `legacy-fuel-${key}`, type: 'fuel', date: r.date, total: round2(total), liters: round2(liters),
    ppl: num(r.pricePerL) || (liters > 0 ? Math.round(total / liters * 1000) / 1000 : 0),
    station: r.station && r.station !== 'Čerpacia stanica' ? r.station : (r.station || ''), odo: Math.round(num(r.odometer)) || 0,
    payment: r.paidFromAccount ? 'card' : 'cash', receipt: r.receiptImage || '', legacy: true, updatedAt: stamp(r, Date.now()),
  };
}

export function transferToItem(t, key) {
  return { id: `legacy-tr-${key}`, type: 'transfer', date: t.date, amount: round2(num(t.amount)), legacy: true, updatedAt: stamp(t, Date.now()) };
}

/** { trips, refuels, transfers } (polia záznamov so `docId` alebo `id`) -> nové záznamy */
export function convertLegacy({ trips = [], refuels = [], transfers = [] }) {
  const k = o => o.docId || o.id;
  return [
    ...trips.filter(t => t && t.date && k(t) != null).map(t => tripToRide(t, k(t))),
    ...refuels.filter(r => r && r.date && k(r) != null).map(r => refuelToFuel(r, k(r))),
    ...transfers.filter(t => t && k(t) != null).map(t => transferToItem(t, k(t))),
  ];
}
