// Inventaire : les quantités « à régulariser » sont soldées quand tous les lots du médicament sont comptés (et seulement dans ce cas)
const { chromium } = require('playwright');
const R = require('./_relais');
const A = 'MEDICAMENT A — TEST — cpr', B = 'MEDICAMENT B — TEST — cpr';
(async () => {
  const b = await chromium.launch(R.cr({}));
  const p = await R.appareil(b, 'tablette');
  await p.evaluate(async ([A, B]) => {
    for (const [mol, k] of [[A, 'a'], [B, 'b']]) {
      await dbAdd('receptions', { date: '2026-11-01', fournisseur: 'Test', molecule: mol, lot: 'Exp. 06/2028', datePeremption: '2028-06-01', quantite: 10, createdAt: k + '1' });
      await dbAdd('receptions', { date: '2026-11-01', fournisseur: 'Test', molecule: mol, lot: 'Exp. 01/2029', datePeremption: '2029-01-01', quantite: 30, createdAt: k + '2' });
      // 15 délivrées alors que le premier lot n'en avait que 10 en théorie, lot imposé : 5 « à régulariser »
      await dbAdd('consultations', { date: '2026-11-02', nom: 'P' + k, prescription: [{ molecule: mol, quantite: 15, lots: [{ lot: 'Exp. 06/2028', datePeremption: '2028-06-01', quantite: 10 }, { lot: LOT_A_REGULARISER, datePeremption: '', quantite: 5 }] }], createdAt: k + '3' });
    }
  }, [A, B]);
  console.log('Avant inventaire — A :', await R.stock(p, A));
  await p.evaluate(() => goScreen('inventaire')); await p.waitForTimeout(800);
  console.log('Écran inventaire :', (await p.textContent('#invBody')).replace(/\s+/g, ' ').match(/⚠ 5 à régulariser[^└]*/)?.[0].trim());
  // A : les deux lots sont comptés (0 et 30). B : un seul lot compté sur deux.
  await p.evaluate(async ([A, B]) => {
    localStorage.setItem(INV_KEY, JSON.stringify({ comptes: { [invCle(A, 'Exp. 06/2028')]: 0, [invCle(A, 'Exp. 01/2029')]: 30, [invCle(B, 'Exp. 06/2028')]: 0 }, nouveaux: [] }));
    window.__msgs = []; const orig = boiteDialogue; boiteDialogue = o => { window.__msgs.push(o.message || ''); return orig(o); };
    await validerInventaire();
  }, [A, B]);
  console.log('Confirmation :', (await p.evaluate(() => window.__msgs.join('\n'))).split('\n').filter(l => /régulariser/.test(l)).join(' ').trim());
  console.log('Après inventaire — A (entièrement compté) :', await R.stock(p, A));
  console.log('Après inventaire — B (un lot non compté) :', await R.stock(p, B));
  await p.evaluate(async A => { await dbAdd('receptions', { date: '2026-11-10', fournisseur: 'Test', molecule: A, lot: 'Exp. 03/2029', datePeremption: '2029-03-01', quantite: 100, createdAt: 'a9' }); }, A);
  console.log('A après réception de 100 :', (await R.stock(p, A)).split(' ')[0], '(réel : 130)');
  const r = await p.evaluate(async A => ({ entree: (await dbGetAll('receptions')).filter(x => x.fournisseur === 'Inventaire' && x.molecule === A).map(x => `${x.lot} +${x.quantite}`).join(','),
    historique: (await getParam('inventaires', []))[0].lignes.filter(l => l.regularisation).map(l => `${l.molecule} ${l.theorique}→${l.compte}`).join(',') }), A);
  console.log('Traçabilité :', JSON.stringify(r));
  // Second inventaire identique : rien à solder de nouveau
  await p.evaluate(async A => { localStorage.setItem(INV_KEY, JSON.stringify({ comptes: { [invCle(A, 'Exp. 06/2028')]: 0, [invCle(A, 'Exp. 01/2029')]: 30, [invCle(A, 'Exp. 03/2029')]: 100 }, nouveaux: [] })); await validerInventaire(); }, A);
  console.log('Après second inventaire — A :', (await R.stock(p, A)).split(' ')[0]);
  await b.close();
})().catch(e => { console.error('ECHEC', e); process.exit(1); });
