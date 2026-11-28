// Záložka 4: prehľad, štatistiky, prevody na osobný účet, správa dát
import * as store from './store.js';
import { $, eur, n1, int, czk, download, todayISO, monthName, fmtDate } from './util.js';
import { rideTotals } from './calc.js';
import { toast, confirmDialog } from './ui.js';

let period = 'all';
try { period = localStorage.getItem('pnbr.period') || 'all'; } catch { /* ignore */ }

const inPeriod = (iso, now = new Date()) => {
  if (period === 'all') return true;
  const p = (iso || '').slice(0, period === 'year' ? 4 : 7);
  const y = String(now.getFullYear());
  return p === (period === 'year' ? y : `${y}-${String(now.getMonth() + 1).padStart(2, '0')}`);
};

function compute() {
  const all = store.items();
  const rides = all.filter(i => i.type === 'ride');
  const fuels = all.filter(i => i.type === 'fuel');
  const transfers = all.filter(i => i.type === 'transfer');
  const rp = rides.filter(r => inPeriod(r.date)), fp = fuels.filter(f => inPeriod(f.date));
  const sum = (a, f) => a.reduce((s, x) => s + f(x), 0);

  const collected = sum(rp, r => rideTotals(r).total);
  const fuelCost = sum(fp, f => f.total);
  const km = sum(rp, r => r.km);
  const liters = sum(fp, f => f.liters);

  // Prevod na osobný účet – vždy za celú históriu:
  // prišlo na účet (zaplatené ✓) − tankovanie zaplatené z účtu − už prevedené
  let arrived = 0, waiting = 0, cashHand = 0;
  for (const r of rides) {
    const t = rideTotals(r);
    arrived += t.paidSum;
    waiting += t.bank - t.paidSum;
    cashHand += t.cash + t.czkE;
  }
  const fuelFromAccount = sum(fuels.filter(f => f.payment === 'card'), f => f.total);
  const transferred = sum(transfers, t => t.amount);
  const ready = Math.max(0, arrived - fuelFromAccount - transferred);
  const lastTransfer = [...transfers].sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0];

  const now = new Date();
  const months = Array.from({ length: 6 }, (_, k) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - k), 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const v = sum(rides.filter(r => r.date?.startsWith(key)), r => rideTotals(r).total) - sum(fuels.filter(f => f.date?.startsWith(key)), f => f.total);
    return { key, label: monthName(d.getMonth()).slice(0, 3), v };
  });

  return {
    rides: rp.length, fuels: fp.length, collected, fuelCost, net: collected - fuelCost, km,
    people: sum(rp, r => rideTotals(r).people),
    avgCons: km ? sum(rp, r => r.consumption * r.km) / km : 0,
    pricePerL: liters ? fuelCost / liters : 0,
    perRide: rp.length ? collected / rp.length : 0,
    czkK: sum(rp, r => rideTotals(r).czkK), czkE: sum(rp, r => rideTotals(r).czkE),
    arrived, waiting, cashHand, fuelFromAccount, transferred, ready, lastTransfer, months,
  };
}

