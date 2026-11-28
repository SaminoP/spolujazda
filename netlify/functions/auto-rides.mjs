// Plánovaná funkcia (každých 5 minút): v nastavený deň/čas pridá jazdu do databázy a pošle push notifikáciu.
import { admin, pushToUser } from '../lib/shared.mjs';
import { dueOccurrences, buildAutoRide, notificationFor } from '../lib/core.mjs';

export default async () => {
  const { db } = admin();
  const now = Date.now();
  const users = await db.collection('users').listDocuments(); // aj „virtuálne" dokumenty, ktoré majú len podkolekcie
  const report = [];

  for (const u of users) {
    try {
      const cfgRef = db.doc(`users/${u.id}/config/auto`);
      const cfg = (await cfgRef.get()).data();
      if (!cfg?.enabled) continue;

      const after = Math.max(cfg.since || 0, cfg.lastRun || 0);
      const due = dueOccurrences(cfg, now, after);
      if (!due.length) continue;

      const items = db.collection(`users/${u.id}/items`);
      const rides = (await items.where('type', '==', 'ride').get()).docs.map(d => d.data());
      const created = [];
      for (const occ of due) {
        const ride = buildAutoRide(occ, rides, cfg.defaults);
        try { await items.doc(ride.id).create(ride); created.push(ride); rides.push(ride); }
        catch (e) { if (e.code !== 6 && !/ALREADY_EXISTS/.test(String(e.message))) throw e; } // už existuje (vytvorila ju aplikácia / zmazal ju používateľ)
      }
      await cfgRef.set({ lastRun: now }, { merge: true });

      if (created.length) {
        const last = created[created.length - 1];
        const note = notificationFor(last);
        if (created.length > 1) note.body = `+ ${created.length - 1} ďalšie zmeškané jazdy\n${note.body}`;
        const r = await pushToUser(db, u.id, note);
        report.push({ uid: u.id.slice(0, 6), created: created.length, ...r });
      }
    } catch (e) {
      console.error('auto-rides user error', u.id, e);
    }
  }
  console.log('auto-rides', JSON.stringify(report));
};

export const config = { schedule: '*/5 * * * *' };
