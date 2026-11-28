// Mini-reaktívna väzba formulára na objekt `state` (spoločná pre všetky formuláre).
//
// Atribúty v HTML:
//   data-k="cesta"        pole <-> state (checkbox / text / číslo; data-t="text" = reťazec, data-dec="2" = formát)
//   data-step="cesta" data-d="±1" data-min data-max   stepper tlačidlo
//   data-seg="cesta" data-v="hodnota"                  segmented control
//   data-set="cesta" data-v="číslo"                    rýchla predvoľba (chip)
//   data-show="cesta"     zobrazí hodnotu zo state
//   data-if="kľúč" / "!kľúč"   zbaliteľná sekcia (animovaná, inert keď zatvorená)
//   data-cls="kľúč:trieda"     prepína CSS triedu
//   data-out="názov"      výstup vrátený z onChange (číslo + data-tween => animované)
import { $$, get, set, num, vibrate, clamp, eur } from './util.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

export function tween(el, to) {
  const from = el._v ?? 0;
  el._v = to;
  cancelAnimationFrame(el._raf);
  if (reduced || from === to) { el.textContent = eur(to); return; }
  const t0 = performance.now(), D = 420;
  const step = t => {
    const p = Math.min(1, (t - t0) / D), e = 1 - Math.pow(1 - p, 3);
    el.textContent = eur(from + (to - from) * e);
    if (p < 1) el._raf = requestAnimationFrame(step);
  };
  el._raf = requestAnimationFrame(step);
}

export function bindForm(root, state, onChange) {
  let outs = {};

  const refresh = () => {
    for (const el of $$('[data-k]', root)) {
      if (el === document.activeElement) continue;
      const v = get(state, el.dataset.k);
      if (el.type === 'checkbox') el.checked = !!v;
      else if (el.hasAttribute('data-blank') && !v) el.value = '';
      else if (el.dataset.dec !== undefined && typeof v === 'number') el.value = v.toFixed(+el.dataset.dec);
      else el.value = v ?? '';
    }
    for (const el of $$('[data-show]', root)) el.textContent = get(state, el.dataset.show);
    for (const el of $$('[data-seg],[data-set]', root)) {
      const key = el.dataset.seg || el.dataset.set;
      const cur = get(state, key);
      el.classList.toggle('on', el.dataset.seg ? String(cur) === el.dataset.v : Math.abs(num(cur) - num(el.dataset.v)) < 1e-6);
      el.setAttribute('aria-pressed', el.classList.contains('on'));
    }
    for (const el of $$('[data-step]', root)) {
      const next = num(get(state, el.dataset.step)) + num(el.dataset.d);
      el.disabled = next < num(el.dataset.min ?? 0) || next > num(el.dataset.max ?? 99);
    }
    for (const el of $$('[data-if]', root)) {
      let k = el.dataset.if, neg = false;
      if (k.startsWith('!')) { neg = true; k = k.slice(1); }
      const on = neg ? !get(state, k) : !!get(state, k);
      el.classList.toggle('open', on);
      el.inert = !on;
    }
    for (const el of $$('[data-cls]', root)) {
      const [k, c] = el.dataset.cls.split(':');
      el.classList.toggle(c, !!get(state, k));
    }
    for (const el of $$('[data-out]', root)) {
      const v = outs[el.dataset.out];
      if (v === undefined) continue;
      if (el.hasAttribute('data-tween')) tween(el, v);
      else if (el.tagName === 'INPUT') el.value = v;
      else el.textContent = v;
    }
  };

  const commit = changed => {
    state._changed = changed;
    outs = onChange?.(state, root, changed) || outs;
    refresh();
  };

  root.addEventListener('input', e => {
    const el = e.target.closest('[data-k]');
    if (!el || el.type === 'checkbox' || el.readOnly) return;
    set(state, el.dataset.k, el.dataset.t === 'text' ? el.value : num(el.value));
    commit(el.dataset.k);
  });
  root.addEventListener('change', e => {
    const el = e.target.closest('[data-k]');
    if (!el) return;
    if (el.type === 'checkbox') { set(state, el.dataset.k, el.checked); vibrate(10); commit(el.dataset.k); }
  });
  root.addEventListener('focusout', () => setTimeout(refresh, 0)); // preformátuje hodnoty po opustení poľa
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-step],[data-seg],[data-set]');
    if (!b || !root.contains(b)) return;
    let key;
    if (b.dataset.step) {
      key = b.dataset.step;
      const v = clamp(num(get(state, key)) + num(b.dataset.d), num(b.dataset.min ?? 0), num(b.dataset.max ?? 99));
      set(state, key, Math.round(v * 100) / 100);
    } else if (b.dataset.seg) {
      key = b.dataset.seg;
      set(state, key, b.dataset.v);
    } else {
      key = b.dataset.set;
      set(state, key, num(b.dataset.v));
    }
    vibrate(8);
    commit(key);
  });

  commit();
  return { state, update: () => commit(), refresh };
}