export function renderStats() {
  const s = compute();
  const max = Math.max(1, ...s.months.map(m => Math.abs(m.v)));
  const last = s.lastTransfer
    ? `Posledný prevod: <b>${eur(s.lastTransfer.amount)}</b> (${fmtDate((s.lastTransfer.date || '').slice(0, 10))})`
    : 'Zatiaľ žiadny zaznamenaný prevod.';
  $('#statsDyn').innerHTML = `
  <div class="seg wide" data-periods role="group" aria-label="Obdobie">
    ${[['all', 'Celkom'], ['year', 'Rok'], ['month', 'Mesiac']].map(([k, l]) => `<button type="button" data-period="${k}" class="${period === k ? 'on' : ''}">${l}</button>`).join('')}
  </div>

  <div class="hero net ${s.net < 0 ? 'neg' : ''}">
    <div class="hero-top"><span class="hero-label">👛 Peňaženka · čistý zisk</span></div>
    <div class="hero-amt">${s.net >= 0 ? '+' : '−'}${eur(Math.abs(s.net))}</div>
    <div class="hero-grid two">
      <div><b>${eur(s.collected)}</b><span>vyzbierané z jázd</span></div>
      <div><b>−${eur(s.fuelCost)}</b><span>nafta (${s.fuels}× tankovanie)</span></div>
    </div>
  </div>

  <div class="card transfer-card">
    <div class="card-h"><b>🏦 Prevod na osobný účet</b></div>
    <div class="big">${eur(s.ready)}</div>
    <p class="muted">${last}</p>
    <div class="kv"><span>✓ Prišlo na účet (zaplatené)</span><b>${eur(s.arrived)}</b></div>
    <div class="kv"><span>⛽ − tankovanie z účtu</span><b>−${eur(s.fuelFromAccount)}</b></div>
    <div class="kv"><span>↗ − už prevedené</span><b>−${eur(s.transferred)}</b></div>
    <div class="kv"><span>⏳ Ešte nezaplatené (na účet)</span><b>${eur(s.waiting)}</b></div>
    <div class="kv"><span>💵 Hotovosť + CZK v ruke (mimo prevodu)</span><b>${eur(s.cashHand)}</b></div>
    <button type="button" class="btn" data-mark ${s.ready > 0 ? '' : 'disabled'}>✓ Označiť ako prevedené</button>
  </div>

  <div class="stats-grid">
    <div class="stat"><span>🧮 Jazdy</span><b>${s.rides}</b></div>
    <div class="stat"><span>📏 Kilometre</span><b>${int(s.km)}</b></div>
    <div class="stat"><span>👥 Pasažieri</span><b>${s.people}</b></div>
    <div class="stat"><span>🛢️ Ø spotreba</span><b>${s.avgCons ? n1(s.avgCons) : '—'}<small> l/100</small></b></div>
    <div class="stat"><span>💶 Ø cena nafty</span><b>${s.pricePerL ? n1(s.pricePerL, 3) : '—'}<small> €/l</small></b></div>
    <div class="stat"><span>🧾 Ø na jazdu</span><b>${s.rides ? eur(s.perRide) : '—'}</b></div>
  </div>

  <div class="card czk-vault">
    <div class="card-h"><b>💱 CZK trezor</b><span class="muted">${s.czkK ? `≈ ${eur(s.czkE)}` : ''}</span></div>
    <div class="big amber">${czk(s.czkK)}</div>
    <p class="muted">Celková suma vyzbieraná v českých korunách.</p>
  </div>

  <div class="card">
    <div class="card-h"><b>📈 Čistý zisk · 6 mesiacov</b></div>
    <div class="bars">${s.months.map(m => `
      <div class="bar"><div class="track"><i class="${m.v < 0 ? 'neg' : ''}" style="height:${Math.max(3, Math.abs(m.v) / max * 100)}%" title="${eur(m.v)}"></i></div><span>${m.label}</span><em>${Math.round(m.v)}</em></div>`).join('')}
    </div>
  </div>`;
}

export function initStats() {
  $('#statsDyn').addEventListener('click', async e => {
    const p = e.target.closest('[data-period]');
    if (p) {
      period = p.dataset.period;
      try { localStorage.setItem('pnbr.period', period); } catch { /* ignore */ }
      return renderStats();
    }
    if (e.target.closest('[data-mark]')) {
      const s = compute();
      if (!(await confirmDialog(`Odoslal si ${eur(s.ready)} na osobný účet? Počítadlo sa vynuluje.`, { ok: 'Áno, odoslané', danger: false, title: 'Prevod hotový' }))) return;
      store.upsert({ type: 'transfer', date: new Date().toISOString(), amount: Math.round(s.ready * 100) / 100 });
      toast('Prevod zaznamenaný ✓');
    }
  });

  // --- správa dát ---
  $('#expBtn').addEventListener('click', () => {
    download(`spolujazda-zaloha-${todayISO()}.json`, store.exportJSON());
    toast('Záloha stiahnutá');
  });
  $('#impFile').addEventListener('change', async e => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const r = store.importJSON(await f.text());
      toast(`Import hotový: ${r.added} nových / zmenených z ${r.total}`);
    } catch (err) { toast(`Import zlyhal: ${err.message}`, 'err'); }
  });
  $('#wipeBtn').addEventListener('click', async () => {
    if (await confirmDialog('Zmaže všetky jazdy, tankovania a prevody z tohto zariadenia (a po synchronizácii aj z cloudu). Najprv si urob zálohu!', { ok: 'Zmazať všetko', title: 'Vymazať všetky dáta?' })) {
      store.wipe();
      toast('Všetky dáta zmazané');
    }
  });
  renderStats();
}
