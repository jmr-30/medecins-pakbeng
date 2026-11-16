// Modifier une consultation : une ligne de prescription inchangée garde les lots réellement délivrés ; une ligne modifiée est resservie en FEFO
const { chromium } = require('playwright');
const R = require('./_relais');
const MOL = 'PARACETAMOL — TEST — cpr';
(async () => {
  const b = await chromium.launch(R.cr({}));
  const p = await R.appareil(b, 'tablette');
  await p.evaluate(async MOL => {
    localStorage.setItem('mission_active', JSON.stringify({ numero: 'Mission 9', debut: '2020-01-01', fin: '2099-01-01' }));
    await setParam('molecules', [...await getParam('molecules', REF.molecules), MOL]); await rechargerCombosMolecules();
    await dbAdd('receptions', { date: '2026-01-01', fournisseur: 'Test', molecule: MOL, lot: 'Exp. 10/2026', datePeremption: '2026-10-01', quantite: 50, createdAt: 'r1' });   // périmé depuis
    await dbAdd('receptions', { date: '2026-01-01', fournisseur: 'Test', molecule: MOL, lot: 'Exp. 06/2028', datePeremption: '2028-06-01', quantite: 50, createdAt: 'r2' });
    await dbAdd('consultations', { date: '2026-09-15', nom: 'ANCIEN', lieu: REF.lieux[0], medecin1: 'Dr', prescription: [{ molecule: MOL, quantite: 20, lot: 'Exp. 10/2026 (20)', lotForce: '', aRegulariser: 0, lots: [{ lot: 'Exp. 10/2026', datePeremption: '2026-10-01', quantite: 20 }] }], createdAt: 'c1' });
  }, MOL);
  const modifier = (nom, f) => p.evaluate(async ([nom, f]) => {
    const attendre = ms => new Promise(r => setTimeout(r, ms));
    const c = (await dbGetAll('consultations')).find(x => x.nom.startsWith('ANCIEN'));
    await modifierConsultation(c.id, 'recherche'); await attendre(900);
    document.getElementById('c_nom').value = nom;
    if (f === 'quantite') document.getElementById('presc_qty_1').value = '30';
    await attendre(500);
    const apercu = document.getElementById('presc_apercu_1').textContent.trim();
    await enregistrerConsultation(); await attendre(900);
    return { apercu, lots: (await dbGetAll('consultations')).find(x => x.nom === nom).prescription[0].lots.map(l => `${l.lot} : ${l.quantite}`).join(' + ') };
  }, [nom, f]);
  console.log('Avant :', await R.stock(p, MOL));
  let r = await modifier('ANCIEN CORRIGE', '');
  console.log('Nom corrigé — lots de la consultation :', r.lots, '| stock :', await R.stock(p, MOL));
  r = await modifier('ANCIEN CORRIGE 2', 'quantite');
  console.log('Quantité portée à 30 — lots de la consultation :', r.lots, '| stock :', await R.stock(p, MOL));
  r = await modifier('ANCIEN CORRIGE 3', '');
  console.log('Nom corrigé de nouveau — lots de la consultation :', r.lots, '| stock :', await R.stock(p, MOL));
  await b.close();
})().catch(e => { console.error('ECHEC', e); process.exit(1); });
