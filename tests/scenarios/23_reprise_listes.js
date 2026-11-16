// Reprise : un village, un médecin ou un hôpital ajouté sur la tablette entre-temps reste dans les listes ; un nom retiré par la pharmacienne ne revient pas
const { chromium } = require('playwright');
const R = require('./_relais');
(async () => {
  const b = await chromium.launch(R.cr({}));
  const tab = await R.appareil(b, 'tablette', true);
  await tab.evaluate(async () => {
    await setParam('lieux', [...await getParam('lieux', REF.lieux), 'Ban Ancien']);
    await setParam('medecins', [...await getParam('medecins', REF.medecins), 'Dr. Retiré']);
    await setParam('molecules', [...await getParam('molecules', REF.molecules)]);
  });
  await R.sauver(tab, 'vendredi.json');
  // Week-end : la pharmacienne retire un médecin de la liste et ajoute un médicament
  const ph = await R.appareil(b, 'pharmacie');
  await R.reprendre(ph, 'vendredi.json');
  await ph.evaluate(async () => {
    await setParam('medecins', (await getParam('medecins', [])).filter(m => m !== 'Dr. Retiré'));
    await setParam('molecules', [...await getParam('molecules', []), 'NOUVEAU — 10 mg — cpr'].sort((a, b) => a.localeCompare(b, 'fr')));
  });
  await R.sauver(ph, 'dimanche.json');
  // Samedi, sur la tablette : village ajouté à la volée, nouveau médecin, hôpital, mission créée, réception d'un nouveau fournisseur
  await tab.evaluate(async () => {
    await setParam('lieux', [...await getParam('lieux', REF.lieux), 'Ban Samedi', 'Ban Jamais Utilisé']);
    await setParam('medecins', [...await getParam('medecins', REF.medecins), 'Dr. Samedi']);
    await setParam('hopitaux', [...(await getParam('hopitaux', REF_HOPITAUX) || []), 'Hôpital de Samedi']);
    await setParam('missions', [...await getParam('missions', []), { numero: 'Mission 10', debut: '2027-01-10', fin: '2027-01-25', medecins: 'Dr. Samedi' }]);
    await dbAdd('consultations', { date: dateAujourdhui(), nom: 'SAMEDI', prenom: 'Test', lieu: 'Dispensaire Pakbeng', habitation: 'Ban Samedi', medecin1: 'Dr. Samedi', orientation: { hopital: 'Hôpital de Samedi', motif: 'x' }, createdAt: new Date().toISOString() });
    await dbAdd('receptions', { date: dateAujourdhui(), fournisseur: 'Don local', molecule: 'AMOXICILLINE — 500 mg — gélule', lot: 'Exp. 06/2028', datePeremption: '2028-06-01', quantite: 20, createdAt: new Date().toISOString() });
  });
  await R.reprendre(tab, 'dimanche.json');
  const r = await tab.evaluate(async () => {
    const dans = async (cle, n) => ((await getParam(cle, [])) || []).includes(n);
    return { villageUtilise: await dans('lieux', 'Ban Samedi'), villageAncien: await dans('lieux', 'Ban Ancien'), villageNonUtilise: await dans('lieux', 'Ban Jamais Utilisé'), medecinUtilise: await dans('medecins', 'Dr. Samedi'), medecinRetire: await dans('medecins', 'Dr. Retiré'),
      hopital: await dans('hopitaux', 'Hôpital de Samedi'), fournisseur: (await getParam('fournisseurs', null)) === null || await dans('fournisseurs', 'Don local'),
      medicamentPharmacienne: await dans('molecules', 'NOUVEAU — 10 mg — cpr'), mission: (await getParam('missions', [])).map(m => m.numero).join(', '),
      dispensairesEnTete: (await getParam('lieux', [])).findIndex(l => !l.startsWith('Dispensaire')) > 0 };
  });
  console.log('Listes après reprise :', JSON.stringify(r));
  await b.close();
})().catch(e => { console.error('ECHEC', e); process.exit(1); });
