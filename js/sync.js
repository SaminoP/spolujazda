// Firebase: prihlásenie (meno + heslo ako v pôvodnej aplikácii) a obojstranná synchronizácia v reálnom čase.
// Dáta: users/{uid}/items/{id}   (jazdy, tankovania, prevody)
//       users/{uid}/config/auto  (pravidelné jazdy – číta ich server)
//       users/{uid}/config/push  (push odbery zariadení)
// Lokálne úložisko ostáva primárne (offline-first); cloud len dopĺňa.
import * as store from './store.js';
import { convertLegacy } from './legacy.js';
import { getFirebaseConfig, isFirebaseConfigured } from '../firebase-config.js';

const V = '10.12.2';
const CDN = `https://www.gstatic.com/firebasejs/${V}/`;

let fb = null;            // { auth, db, au, fs }
let user = null;
let unsub = null;
let initPromise = null;
const remote = new Map(); // id -> updatedAt (čo je v cloude)
const listeners = new Set();
let status = 'Lokálny režim (bez cloudu)';
let offlineError = false;

const emit = () => listeners.forEach(f => f());
const setStatus = t => { status = t; emit(); };
export const onChange = f => { listeners.add(f); return () => listeners.delete(f); };
export const getUser = () => user;
export const getStatus = () => ({ text: status, user: user ? (user.displayName || user.email.split('@')[0]) : null, uid: user?.uid || null, offlineError });

// ───────── prihlasovacie meno -> e-mail / heslo (kompatibilné s pôvodnou aplikáciou) ─────────
export const usernameToEmail = username => {
  const clean = username.trim().toLowerCase();
  return clean.includes('@') ? clean : `${clean.replace(/[^a-z0-9_]/g, '')}@spolujazda.app`;
};
export const toFirebasePassword = (username, password) =>
  username.trim().toLowerCase() === 'admin' && password === 'admin'
    ? 'admin123456'
    : (password.length < 6 ? password + '000000'.slice(0, 6 - password.length) : password);

const friendly = e => ({
  'auth/invalid-credential': 'Nesprávne používateľské meno alebo heslo.',
  'auth/wrong-password': 'Nesprávne používateľské meno alebo heslo.',
  'auth/user-not-found': 'Nesprávne používateľské meno alebo heslo.',
  'auth/email-already-in-use': 'Používateľ s týmto menom už existuje.',
  'auth/weak-password': 'Heslo je príliš slabé (aspoň 3 znaky).',
  'auth/network-request-failed': 'Bez internetu – skús to znova.',
  'auth/too-many-requests': 'Príliš veľa pokusov, skús o chvíľu.',
  'permission-denied': 'Firestore odmietol prístup – skontroluj pravidlá (súbor firestore.rules).',
}[e.code] || e.message || String(e.code));

/** Načíta Firebase a obnoví prihlásenie. Vyrieši sa po prvom zistení stavu prihlásenia. */
export function init() {
  initPromise ??= (async () => {
    const cfg = getFirebaseConfig();
    if (!isFirebaseConfigured(cfg)) { setStatus('Firebase nie je nakonfigurovaný'); return null; }
    try {
      const [a, au, fs] = await Promise.all([import(CDN + 'firebase-app.js'), import(CDN + 'firebase-auth.js'), import(CDN + 'firebase-firestore.js')]);
      const app = a.initializeApp(cfg);
      fb = { auth: au.getAuth(app), db: fs.getFirestore(app), au, fs };
      offlineError = false;
      await new Promise(res => {
        au.onAuthStateChanged(fb.auth, u => {
          user = u;
          if (u) startSync(); else { stopSync(); setStatus('Nie si prihlásený (lokálny režim)'); }
          emit();
          res();
        });
      });
      return fb;
    } catch (e) {
      offlineError = true;
      setStatus('Cloud nedostupný (offline) – pracuješ lokálne');
      initPromise = null; // pri ďalšom pokuse skús znova
      return null;
    }
  })();
  return initPromise;
}

export async function signIn(username, password) {
  const f = await init();
  if (!f) throw new Error('Cloud je nedostupný – skontroluj pripojenie.');
  try { await f.au.signInWithEmailAndPassword(f.auth, usernameToEmail(username), toFirebasePassword(username, password)); }
  catch (e) { throw new Error(friendly(e)); }
}

export async function register(username, password) {
  const f = await init();
  if (!f) throw new Error('Cloud je nedostupný – skontroluj pripojenie.');
  try {
    const c = await f.au.createUserWithEmailAndPassword(f.auth, usernameToEmail(username), toFirebasePassword(username, password));
    await f.au.updateProfile(c.user, { displayName: username.trim() });
  } catch (e) { throw new Error(friendly(e)); }
}

