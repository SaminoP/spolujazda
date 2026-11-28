// HTTP funkcia: pošle skúšobnú push notifikáciu prihlásenému používateľovi (overí celý reťazec).
import { admin, pushToUser } from '../lib/shared.mjs';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export default async req => {
  if (req.method !== 'POST') return json({ error: 'Použi POST' }, 405);
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Chýba prihlásenie' }, 401);
  try {
    const { db, auth } = admin();
    const { uid } = await auth.verifyIdToken(token);
    const r = await pushToUser(db, uid, {
      title: 'Jazda pridaná ✓ (skúška)',
      body: 'Takto bude vyzerať upozornenie.\nChceš v jazde zmeniť údaje?',
      tag: 'test',
    });
    return json(r);
  } catch (e) {
    const msg = String(e.message || e);
    if (/FIREBASE_SERVICE_ACCOUNT|VAPID/.test(msg)) return json({ error: `Server nie je nastavený: ${msg}` }, 500);
    if (/token|auth/i.test(msg)) return json({ error: 'Neplatné prihlásenie' }, 401);
    console.error(e);
    return json({ error: 'Chyba servera' }, 500);
  }
};
