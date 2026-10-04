import {fingerprint} from './core.js';

const conflictMessage = 'This order changed while you were editing. Copy your note, close this window, and reopen the order to review the latest version.';

export async function saveResolution(fs, db, order, expected) {
  try {
  return await fs.runTransaction(db, async tx => {
    const ref = fs.doc(db, 'resolutions', order.id);
    const current = await tx.get(ref);
    if (!current.exists() || fingerprint(current.data()) !== expected) {
      throw Error(conflictMessage);
    }
    const {status, progress, due, done, link, subs, log} = order;
    tx.update(ref, {status, progress, due, done, link, subs, log});
  });
  } catch (error) {
    // Rules can reject a stale history before Firestore retries the transaction.
    if (error.code === 'permission-denied') {
      let current;
      try { current = await fs.getDocFromServer(fs.doc(db, 'resolutions', order.id)); } catch { /* Keep the original permission error if reads are denied. */ }
      if (current && (!current.exists() || fingerprint(current.data()) !== expected)) throw Error(conflictMessage);
    }
    throw error;
  }
}

export async function initializeResolutions(fs, db, seeds) {
  return fs.runTransaction(db, async tx => {
    const refs = seeds.map(order => fs.doc(db, 'resolutions', order.id));
    const snapshots = await Promise.all(refs.map(ref => tx.get(ref)));
    snapshots.forEach((snapshot, i) => {
      if (!snapshot.exists()) tx.set(refs[i], seeds[i]);
    });
  });
}
