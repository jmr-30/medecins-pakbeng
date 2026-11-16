// Écran Stock : la liste « Anomalies de stock » signale les situations où le stock calculé ne peut pas correspondre à l'étagère
const { chromium } = require('playwright');
const R = require('./_relais');
(async () => {
  const b = await chromium.launch(R.cr({}));
  const p = await R.appareil(b, 'tablette');
  const voir = async () => { await p.evaluate(() => goScreen('stock')); await p.waitForTimeout(900);
    return p.evaluate(() => ({ visible: document.getElementById('stockAnomalies').style.display !== 'none', titre: document.getElementById('stockAnomaliesTitre').textContent,
      lignes: [...document.querySelectorAll('#stockAnomaliesListe > div')].map(d => d.textContent) })); };
  let r = await voir();
  console.log('Stock sain : bloc visible :', r.visible);
  await p.evaluate(async () => {
    const rec = (mol, lot, per, q, k) => dbAdd('receptions', { date: '2026-11-01', fournisseur: 'Test', molecule: mol, lot, datePeremption: per, quantite: q, createdAt: k });
    const A = 'AMOXICILLINE — 500 mg — gélule';
    // 1. délivré au-delà du stock connu
    await dbAdd('consultations', { date: '2026-11-02', nom: 'A', prescription: [{ molecule: A, quantite: 5, lots: [{ lot: LOT_A_REGULARISER, datePeremption: '', quantite: 5 }] }], createdAt: 'c1' });
    // 2. ancienne sortie sans lot (lot fantôme)
    await dbAdd('sorties', { date: '2026-11-03', motif: 'Casse', molecule: 'IBUPROFENE — 400 mg — cpr', lot: '', datePeremption: '', quantite: 40, createdAt: 's1' });
    // 3. lot devenu négatif
    await rec('PARACETAMOL — 500 mg — cpr', 'Exp. 03/2029', '2029-03-01', 10, 'r1');
    await dbAdd('sorties', { date: '2026-11-03', motif: 'Casse', molecule: 'PARACETAMOL — 500 mg — cpr', lot: 'Exp. 03/2029', datePeremption: '2029-03-01', quantite: 25, createdAt: 's2' });
    // 4. date de péremption illisible
    await rec('AC FOLIQUE — 5 mg — cpr', 'Exp. voir boîte', 'voir boîte', 30, 'r2');
    // 5. stock sous un nom absent de la liste des médicaments
    await rec('ANCIEN NOM — 1 mg — cpr', 'Exp. 06/2028', '2028-06-01', 12, 'r3');
  });
  r = await voir();
  console.log('Titre :', r.titre);
  r.lignes.forEach(l => console.log('  ', l));
  // L'inventaire du médicament corrige le lot fantôme
  await p.evaluate(async () => { const M = 'IBUPROFENE — 400 mg — cpr'; _invMoteur = await calculerStock();
    const comptes = {}; Object.values(_invMoteur[M]).forEach(l => { comptes[invCle(M, l.lot)] = Math.max(l.restant, 0); });
    localStorage.setItem(INV_KEY, JSON.stringify({ comptes, nouveaux: [] })); window.__autoValider = true; await validerInventaire(); });
  r = await voir();
  console.log('Après inventaire de l\'ibuprofène :', r.titre, '| ibuprofène encore signalé :', r.lignes.some(l => /IBUPROFENE/.test(l)));
  await b.close();
})().catch(e => { console.error('ECHEC', e); process.exit(1); });
