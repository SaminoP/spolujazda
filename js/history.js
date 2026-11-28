// Záložka 3: história jázd a tankovaní, sledovanie platieb, úprava a mazanie
import * as store from './store.js';
import { $, esc, eur, n1, int, czk, fmtDate, fmtMonth } from './util.js';
import { routeLabel, rideTotals, buildRide, rideToDraft, paxLabel } from './calc.js';
import { mountRideForm } from './ride.js';
import { mountFuelForm, fuelFromState, fuelToState, validateFuel } from './fuel.js';
import { openSheet, confirmDialog, toast, viewImage } from './ui.js';

let filter = 'all';
try { filter = localStorage.getItem('pnbr.filter') || 'all'; } catch { /* ignore */ }

const rideCard = r => {
  const t = rideTotals(r);
  const bank = r.pax.map((p, i) => ({ p, i })).filter(x => x.p.method === 'bank');
  const n = bank.length;
  const allPaid = n > 0 && t.paidN === n;
  const tags = [
    `<span class="tag">📏 ${r.km} km</span>`,
    `<span class="tag">⛽ ${n1(r.liters, 2)} l</span>`,
    `<span class="tag">🛢️ ${n1(r.consumption)} l/100</span>`,
    t.people ? `<span class="tag">👥 ${t.people}</span>` : '<span class="tag hl">🚗 Sám</span>',
    t.cashN ? `<span class="tag cash">💵 ${t.cashN}× · ${eur(t.cash)}</span>` : '',
    t.czkN ? `<span class="tag czk">💱 ${t.czkN}× · ${czk(t.czkK)} ≈ ${eur(t.czkE)}</span>` : '',
  ].join('');
  const pay = n ? `
    <div class="pay">
      <div class="pay-head">
        <span class="pay-state ${allPaid ? 'ok' : ''}">${allPaid ? `✅ Všetci zaplatili (${eur(t.bank)})` : `⏳ ${t.paidN}/${n} zaplatili`}</span>
        <button type="button" class="chip" data-act="all">${allPaid ? '↺ Zrušiť' : '✓ Všetci'}</button>
      </div>
      <div class="pchips">${bank.map(({ p, i }) => `
        <button type="button" class="pchip ${p.paid ? 'paid' : ''}" data-act="pay" data-i="${i}" aria-pressed="${p.paid}">
          <i>${p.paid ? '✓' : ''}</i><span>${esc(paxLabel(p, i))}</span><b>${eur(p.price)}</b>
          ${p.paid ? '<em>Zaplatené</em>' : ''}
        </button>`).join('')}
      </div>
    </div>` : '';
  return `
  <article class="item" data-id="${r.id}" data-type="ride">
    <div class="item-top">
      <div class="ico g">🧮</div>
      <div class="item-main"><div class="item-title">${routeLabel(r.dir)}</div><div class="item-sub">${fmtDate(r.date)}</div></div>
      <div class="item-amt pos">+${eur(t.total)}</div>
    </div>
    <div class="tags">${tags}</div>
    ${pay}
    <div class="item-actions"><button type="button" class="chip" data-act="edit">✏️ Upraviť</button><button type="button" class="chip dng" data-act="del">🗑️ Zmazať</button></div>
  </article>`;
};

const fuelCard = f => `
  <article class="item" data-id="${f.id}" data-type="fuel">
    <div class="item-top">
      <div class="ico a">⛽</div>
      <div class="item-main"><div class="item-title">${esc(f.station) || 'Tankovanie'}</div><div class="item-sub">${fmtDate(f.date)}</div></div>
      <div class="item-amt neg">−${eur(f.total)}</div>
    </div>
    <div class="tags">
      <span class="tag">🛢️ ${n1(f.liters, 2)} l</span>
      ${f.ppl ? `<span class="tag">💶 ${n1(f.ppl, 3)} €/l</span>` : ''}
      ${f.odo ? `<span class="tag">🧭 ${int(f.odo)} km</span>` : ''}
      <span class="tag ${f.payment === 'cash' ? 'cash' : ''}">${f.payment === 'cash' ? '💵 Hotovosť' : '💳 Karta / účet'}</span>
    </div>
    ${f.receipt ? `<button type="button" class="thumb" data-act="rcpt" aria-label="Zobraziť bloček"><img loading="lazy" alt="Bloček" src="${f.receipt}"><span>🧾 Zobraziť bloček</span></button>` : ''}
    <div class="item-actions"><button type="button" class="chip" data-act="edit">✏️ Upraviť</button><button type="button" class="chip dng" data-act="del">🗑️ Zmazať</button></div>
  </article>`;

