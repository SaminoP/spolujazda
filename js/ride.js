// Záložka 1: kalkulačka jazdy. Formulár sa používa aj v okne úpravy v Histórii.
// Princip: každý pasažier = jedna karta s vlastným spôsobom platby (Účet / Hotovosť / CZK) a vlastnou sumou.
import { bindForm } from './bind.js';
import * as store from './store.js';
import { $, eur, n1, czk, num } from './util.js';
import { KM, DIRS, METHODS, PRESETS, routeLabel, newDraft, normalize, buildRide, rideTotals, pEur } from './calc.js';
import { toast } from './ui.js';

const chips = (key, vals, fmt) => vals.map(v => `<button type="button" class="chip" data-set="${key}" data-v="${v}">${fmt(v)}</button>`).join('');
const field = (key, unit, dec = 2) => `
  <div class="inp"><input class="field" type="text" inputmode="decimal" enterkeyhint="done" autocomplete="off"
    data-k="${key}" data-dec="${dec}"><span>${unit}</span></div>`;

export const rideFormHTML = () => `
<div class="hero">
  <div class="hero-top"><span class="hero-label">Vyzbierané celkom</span><span class="pill" data-out="route">PN ➔ Brno</span></div>
  <div class="hero-amt" data-out="total" data-tween>0.00 €</div>
  <div class="hero-grid">
    <div><b data-out="perPerson">—</b><span>na osobu</span></div>
    <div><b data-out="people">0</b><span>ľudí</span></div>
    <div><b data-out="cons">6.5</b><span>l/100 km</span></div>
    <div><b data-out="fuel">9.8 l</b><span>paliva</span></div>
  </div>
</div>

<div class="split">
  <div class="tile bank"><span>🏦 Na účet</span><b data-out="bank">0.00 €</b></div>
  <div class="tile cash"><span>💵 Hotovosť</span><b data-out="cash">0.00 €</b></div>
  <div class="tile czk"><span>💱 CZK</span><b data-out="czkTile">0 Kč</b><small data-out="czkEur"></small></div>
</div>

<h3 class="sec"><i>1</i> Trasa a dátum</h3>
<div class="card">
  <div class="seg wide" role="group" aria-label="Smer trasy">
    <button type="button" data-seg="dir" data-v="PB">PN ➔ Brno</button>
    <button type="button" data-seg="dir" data-v="BP">Brno ➔ PN</button>
  </div>
  <div class="route"><span class="stop" data-out="from">PN</span><span class="line"><i></i><em>${KM} km</em></span><span class="stop" data-out="to">Brno</span></div>
  <label class="field-row"><span>📅 Dátum</span><input class="field" type="date" data-k="date" data-t="text"></label>
</div>

<h3 class="sec"><i>2</i> Pasažieri</h3>
<div class="card">
  <div class="stepper">
    <button type="button" data-step="count" data-d="-1" data-min="0" data-max="8" aria-label="Odobrať pasažiera">−</button>
    <div class="count"><b data-show="count">1</b><small data-out="countHint">pasažier</small></div>
    <button type="button" data-step="count" data-d="1" data-min="0" data-max="8" aria-label="Pridať pasažiera">+</button>
  </div>
  <p class="hint">Každý pasažier má vlastnú kartu – vyber ako platí a koľko. Nový pasažier prevezme nastavenie posledného.</p>
</div>

<div class="rows" data-list="rows"></div>

<div class="fold" data-if="hasCzk"><div class="fold-in">
  <div class="card czk-set"><div class="row"><span>💱 Kurz CZK / EUR</span>${field('czkRate', 'Kč/€')}</div></div>
</div></div>

<h3 class="sec"><i>3</i> Spotreba auta</h3>
<div class="card">
  <div class="card-h"><b>Spálené palivo</b><span class="muted" data-out="fuelLine">≈ 9.75 l / ${KM} km</span></div>
  <div class="chips">${chips('consumption', [6, 6.5, 7, 7.5], v => Number(v).toFixed(1))}</div>
  ${field('consumption', 'l/100 km', 1)}
</div>`;

