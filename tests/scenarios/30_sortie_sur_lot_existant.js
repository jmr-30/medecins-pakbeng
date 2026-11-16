// Sortie de stock : toujours sur un lot existant du médicament, sans dépasser son contenu (plus de lot fantôme « (sans lot) »)
const { chromium } = require('playwright');
const R = require('./_relais');
const MOL = 'AMOXICILLINE — 500 mg — gélule';
(async () => {
  const b = await chromium.launch(R.cr({}));
  const p = await R.appareil(b, 'tablette');
  await p.evaluate(async MOL => {
    for (const r of await dbGetAll('receptions')) if (r.molecule === MOL) await dbDelete('receptions', r.id);
    await dbAdd('receptions', { date: '2026-11-01', fournisseur: 'Test', molecule: MOL, lot: 'Exp. 06/2028', datePeremption: '2028-06-01', quantite: 60, createdAt: 'a1' });
    await dbAdd('receptions', { date: '2026-11-01', fournisseur: 'Test', molecule: MOL, lot: 'Exp. 01/2026', datePeremption: '2026-01-01', quantite: 40, createdAt: 'a2' });
  }, MOL);
  await p.evaluate(() => goScreen('sortie')); await p.waitForTimeout(500);
  const options = () => p.evaluate(() => ({ actif: !document.getElementById('s_lotsel').disabled, choix: [...document.getElementById('s_lotsel').options].map(o => o.textContent) }));
  console.log('Sans médicament :', JSON.stringify(await options()));
  await p.evaluate(MOL => COMBOS.s_mol.setValue(MOL), MOL); await p.waitForTimeout(500);
  console.log('Lots proposés :', JSON.stringify(await options()));
  const essai = async (titre, lot, qte) => {
    await p.evaluate(([lot, qte]) => { document.getElementById('s_motif').value = 'Mise à jour du stock'; document.getElementById('s_lotsel').value = lot; document.getElementById('s_qty').value = qte; }, [lot, qte]);
    await p.click('#screen-sortie button:has-text("Enregistrer")'); await p.waitForTimeout(700);
    console.log(`${titre} : ${(await p.textContent('#toast')).trim()} | stock : ${await R.stock(p, MOL)}`);
    await p.evaluate(MOL => { if (!COMBOS.s_mol.getValue()) COMBOS.s_mol.setValue(MOL); }, MOL); await p.waitForTimeout(400);
  };
  await essai('Sans lot choisi', '', 10);
  await essai('Quantité trop grande', 'Exp. 06/2028', 70);
  await essai('Sortie valide', 'Exp. 06/2028', 40);
  await essai('Lot périmé sorti en entier', 'Exp. 01/2026', 40);
  console.log('Lots proposés ensuite :', JSON.stringify(await options()));
  console.log('Délivrance de 30 →', JSON.stringify(await p.evaluate(async MOL => { const m = await calculerStock(); const a = allouerFEFO(m[MOL], {}, 30, ''); return { lots: a.prelevements.map(x => x.lot + ' : ' + x.quantite), manque: a.manque }; }, MOL)));
  // Médicament sans aucun stock
  await p.evaluate(async () => { const l = await getParam('molecules', REF.molecules); await setParam('molecules', [...l, 'SANS STOCK — TEST']); await rechargerCombosMolecules(); COMBOS.s_mol.setValue('SANS STOCK — TEST'); }); await p.waitForTimeout(500);
  console.log('Médicament sans stock :', JSON.stringify(await options()));
  await essai('Sortie sans stock', '', 5);
  console.log('Lot fantôme créé :', await p.evaluate(async () => Object.values(await calculerStock()).some(l => l['(sans lot)'])));
  await b.close();
})().catch(e => { console.error('ECHEC', e); process.exit(1); });
