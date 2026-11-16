// Un double appui sur « Enregistrer » (réception, sortie, consultation) n'écrit qu'une fois
const { chromium } = require('playwright');
const R = require('./_relais');
(async () => {
  const b = await chromium.launch(R.cr({}));
  const p = await R.appareil(b, 'tablette');
  await p.evaluate(() => localStorage.setItem('mission_active', JSON.stringify({ numero: 'Mission 9', debut: '2020-01-01', fin: '2099-01-01' })));
  const nb = store => p.evaluate(async s => (await dbGetAll(s)).length, store);
  const MOL = await p.evaluate(async () => Object.entries(await calculerStock()).find(([m, l]) => stockDisponible(l) > 50)[0]);
  const stock = () => p.evaluate(async m => stockDisponible((await calculerStock())[m]), MOL);
  const s0 = await stock();

  // Réception
  const remplirReception = () => p.evaluate(async MOL => { goScreen('reception'); document.getElementById('r_date').value = dateAujourdhui(); document.getElementById('r_fourn').selectedIndex = 1;
    COMBOS.r_mol.setValue(MOL); document.getElementById('r_perdate').value = '2031-06-01'; document.getElementById('r_qty').value = '100'; }, MOL);
  await remplirReception(); await p.waitForTimeout(300);
  let n = await nb('receptions');
  await p.dblclick('#screen-reception button:has-text("Enregistrer")'); await p.waitForTimeout(1200);
  console.log('Réception, double clic :', (await nb('receptions')) - n, 'enregistrée |', (await p.textContent('#toast')).trim(), '| stock +', (await stock()) - s0);
  await remplirReception(); n = await nb('receptions');
  await p.evaluate(() => { enregistrerReception(); enregistrerReception(); enregistrerReception(); }); await p.waitForTimeout(1200);
  console.log('Réception, trois appels simultanés :', (await nb('receptions')) - n, 'enregistrée');
  // Deux réceptions différentes saisies l'une après l'autre restent possibles
  await p.waitForTimeout(1600); await remplirReception(); n = await nb('receptions');
  await p.click('#screen-reception button:has-text("Enregistrer")'); await p.waitForTimeout(700);
  console.log('Réception suivante, saisie ensuite :', (await nb('receptions')) - n, 'enregistrée');

  // Sortie
  await p.evaluate(MOL => { goScreen('sortie'); COMBOS.s_mol.setValue(MOL); }, MOL); await p.waitForTimeout(600);
  await p.evaluate(() => { document.getElementById('s_motif').value = 'Casse'; const s = document.getElementById('s_lotsel'); s.selectedIndex = s.options.length - 1; document.getElementById('s_qty').value = '5'; });
  n = await nb('sorties'); const s1 = await stock();
  await p.dblclick('#screen-sortie button:has-text("Enregistrer")'); await p.waitForTimeout(1200);
  console.log('Sortie, double clic :', (await nb('sorties')) - n, 'enregistrée |', (await p.textContent('#toast')).trim(), '| stock', (await stock()) - s1);

  // Consultation
  const remplirConsultation = nom => p.evaluate(async ([nom, MOL]) => { goScreen('consultation'); effacerConsultation(); document.getElementById('c_date').value = dateAujourdhui(); document.getElementById('c_nom').value = nom;
    COMBOS.c_lieu.setValue(REF.lieux[0]); COMBOS.c_med1.setValue((await getParam('medecins', REF.medecins))[0]); COMBOS.presc_mol_1.setValue(MOL); document.getElementById('presc_qty_1').value = '6'; }, [nom, MOL]);
  await remplirConsultation('DOUBLE'); await p.waitForTimeout(700);
  const s2 = await stock();
  await p.evaluate(() => { enregistrerConsultation(); enregistrerConsultation(); }); await p.waitForTimeout(1200);
  console.log('Consultation, deux appels simultanés :', await p.evaluate(async () => (await dbGetAll('consultations')).filter(c => c.nom === 'DOUBLE').length), 'enregistrée | stock', (await stock()) - s2);
  await p.waitForTimeout(1600); await remplirConsultation('DOUBLE2'); await p.waitForTimeout(700);
  await p.evaluate(() => confirmerAvantEnregistrement()); await p.waitForTimeout(600);
  await p.dblclick('#confirmModal button:has-text("Confirmer")').catch(() => {}); await p.waitForTimeout(1200);
  console.log('Consultation, double clic sur « Confirmer » :', await p.evaluate(async () => (await dbGetAll('consultations')).filter(c => c.nom === 'DOUBLE2').length), 'enregistrée');
  await b.close();
})().catch(e => { console.error('ECHEC', e); process.exit(1); });
