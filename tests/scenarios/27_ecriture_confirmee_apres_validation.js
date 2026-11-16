// Une écriture n'est confirmée qu'une fois la transaction validée (durabilité stricte) ; une transaction annulée est signalée en erreur
const { chromium } = require('playwright');
const R = require('./_relais');
(async () => {
  const b = await chromium.launch(R.cr({}));
  const p = await R.appareil(b, 'tablette');
  const r = await p.evaluate(async () => {
    // 1. Observation d'une écriture normale
    const vues = []; const origTx = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (noms, mode, opt) {
      const tx = origTx.call(this, noms, mode, opt);
      if (mode === 'readwrite') { const v = { opt: opt && opt.durability, validee: false }; vues.push(v); tx.addEventListener('complete', () => { v.validee = true; }); }
      return tx;
    };
    const etat = async (nom, f) => { vues.length = 0; let ok = true; try { await f(); } catch(e) { ok = false; } return `${nom} : ${ok ? 'confirmée' : 'erreur'}, transaction validée avant la confirmation : ${vues.every(v => v.validee)}, durabilité : ${[...new Set(vues.map(v => v.opt))].join('/')}`; };
    const lignes = [];
    let id;
    lignes.push(await etat('Ajout', async () => { id = await dbAdd('consultations', { date: dateAujourdhui(), nom: 'DURABLE', createdAt: new Date().toISOString() }); }));
    lignes.push(await etat('Modification', async () => { await dbPut('consultations', { id, date: dateAujourdhui(), nom: 'DURABLE 2', createdAt: 'x' }); }));
    lignes.push(await etat('Réglage', async () => { await setParam('essai', 1); }));
    lignes.push(await etat('Suppression', async () => { await dbDelete('consultations', id); }));
    lignes.push('Numéro renvoyé par l\'ajout : ' + (Number.isInteger(id) && id > 0));
    IDBDatabase.prototype.transaction = origTx;
    // 2. Transaction annulée juste après la réussite de la requête (panne simulée) : l'écriture doit être signalée en erreur
    const origAdd = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (...a) { const req = origAdd.apply(this, a); const tx = this.transaction; req.addEventListener('success', () => tx.abort()); return req; };
    let issue = 'confirmée';
    try { await dbAdd('consultations', { date: dateAujourdhui(), nom: 'PERDUE', createdAt: new Date().toISOString() }); } catch(e) { issue = 'erreur'; }
    IDBObjectStore.prototype.add = origAdd;
    lignes.push(`Transaction annulée après la requête : ${issue} | enregistrée : ${(await dbGetAll('consultations')).some(c => c.nom === 'PERDUE')}`);
    return lignes;
  });
  r.forEach(l => console.log(l));
  await b.close();
})().catch(e => { console.error('ECHEC', e); process.exit(1); });
