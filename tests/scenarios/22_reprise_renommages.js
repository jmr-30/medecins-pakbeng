// Reprise : un nom corrigé d'un seul côté (médicament par la pharmacienne, médecin sur la tablette) est reporté partout
const { chromium } = require('playwright');
const R = require('./_relais');
const MOL = 'PARACETAMOL — TEST — cpr', MOL2 = 'PARACETAMOL — 500 mg — cpr (test)';
// Renomme comme le fait l'écran Paramètres : liste, données, journal
const renommer = (p, cle, a, n, ancienJournal) => p.evaluate(async ([cle, a, n, ancienJournal]) => {
  const l = await getParam(cle, REF[cle]); await setParam(cle, l.map(v => v === a ? n : v));
  await renommerDansDonnees(cle, a, n);
  if (ancienJournal) await journaliser('renommage', 'liste', null, null, `${a} → ${n}`);          // entrée écrite par une version antérieure
  else await journaliser('renommage', 'liste', null, null, `${a} → ${n}`, { liste: cle, ancien: a, nouveau: n });
}, [cle, a, n, ancienJournal]);
(async () => {
  const b = await chromium.launch(R.cr({}));
  for (const ancienJournal of [false, true]) {
    const tab = await R.appareil(b, 'tablette', true);
    await tab.evaluate(async MOL => {
      await setParam('molecules', [...await getParam('molecules', REF.molecules), MOL]);
      await setParam('medecins', [...await getParam('medecins', REF.medecins), 'Dr. Dupond']);
      await dbPut('stock_config', { molecule: MOL, suivi: true, unite: 'unité', stockMinimal: 20, stockConfort: 60 });
      await dbAdd('receptions', { date: '2026-11-01', fournisseur: 'Test', molecule: MOL, lot: 'Exp. 06/2028', datePeremption: '2028-06-01', quantite: 100, createdAt: '2026-11-01T08:00:00.000Z' });
      await dbAdd('consultations', { date: '2026-11-02', nom: 'VENDREDI', prenom: 'Test', lieu: 'Dispensaire', medecin1: 'Dr. Dupond', prescription: [{ molecule: MOL, quantite: 10, lots: [{ lot: 'Exp. 06/2028', datePeremption: '2028-06-01', quantite: 10 }] }], createdAt: '2026-11-02T08:00:00.000Z' });
    }, MOL);
    await R.sauver(tab, 'vendredi.json');
    // Week-end : la pharmacienne corrige le nom du médicament
    const ph = await R.appareil(b, 'pharmacie');
    await R.reprendre(ph, 'vendredi.json');
    await renommer(ph, 'molecules', MOL, MOL2, ancienJournal);
    await R.sauver(ph, 'dimanche.json');
    // Samedi, sur la tablette : une consultation avec l'ancien nom du médicament ; le nom d'un médecin est corrigé
    await tab.evaluate(async MOL => { await dbAdd('consultations', { date: '2026-11-07', nom: 'SAMEDI', prenom: 'Test', lieu: 'Dispensaire', medecin1: 'Dr. Dupond', prescription: [{ molecule: MOL, quantite: 5, lots: [{ lot: 'Exp. 06/2028', datePeremption: '2028-06-01', quantite: 5 }] }], createdAt: new Date().toISOString() }); }, MOL);
    await renommer(tab, 'medecins', 'Dr. Dupond', 'Dr. Dupont-Martin', ancienJournal);
    await R.reprendre(tab, 'dimanche.json');
    const r = await tab.evaluate(async ([MOL, MOL2]) => {
      const cs = await dbGetAll('consultations'), mols = await getParam('molecules', []), meds = await getParam('medecins', []);
      return { samedi: cs.find(c => c.nom === 'SAMEDI').prescription[0].molecule === MOL2, medecinVendredi: cs.find(c => c.nom === 'VENDREDI').medecin1, medecinSamedi: cs.find(c => c.nom === 'SAMEDI').medecin1,
        listeMol: [mols.includes(MOL), mols.includes(MOL2)].join('/'), listeMed: [meds.includes('Dr. Dupond'), meds.includes('Dr. Dupont-Martin')].join('/'),
        fiche: [!!(await dbGet('stock_config', MOL)), (await dbGet('stock_config', MOL2))?.stockMinimal].join('/') };
    }, [MOL, MOL2]);
    console.log(`${ancienJournal ? 'Journal ancien format' : 'Journal actuel'} — ancien nom : ${await R.stock(tab, MOL)} | nouveau nom : ${await R.stock(tab, MOL2)}`);
    console.log(`${ancienJournal ? 'Journal ancien format' : 'Journal actuel'} — ${JSON.stringify(r)}`);
    await tab.context().close(); await ph.context().close();
  }
  await b.close();
})().catch(e => { console.error('ECHEC', e); process.exit(1); });
