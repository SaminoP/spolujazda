// Záložka 2: tankovanie (formulár znovupoužitý aj pri úprave v Histórii)
import { bindForm } from './bind.js';
import * as store from './store.js';
import { $, $$, esc, num, round2, round3, todayISO } from './util.js';
import { toast, viewImage } from './ui.js';
import { scanReceipt } from './ocr.js';

const newFuel = () => ({ date: todayISO(), total: 0, liters: 0, ppl: 0, station: '', odo: 0, payment: 'card', mode: 'ppl', receipt: '' });

const fuelFormHTML = () => `
<div class="card">
  <div class="scan">
    <div class="scan-t"><b>🧾 Bloček z pumpy</b><small>Odfoť a vyplním sumu, litre a dátum</small></div>
    <div class="scan-btns">
      <label class="btn sm">📷 Odfotiť<input type="file" accept="image/*" capture="environment" hidden data-file></label>
      <label class="btn sm ghost">🖼️ Nahrať<input type="file" accept="image/*" hidden data-file></label>
    </div>
    <div class="progress" hidden><i></i><span></span></div>
    <div class="fold" data-if="receipt"><div class="fold-in">
      <div class="rcpt"><img alt="Bloček" data-rcpt><button type="button" class="chip" data-rm>🗑️ Odstrániť bloček</button></div>
    </div></div>
  </div>
</div>

<div class="card">
  <div class="card-h"><b>Dopočítať automaticky</b></div>
  <div class="seg wide" role="group" aria-label="Čo dopočítať">
    <button type="button" data-seg="mode" data-v="ppl">€/l</button>
    <button type="button" data-seg="mode" data-v="liters">Litre</button>
    <button type="button" data-seg="mode" data-v="total">Suma</button>
  </div>
  <div class="grid2">
    <label class="lab"><span>Celková suma</span><div class="inp"><input class="field" data-f="total" type="text" inputmode="decimal" enterkeyhint="done" autocomplete="off" placeholder="0.00" data-k="total" data-dec="2" data-blank><span>€</span></div></label>
    <label class="lab"><span>Natankované</span><div class="inp"><input class="field" data-f="liters" type="text" inputmode="decimal" enterkeyhint="done" autocomplete="off" placeholder="0.00" data-k="liters" data-dec="2" data-blank><span>l</span></div></label>
    <label class="lab"><span>Cena za liter</span><div class="inp"><input class="field" data-f="ppl" type="text" inputmode="decimal" enterkeyhint="done" autocomplete="off" placeholder="0.000" data-k="ppl" data-dec="3" data-blank><span>€/l</span></div></label>
    <label class="lab"><span>Tachometer</span><div class="inp"><input class="field" type="text" inputmode="numeric" enterkeyhint="done" autocomplete="off" placeholder="km" data-k="odo" data-dec="0" data-blank><span>km</span></div></label>
  </div>
</div>

<div class="card">
  <label class="lab"><span>📅 Dátum</span><input class="field" type="date" data-k="date" data-t="text"></label>
  <label class="lab"><span>⛽ Čerpacia stanica</span><input class="field" type="text" list="stations" placeholder="napr. Slovnaft Piešťany" enterkeyhint="done" autocomplete="off" data-k="station" data-t="text"></label>
  <div class="lab"><span>Platba</span>
    <div class="seg wide" role="group" aria-label="Spôsob platby">
      <button type="button" data-seg="payment" data-v="card">💳 Karta / účet</button>
      <button type="button" data-seg="payment" data-v="cash">💵 Hotovosť</button>
    </div></div>
</div>`;

const AUTO = { ppl: 'ppl', liters: 'liters', total: 'total' };

