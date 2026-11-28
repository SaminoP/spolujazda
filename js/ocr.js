// OCR bločkov (Tesseract.js sa sťahuje až pri prvom použití) + zmenšenie fotky pre uloženie
import { pad } from './util.js';

const TESS = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
let loading;
function loadTesseract() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  loading ??= new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = TESS;
    s.onload = () => res(window.Tesseract);
    s.onerror = () => { loading = null; rej(new Error('offline')); };
    document.head.append(s);
  });
  return loading;
}

function loadImage(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); res(img); };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('Obrázok sa nepodarilo načítať')); };
    img.src = url;
  });
}

function draw(img, max, { gray = false, quality = 0.6 } = {}) {
  const k = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * k);
  c.height = Math.round(img.height * k);
  const ctx = c.getContext('2d');
  if (gray) ctx.filter = 'grayscale(1) contrast(1.4)';
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return gray ? c : c.toDataURL('image/jpeg', quality);
}

const toNum = s => parseFloat(String(s).replace(/\s/g, '').replace(',', '.'));
const DEC = /(\d{1,4}[.,]\d{2,3})(?!\d)/g;

/** Z textu bločku vytiahne sumu, litre a dátum (heuristika – používateľ si hodnoty skontroluje). */
export function parseReceipt(text) {
  const out = {};
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  // dátum
  const dm = text.match(/(\d{1,2})\s*[./-]\s*(\d{1,2})\s*[./-]\s*(20\d{2}|\d{2})\b/);
  if (dm) {
    let [, d, m, y] = dm;
    if (y.length === 2) y = '20' + y;
    if (+m >= 1 && +m <= 12 && +d >= 1 && +d <= 31) out.date = `${y}-${pad(+m)}-${pad(+d)}`;
  }

  // litre: číslo hneď pred „l“ / „litr“, alebo riadok s kľúčovým slovom
  let m = text.match(/(\d{1,3}[.,]\d{2,3})\s*(?:l|ℓ|lit)\b/i);
  if (m) out.liters = toNum(m[1]);
  if (!out.liters) {
    for (const l of lines) {
      if (/mno[zž]stv|litr|objem|quantity/i.test(l)) { const n = l.match(DEC); if (n) { out.liters = toNum(n[0]); break; } }
    }
  }

  // suma: riadok s „spolu / celkom / k úhrade / total“, inak najväčšie desatinné číslo
  for (const l of lines) {
    if (/spolu|celkom|k [uú]hrade|[uú]hrada|total|suma|sum\b/i.test(l)) {
      const n = (l.match(DEC) || []).map(toNum).filter(v => v > 0);
      if (n.length) { out.total = Math.max(...n); break; }
    }
  }
  if (!out.total) {
    const all = (text.match(DEC) || []).map(toNum).filter(v => v > 1 && v < 400 && v !== out.liters);
    if (all.length) out.total = Math.max(...all);
  }

  // sanity kontrola
  if (out.liters && (out.liters < 1 || out.liters > 150)) delete out.liters;
  if (out.total && out.liters) {
    const ppl = out.total / out.liters;
    if (ppl < 0.7 || ppl > 3.5) delete out.liters;
  }
  return out;
}

/** Spracuje fotku bločku: zmenší ju, spustí OCR. Vráti { dataUrl, total?, liters?, date?, ocrError? } */
export async function scanReceipt(file, onProgress = () => {}) {
  const img = await loadImage(file);
  const dataUrl = draw(img, 900, { quality: 0.55 });
  try {
    onProgress(0.02, 'Sťahujem OCR modul…');
    const T = await loadTesseract();
    const canvas = draw(img, 1700, { gray: true });
    const r = await T.recognize(canvas, 'eng', {
      logger: m => { if (m.status === 'recognizing text') onProgress(m.progress, 'Čítam bloček…'); },
    });
    return { dataUrl, ...parseReceipt(r.data.text), text: r.data.text };
  } catch (e) {
    return { dataUrl, ocrError: e.message === 'offline' ? 'OCR potrebuje internet (fotka sa uložila)' : 'OCR zlyhalo – hodnoty zadaj ručne' };
  }
}
