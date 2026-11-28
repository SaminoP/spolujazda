// Firebase Admin + Web Push pomocné funkcie pre Netlify funkcie.
// Potrebné premenné prostredia (Netlify → Site configuration → Environment variables):
//   FIREBASE_SERVICE_ACCOUNT  – JSON služobného účtu Firebase (celý obsah súboru)
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY – kľúče pre Web Push
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import webpush from 'web-push';

let configured = false;

export function admin() {
  if (!getApps().length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) throw new Error('Chýba premenná FIREBASE_SERVICE_ACCOUNT');
    initializeApp({ credential: cert(JSON.parse(raw)) });
  }
  if (!configured) {
    const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) throw new Error('Chýbajú premenné VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY');
    // „subject" je adresa stránky (Netlify ju dodá v premennej URL) – žiadne osobné údaje
    webpush.setVapidDetails(process.env.URL || 'https://spolujazda.netlify.app', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    configured = true;
  }
  return { db: getFirestore(), auth: getAuth() };
}

/** Pošle push všetkým zariadeniam používateľa. Neplatné odbery (404/410) sa zmažú. Vráti { sent, failed }. */
export async function pushToUser(db, uid, payload) {
  const ref = db.doc(`users/${uid}/config/push`);
  const snap = await ref.get();
  const subs = Object.values(snap.data()?.subs || {});
  let sent = 0, failed = 0;
  await Promise.all(subs.map(async s => {
    try {
      await webpush.sendNotification(s.sub, JSON.stringify(payload), { TTL: 6 * 3600, urgency: 'high' });
      sent++;
    } catch (e) {
      failed++;
      if (e.statusCode === 404 || e.statusCode === 410) await ref.update({ [`subs.${s.id}`]: FieldValue.delete() }).catch(() => {});
      else console.error('push error', e.statusCode, e.body);
    }
  }));
  return { sent, failed };
}
