// Spoločné UI prvky: toast, bottom-sheet, potvrdenie, prehliadač obrázkov
import { $, esc, vibrate } from './util.js';

export function toast(msg, kind = 'ok') {
  const box = $('#toasts');
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = msg;
  box.append(el);
  requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 300); }, 2600);
}

function layer(html, cls) {
  const wrap = document.createElement('div');
  wrap.className = cls;
  wrap.innerHTML = html;
  document.body.append(wrap);
  document.body.classList.add('lock');
  requestAnimationFrame(() => wrap.classList.add('in'));
  const close = () => {
    wrap.classList.remove('in');
    setTimeout(() => { wrap.remove(); if (!$('.sheet-wrap,.dialog-wrap')) document.body.classList.remove('lock'); }, 260);
  };
  return { wrap, close };
}

/** Spodné modálne okno. `build(body)` naplní obsah, `onSave()` vráti false pre ponechanie otvoreného. */
export function openSheet(title, build, { saveLabel = 'Uložiť', onSave } = {}) {
  const { wrap, close } = layer(`
    <div class="sheet-bg" data-close></div>
    <div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="sheet-grab"></div>
      <header><h2>${esc(title)}</h2><button type="button" class="x" data-close aria-label="Zavrieť">✕</button></header>
      <div class="sheet-body"></div>
      <footer><button type="button" class="btn ghost" data-close>Zrušiť</button><button type="button" class="btn" data-save>${esc(saveLabel)}</button></footer>
    </div>`, 'sheet-wrap');
  build($('.sheet-body', wrap));
  wrap.addEventListener('click', e => {
    if (e.target.closest('[data-close]')) close();
    else if (e.target.closest('[data-save]')) { if (onSave?.() !== false) close(); }
  });
  return close;
}

export function confirmDialog(msg, { ok = 'Zmazať', cancel = 'Zrušiť', danger = true, title = 'Naozaj?' } = {}) {
  return new Promise(res => {
    const { wrap, close } = layer(`
      <div class="sheet-bg" data-r="0"></div>
      <div class="dialog" role="alertdialog" aria-modal="true">
        <h3>${esc(title)}</h3><p>${esc(msg)}</p>
        <div class="dialog-btns"><button type="button" class="btn ghost" data-r="0">${esc(cancel)}</button>
        <button type="button" class="btn ${danger ? 'danger' : ''}" data-r="1">${esc(ok)}</button></div>
      </div>`, 'dialog-wrap');
    wrap.addEventListener('click', e => {
      const b = e.target.closest('[data-r]');
      if (!b) return;
      vibrate(10);
      close();
      res(b.dataset.r === '1');
    });
  });
}

export function viewImage(src) {
  const { wrap, close } = layer(`<div class="sheet-bg" data-close></div><img class="viewer" alt="Bloček" src="${src}"><button type="button" class="x viewer-x" data-close aria-label="Zavrieť">✕</button>`, 'sheet-wrap viewer-wrap');
  wrap.addEventListener('click', close);
}