/** Namontuje formulár tankovania. Vráti binder; `state` je upravovaný objekt. */
export function mountFuelForm(root, state) {
  root.innerHTML = fuelFormHTML();
  const img = $('[data-rcpt]', root);
  const prog = $('.progress', root);

  const form = bindForm(root, state, d => {
    // krížový výpočet: jedno pole je vždy dopočítané (readonly)
    d.total = num(d.total); d.liters = num(d.liters); d.ppl = num(d.ppl);
    if (d.mode === 'ppl') d.ppl = d.total > 0 && d.liters > 0 ? round3(d.total / d.liters) : 0;
    else if (d.mode === 'liters') d.liters = d.ppl > 0 && d.total > 0 ? round2(d.total / d.ppl) : 0;
    else d.total = d.ppl > 0 && d.liters > 0 ? round2(d.ppl * d.liters) : 0;
    for (const [f, key] of Object.entries(AUTO)) {
      const el = $(`[data-f="${f}"]`, root);
      const auto = d.mode === key;
      el.readOnly = auto;
      el.inputMode = auto ? 'none' : 'decimal';
      el.tabIndex = auto ? -1 : 0;
      el.classList.toggle('auto', auto);
      el.closest('.lab').classList.toggle('is-auto', auto);
    }
    if (d.receipt) img.src = d.receipt;
  });

  const onFile = async e => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    prog.hidden = false;
    const bar = $('i', prog), label = $('span', prog);
    const r = await scanReceipt(file, (p, t) => { bar.style.width = `${Math.round(p * 100)}%`; label.textContent = t; });
    prog.hidden = true;
    state.receipt = r.dataUrl;
    let filled = 0;
    if (r.date) { state.date = r.date; filled++; }
    if (r.total) { state.total = r.total; filled++; }
    if (r.liters) { state.liters = r.liters; filled++; }
    if (r.total && r.liters) state.mode = 'ppl';
    form.update();
    if (r.ocrError) toast(r.ocrError, 'err');
    else toast(filled ? 'Bloček prečítaný – skontroluj hodnoty' : 'Nič som nenašiel – zadaj hodnoty ručne', filled ? 'ok' : 'err');
  };
  $$('[data-file]', root).forEach(i => i.addEventListener('change', onFile));
  $('[data-rm]', root).addEventListener('click', () => { state.receipt = ''; form.update(); });
  img.addEventListener('click', () => viewImage(img.src));
  return form;
}

export function fuelFromState(d) {
  return {
    id: d.id, type: 'fuel', date: d.date, total: round2(num(d.total)), liters: round2(num(d.liters)),
    ppl: round3(num(d.ppl)), station: (d.station || '').trim(), odo: Math.round(num(d.odo)) || 0,
    payment: d.payment, receipt: d.receipt || '', moved: !!d.moved,
  };
}
export const fuelToState = f => ({ ...newFuel(), ...f, mode: 'ppl' });

export function validateFuel(d) {
  if (!(num(d.total) > 0)) return 'Zadaj celkovú sumu';
  if (!(num(d.liters) > 0) && !(num(d.ppl) > 0)) return 'Zadaj litre alebo cenu za liter';
  if (!d.date) return 'Vyber dátum';
  return '';
}

export function refreshStations() {
  const names = [...new Set(store.items().filter(i => i.type === 'fuel' && i.station).map(i => i.station))];
  $('#stations').innerHTML = names.map(n => `<option value="${esc(n)}">`).join('');
}

export function initFuel() {
  const state = newFuel();
  const form = mountFuelForm($('#fuelForm'), state);
  const reset = () => {
    const last = store.items().filter(i => i.type === 'fuel').sort((a, b) => b.updatedAt - a.updatedAt)[0];
    for (const k of Object.keys(state)) delete state[k];
    Object.assign(state, newFuel(), last ? { station: last.station, payment: last.payment } : {});
    form.update();
  };
  reset();
  $('#fuelSave').addEventListener('click', () => {
    const err = validateFuel(state);
    if (err) return toast(err, 'err');
    if (!store.upsert(fuelFromState(state))) return toast('Úložisko je plné – odstráň fotky bločkov alebo exportuj dáta', 'err');
    toast('Tankovanie uložené ✓');
    reset();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  $('#fuelReset').addEventListener('click', () => { reset(); toast('Formulár vynulovaný'); });
  refreshStations();
}
