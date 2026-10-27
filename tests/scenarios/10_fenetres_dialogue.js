const _path = require('path');
const APP = process.env.APP || _path.resolve(__dirname, '..', '..', 'index.html');
const DEMO = process.env.DEMO || _path.resolve(__dirname, '..', '..', 'demo', 'demo_data.json');
const _cr = require('./_chromium');
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(_cr({ args: ['--lang=fr-FR'] }));
  const p = await (await b.newContext({ locale: 'fr-FR', viewport: { width: 800, height: 1100 }, deviceScaleFactor: 1, hasTouch: true })).newPage(); await _cr.role(p);
  let natif = 0; p.on('dialog', d => { natif++; d.accept(); }); p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('file://' + APP); await p.waitForTimeout(2500);
  await (await p.$('#importJSONFile')).setInputFiles(DEMO); await p.waitForTimeout(600);
  console.log('Dialogue import visible :', await p.isVisible('#dlg.ouvert'), '|', (await p.textContent('#dlgTitre')), '|', await p.textContent('#dlgOk'));
  await /* capture omise */
  await p.tap('#dlgOk'); await p.waitForTimeout(3000);
  if (await p.isVisible('#dlg.ouvert')) { console.log('2e dialogue :', await p.textContent('#dlgTitre')); await p.tap('#dlgOk'); await p.waitForTimeout(1500); }
  console.log('Consultations :', await p.evaluate(async () => (await dbGetAll('consultations')).length));
  // Annuler une consultation depuis la fiche patient
  const id = await p.evaluate(async () => (await dbGetAll('consultations')).find(c => c.nom === 'KHOUN').id);
  await p.evaluate(id => ouvrirFichePatient(id, 'recherche'), id); await p.waitForTimeout(500);
  await p.click('#fichePatientZone button:has-text("Annuler")'); await p.waitForTimeout(300);
  console.log('Dialogue annulation :', await p.textContent('#dlgTitre'), '|', (await p.textContent('#dlgMsg')).slice(0, 60));
  await /* capture omise */
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  console.log('Échap → fermé :', !(await p.isVisible('#dlg.ouvert')), '| toujours là :', await p.evaluate(async id => !!(await dbGet('consultations', id)), id));
  await p.click('#fichePatientZone button:has-text("Annuler")'); await p.waitForTimeout(300);
  await p.fill('#dlgChamp0', 'doublon de saisie'); await p.tap('#dlgOk'); await p.waitForTimeout(800);
  const j = await p.evaluate(async () => (await getParam('journal_corrections', []))[0]);
  console.log('Annulée :', await p.evaluate(async id => !(await dbGet('consultations', id)), id), '| motif journal :', j.motif);
  // Brouillon au rechargement
  await p.evaluate(() => { goScreen('consultation'); document.getElementById('c_nom').value = 'BROUILLON'; autosaverConsultation(); });
  await p.waitForTimeout(3500); await p.reload(); await p.waitForTimeout(2500);
  console.log('Dialogue brouillon :', await p.isVisible('#dlg.ouvert'), '|', await p.textContent('#dlgTitre'), '|', await p.textContent('#dlgAnnuler'));
  await p.tap('#dlgOk'); await p.waitForTimeout(500);
  console.log('Brouillon repris :', await p.inputValue('#c_nom'), '| boîtes natives :', natif);
  await b.close();
})();