export function renderHistory() {
  const root = $('#historyList');
  const list = store.items()
    .filter(i => i.type !== 'transfer' && (filter === 'all' || (filter === 'ride' ? i.type === 'ride' : i.type === 'fuel')))
    .sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.updatedAt || 0) - (a.updatedAt || 0));
  document.querySelectorAll('[data-filter]').forEach(b => b.classList.toggle('on', b.dataset.filter === filter));
  if (!list.length) {
    root.innerHTML = `<div class="empty"><div>🛣️</div><b>Zatiaľ nič</b><p>Ulož prvú jazdu alebo tankovanie a objaví sa tu.</p></div>`;
    return;
  }
  let html = '', month = '';
  for (const it of list) {
    const m = (it.date || '').slice(0, 7);
    if (m !== month) { month = m; html += `<h3 class="month">${fmtMonth(m + '-01')}</h3>`; }
    html += it.type === 'ride' ? rideCard(it) : fuelCard(it);
  }
  root.innerHTML = html;
}

function editRide(r) {
  const draft = rideToDraft(r, store.settings());
  openSheet('Upraviť jazdu', body => mountRideForm(body, draft), {
    onSave() {
      if (!draft.date) { toast('Vyber dátum jazdy', 'err'); return false; }
      if (!store.upsert(buildRide(draft))) { toast('Úložisko je plné', 'err'); return false; }
      toast('Jazda upravená ✓');
    },
  });
}

function editFuel(f) {
  const state = fuelToState(f);
  openSheet('Upraviť tankovanie', body => mountFuelForm(body, state), {
    onSave() {
      const err = validateFuel(state);
      if (err) { toast(err, 'err'); return false; }
      if (!store.upsert(fuelFromState(state))) { toast('Úložisko je plné', 'err'); return false; }
      toast('Tankovanie upravené ✓');
    },
  });
}

/** Otvorí úpravu jazdy podľa ID (z notifikácie / automatickej jazdy). */
export function editRideById(id) {
  const r = store.byId(id);
  if (r?.type === 'ride') editRide(r);
}

export function initHistory() {
  $('#historyList').addEventListener('click', async e => {
    const btn = e.target.closest('[data-act]');
    const card = e.target.closest('.item');
    if (!btn || !card) return;
    const it = store.byId(card.dataset.id);
    if (!it) return;
    const act = btn.dataset.act;
    if (act === 'pay') {
      const p = it.pax[+btn.dataset.i];
      p.paid = !p.paid;
      if (!p.paid) p.moved = false;
      store.upsert(it);
    } else if (act === 'all') {
      const bank = it.pax.filter(p => p.method === 'bank');
      const all = bank.every(p => p.paid);
      bank.forEach(p => { p.paid = !all; if (all) p.moved = false; });
      store.upsert(it);
    } else if (act === 'edit') {
      it.type === 'ride' ? editRide(it) : editFuel(it);
    } else if (act === 'del') {
      const label = it.type === 'ride' ? `jazdu ${routeLabel(it.dir)} z ${fmtDate(it.date)}` : `tankovanie z ${fmtDate(it.date)}`;
      if (await confirmDialog(`Zmazať ${label}? Túto akciu nejde vrátiť späť.`)) { store.remove(it.id); toast('Zmazané'); }
    } else if (act === 'rcpt') {
      viewImage(it.receipt);
    }
  });
  document.querySelector('[data-filters]').addEventListener('click', e => {
    const b = e.target.closest('[data-filter]');
    if (!b) return;
    filter = b.dataset.filter;
    try { localStorage.setItem('pnbr.filter', filter); } catch { /* ignore */ }
    renderHistory();
  });
  renderHistory();
}