function rowsHTML(d) {
  return d.rows.map((r, i) => {
    const czkRow = r.method === 'czk';
    return `
  <div class="prow m-${r.method}">
    <div class="prow-h">
      <span class="avatar">${i + 1}</span><b>Pasažier ${i + 1}</b>
      <span class="prow-sub" data-out="sub${i}"></span>
      <label class="nbtn" title="Poznámka"><input type="checkbox" data-k="rows.${i}.noteOn"><span>✎</span></label>
      <button type="button" class="rm" data-rm="${i}" aria-label="Odobrať pasažiera ${i + 1}">✕</button>
    </div>
    <div class="seg" role="group" aria-label="Spôsob platby pasažiera ${i + 1}">
      ${METHODS.map(([v, e, l]) => `<button type="button" data-seg="rows.${i}.method" data-v="${v}">${e} ${l}</button>`).join('')}
    </div>
    <div class="prow-amt">
      <div class="inp"><input class="field" type="text" inputmode="decimal" enterkeyhint="done" autocomplete="off"
        data-k="rows.${i}.price" data-dec="${czkRow ? 0 : 2}"><span>${czkRow ? 'Kč' : '€'}</span></div>
      <div class="qchips">${chips(`rows.${i}.price`, czkRow ? PRESETS.czk : PRESETS.eur, v => (czkRow ? v : Number(v).toFixed(2)))}</div>
    </div>
    <div class="fold" data-if="rows.${i}.noteOn"><div class="fold-in">
      <input class="field note" type="text" placeholder="Poznámka (napr. Uh. Hradiště)" enterkeyhint="done" autocomplete="off" data-t="text" data-k="rows.${i}.note">
    </div></div>
  </div>`;
  }).join('');
}

const subText = (p, d) => p.method === 'bank' ? 'na účet' : p.method === 'cash' ? 'do ruky' : `≈ ${eur(pEur({ ...p, price: num(p.price), rate: num(d.czkRate) }))}`;

/** Namontuje formulár jazdy do `root` nad objektom `draft`. */
export function mountRideForm(root, draft, onUpdate) {
  root.innerHTML = rideFormHTML();
  const list = $('[data-list="rows"]', root);
  let sig = null;
  const form = bindForm(root, draft, d => {
    normalize(d);
    const s = d.rows.map(r => r.method).join();
    if (s !== sig) { sig = s; list.innerHTML = rowsHTML(d); }

    const ride = buildRide(d);
    const t = rideTotals(ride);
    onUpdate?.(d, ride, t);
    const dir = DIRS[d.dir];
    const outs = {
      route: routeLabel(d.dir), from: dir.from, to: dir.to,
      total: t.total,
      perPerson: t.people ? eur(t.total / t.people) : '—',
      people: t.people ? String(t.people) : 'sám',
      cons: n1(num(d.consumption)), fuel: `${n1(ride.liters)} l`,
      fuelLine: `≈ ${n1(ride.liters, 2)} l / ${KM} km`,
      bank: eur(t.bank), cash: eur(t.cash),
      czkTile: czk(t.czkK), czkEur: t.czkN ? `≈ ${eur(t.czkE)}` : '',
      countHint: d.count === 0 ? '🚗 idem sám' : d.count === 1 ? 'pasažier' : d.count < 5 ? 'pasažieri' : 'pasažierov',
    };
    d.rows.forEach((r, i) => { outs[`sub${i}`] = subText(r, d); });
    return outs;
  });
  list.addEventListener('click', e => {
    const b = e.target.closest('[data-rm]');
    if (!b) return;
    draft.rows.splice(+b.dataset.rm, 1);
    draft.count = draft.rows.length;
    sig = null;
    form.update();
  });
  return form;
}

export function initRide() {
  const root = $('#rideForm');
  let form;
  const fresh = () => {
    const d = newDraft(store.settings());
    if (form) {
      for (const k of Object.keys(form.state)) delete form.state[k];
      Object.assign(form.state, d);
      form.update();
      return;
    }
    form = mountRideForm(root, d);
  };
  fresh();

  $('#rideSave').addEventListener('click', () => {
    const d = form.state;
    if (num(d.consumption) <= 0) return toast('Zadaj spotrebu auta', 'err');
    if (!d.date) return toast('Vyber dátum jazdy', 'err');
    if (d.rows.some(r => !(num(r.price) >= 0))) return toast('Skontroluj sumy pasažierov', 'err');
    if (!store.upsert(buildRide(d))) return toast('Úložisko je plné – exportuj a zmaž staré dáta', 'err');
    const eurRow = d.rows.find(r => r.method !== 'czk'), czkRow = d.rows.find(r => r.method === 'czk');
    store.setSettings({
      consumption: num(d.consumption), czkRate: num(d.czkRate) || store.settings().czkRate,
      ...(eurRow && num(eurRow.price) > 0 ? { price: num(eurRow.price) } : {}),
      ...(czkRow && num(czkRow.price) > 0 ? { czkPrice: num(czkRow.price) } : {}),
    });
    toast('Jazda uložená ✓');
    fresh();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  $('#rideReset').addEventListener('click', () => { fresh(); toast('Formulár vynulovaný'); });
}