export async function signOut() {
  if (fb) await fb.au.signOut(fb.auth);
}

export const idToken = () => user?.getIdToken();

// ───────── synchronizácia ─────────
const clean = o => JSON.parse(JSON.stringify(o));
let pushTimer = null;

function startSync() {
  stopSync();
  const { db, fs } = fb;
  setStatus('Synchronizujem…');
  unsub = fs.onSnapshot(fs.collection(db, 'users', user.uid, 'items'), snap => {
    const incoming = [];
    snap.docChanges().forEach(ch => {
      if (ch.type === 'removed') { remote.delete(ch.doc.id); return; }
      const d = ch.doc.data();
      remote.set(ch.doc.id, d.updatedAt || 0);
      incoming.push(d);
    });
    store.mergeItems(incoming);
    pushDiff();
    setStatus(`☁️ Synchronizované · ${new Date().toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' })}`);
    migrateLegacy().catch(() => {});
  }, err => setStatus(`⚠️ ${friendly(err)}`));
  pushAutoConfig?.();
}

function stopSync() {
  unsub?.(); unsub = null;
  remote.clear();
}

/** Odošle do cloudu všetko, čo je lokálne novšie. */
export async function pushDiff() {
  if (!fb || !user) return;
  const { db, fs } = fb;
  const jobs = store.allItems().filter(i => (i.updatedAt || 0) > (remote.get(i.id) ?? -1));
  if (!jobs.length) return;
  try {
    await Promise.all(jobs.map(i => { remote.set(i.id, i.updatedAt || 0); return fs.setDoc(fs.doc(db, 'users', user.uid, 'items', i.id), clean(i)); }));
  } catch (e) {
    jobs.forEach(i => remote.delete(i.id));
    setStatus(`⚠️ ${friendly(e)}`);
  }
}
export function schedulePush() {
  if (!user) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(pushDiff, 700);
}
store.subscribe(schedulePush);
addEventListener('online', () => { if (!fb) init(); else schedulePush(); });

// ───────── prevod starých dát (kolekcie trips / refuels / transfers) ─────────
export async function migrateLegacy(force = false) {
  if (!fb || !user) return 0;
  const flag = `pnbr.legacy.${user.uid}`;
  if (!force && localStorage.getItem(flag)) return 0;
  const { db, fs } = fb;
  const read = async c => (await fs.getDocs(fs.collection(db, 'users', user.uid, c))).docs.map(d => ({ ...d.data(), docId: d.id }));
  const [trips, refuels, transfers] = await Promise.all(['trips', 'refuels', 'transfers'].map(read));
  const items = convertLegacy({ trips, refuels, transfers });
  const added = store.mergeItems(items);
  localStorage.setItem(flag, '1');
  if (added) { setStatus(`☁️ Prevedené ${added} záznamov zo starej aplikácie`); schedulePush(); }
  return added;
}

// ───────── konfigurácia pre server (pravidelné jazdy, push) ─────────
let pendingAuto = null;
/** Zapíše nastavenie pravidelných jazdy tak, aby ho mohla čítať plánovaná funkcia na serveri. */
export async function pushAutoConfig(cfg = pendingAuto) {
  pendingAuto = cfg ?? store.settings().auto;
  if (!fb || !user || !pendingAuto) return;
  const { db, fs } = fb;
  const c = pendingAuto;
  try {
    await fs.setDoc(fs.doc(db, 'users', user.uid, 'config', 'auto'), clean({
      enabled: !!c.enabled, time: c.time, rules: c.rules, since: c.since || 0,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Bratislava',
      defaults: { price: store.settings().price, consumption: store.settings().consumption },
    }), { merge: true });
  } catch (e) { setStatus(`⚠️ ${friendly(e)}`); }
}

/** Uloží push odber tohto zariadenia (server z neho posiela notifikácie). */
export async function saveSubscription(sub) {
  if (!fb || !user) throw new Error('Najprv sa prihlás do cloudu.');
  const { db, fs } = fb;
  const key = btoa(sub.endpoint).replace(/[^A-Za-z0-9]/g, '').slice(-28);
  await fs.setDoc(fs.doc(db, 'users', user.uid, 'config', 'push'), {
    subs: { [key]: { id: key, sub, ua: navigator.userAgent.slice(0, 120), at: Date.now() } },
  }, { merge: true });
}

export function autoStart() {
  init();
}
