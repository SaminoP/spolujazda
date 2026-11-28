// Drobné pomocné funkcie
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const pad = n => String(n).padStart(2, '0');

/** Bezpečné parsovanie čísla (akceptuje aj desatinnú čiarku). */
export const num = v => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const n = parseFloat(String(v ?? '').replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};
export const round2 = n => Math.round((n + Number.EPSILON) * 100) / 100;
export const round3 = n => Math.round((n + Number.EPSILON) * 1000) / 1000;
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const thousands = s => s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
export const eur = n => {
  const [i, d] = Math.abs(round2(n)).toFixed(2).split('.');
  return `${n < 0 && round2(n) !== 0 ? '−' : ''}${thousands(i)}.${d} €`;
};
export const czk = n => `${thousands(String(Math.round(n)))} Kč`;
export const n1 = (n, d = 1) => Number(n).toFixed(d);
export const int = n => thousands(String(Math.round(n)));

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const DAYS = ['Ne', 'Po', 'Ut', 'St', 'Št', 'Pi', 'So'];
export const fmtDate = iso => {
  const d = new Date(iso + 'T12:00');
  if (isNaN(d)) return iso || '—';
  return `${DAYS[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
};
const MONTHS = ['Január', 'Február', 'Marec', 'Apríl', 'Máj', 'Jún', 'Júl', 'August', 'September', 'Október', 'November', 'December'];
export const monthName = i => MONTHS[i];
export const fmtMonth = iso => {
  const [y, m] = iso.split('-');
  return `${MONTHS[+m - 1] ?? ''} ${y}`;
};

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const vibrate = (ms = 8) => { try { navigator.vibrate?.(ms); } catch { /* ignore */ } };

export const get = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
export const set = (o, p, v) => {
  const ks = p.split('.');
  const last = ks.pop();
  const t = ks.reduce((a, k) => a[k], o);
  if (t) t[last] = v;
};

export function download(name, text, type = 'application/json') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
