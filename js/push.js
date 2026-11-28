// Web Push (ako notifikácie z Messengeru): odber zariadenia sa uloží do cloudu a server naň o 19:00 pošle správu.
import { VAPID_PUBLIC_KEY } from './push-config.js';
import * as sync from './sync.js';

const b64ToBytes = b64 => {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
};

export const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isStandalone = () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;

/** Stav pre UI: { kind, text } */
export async function state() {
  if (!supported()) {
    return isIOS() && !isStandalone()
      ? { kind: 'install', text: '📲 Na iPhone najprv pridaj aplikáciu na plochu: Safari → Zdieľať → „Pridať na plochu", otvor ju odtiaľ a potom povoľ upozornenia.' }
      : { kind: 'unsupported', text: '⚠️ Tento prehliadač nepodporuje push notifikácie.' };
  }
  if (Notification.permission === 'denied') return { kind: 'denied', text: '🚫 Notifikácie sú zablokované – povoľ ich v nastaveniach iPhonu/prehliadača pre túto aplikáciu.' };
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (Notification.permission === 'granted' && sub) return { kind: 'on', text: '🔔 Notifikácie sú zapnuté na tomto zariadení.' };
  return { kind: 'off', text: 'Notifikácie na tomto zariadení zatiaľ nie sú zapnuté.' };
}

export async function enable() {
  if (!supported()) throw new Error('Push notifikácie tu nie sú podporované.');
  if (!sync.getUser()) throw new Error('Najprv sa prihlás do cloudu.');
  const perm = await Notification.requestPermission(); // musí byť volané priamo po ťuknutí
  if (perm !== 'granted') throw new Error('Notifikácie neboli povolené.');
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription())
    || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(VAPID_PUBLIC_KEY) });
  await sync.saveSubscription(sub.toJSON());
}

/** Požiada server, aby poslal skúšobnú notifikáciu na všetky zariadenia používateľa. */
export async function sendTest() {
  const token = await sync.idToken();
  if (!token) throw new Error('Najprv sa prihlás do cloudu.');
  let res;
  try { res = await fetch('/.netlify/functions/test-push', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }); }
  catch { throw new Error('Server nie je dostupný (si offline alebo beží lokálne bez Netlify).'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Server vrátil chybu ${res.status}`);
  return data;
}
