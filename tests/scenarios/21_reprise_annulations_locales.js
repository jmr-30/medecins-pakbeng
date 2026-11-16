// Reprise : une saisie annulée sur la tablette après l'envoi du fichier ne doit pas revenir avec le fichier de la pharmacienne
const { chromium } = require('playwright');
const R = require('./_relais');
const MOL = 'PARACETAMOL — TEST — cpr';
(async () => {
  const b = await chromium.launch(R.cr({}));
  const tab = await R.appareil(b, 'tablette', true);
  await tab.evaluate(async MOL => {
    await dbAdd('receptions', { date: '2026-11-01', fournisseur: 'Test', molecule: MOL, lot: 'Exp. 06/2028', datePeremption: '2028-06-01', quantite: 100, createdAt: '2026-11-01T08:00:00.000Z' });
    await dbAdd('receptions', { date: '2026-11-01', fournisseur: 'Erreur', molecule: MOL, lot: 'Exp. 06/2028', datePeremption: '2028-06-01', quantite: 1000, createdAt: '2026-11-01T08:05:00.000Z' });
    await dbAdd('consultations', { date: '2026-11-02', nom: 'VENDREDI', prenom: 'Doublon', lieu: 'Dispensaire', prescription: [{ molecule: MOL, quantite: 10, lots: [{ lot: 'Exp. 06/2028', datePeremption: '2028-06-01', quantite: 10 }] }], createdAt: '2026-11-02T08:00:00.000Z' });
  }, MOL);
  await R.sauver(tab, 'vendredi.json');
  console.log('Vendredi :', await R.stock(tab, MOL));
  // Week-end : la pharmacienne reprend et ajoute une réception
  const ph = await R.appareil(b, 'pharmacie');
  await R.reprendre(ph, 'vendredi.json');
  await ph.evaluate(async MOL => { await dbAdd('receptions', { date: '2026-11-08', fournisseur: 'Pharmacie Lyon', molecule: MOL, lot: 'Exp. 01/2029', datePeremption: '2029-01-01', quantite: 50, createdAt: new Date().toISOString() }); }, MOL);
  await R.sauver(ph, 'dimanche.json');
  // Samedi, sur la tablette : la consultation en double et la réception erronée sont annulées
  await tab.evaluate(async () => {
    await annulerConsultation((await dbGetAll('consultations')).find(c => c.nom === 'VENDREDI').id, '');
    await annulerMouvement('receptions', (await dbGetAll('receptions')).find(r => r.fournisseur === 'Erreur').id);
  });
  console.log('Samedi après annulations :', await R.stock(tab, MOL));
  const q = await R.presenter(tab, 'dimanche.json');
  console.log('Message :', (q.msg.split('\n').find(l => /annulée\(s\) sur cet appareil/.test(l)) || 'absent').trim());
  await R.reprendre(tab, 'dimanche.json');
  console.log('Lundi après reprise :', await R.stock(tab, MOL));
  console.log('Revenues :', JSON.stringify(await tab.evaluate(async () => ({ consultation: (await dbGetAll('consultations')).some(c => c.nom === 'VENDREDI'), reception: (await dbGetAll('receptions')).some(r => r.fournisseur === 'Erreur'),
    lyon: (await dbGetAll('receptions')).some(r => r.fournisseur === 'Pharmacie Lyon'), journal: ((await dbGet('parametres', 'journal_corrections'))?.valeur || []).filter(j => j.action === 'annulation').length }))));
  // Une seconde reprise du même fichier ne les fait pas revenir non plus
  await R.reprendre(tab, 'dimanche.json');
  console.log('Après seconde reprise :', await R.stock(tab, MOL));
  await b.close();
})().catch(e => { console.error('ECHEC', e); process.exit(1); });
