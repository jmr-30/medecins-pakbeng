// Suggestions de patients déjà vus pendant la saisie du nom (tolérance aux transcriptions lao)
const _path = require('path');
const APP = process.env.APP || _path.resolve(__dirname, '..', '..', 'index.html');
const DEMO = process.env.DEMO || _path.resolve(__dirname, '..', '..', 'demo', 'demo_data.json');
const _cr = require('./_chromium');
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(_cr({}));
  const p = await (await b.newContext({ locale: 'fr-FR', viewport: { width: 800, height: 1200 }, hasTouch: true })).newPage();
  await _cr.role(p); p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('file://' + APP); await p.waitForTimeout(2500);
  await p.evaluate(() => { window.__autoValider = true; });
  await (await p.$('#importJSONFile')).setInputFiles(DEMO); await p.waitForTimeout(3000);
  await p.evaluate(() => { window.__autoValider = false; goScreen('consultation'); });
  await p.waitForTimeout(400);
  const liste = () => p.$$eval('#suggPatients .sugg-nom', l => l.map(x => x.textContent.trim()));
  // 1 lettre : rien
  await p.click('#c_nom'); await p.keyboard.type('K'); await p.waitForTimeout(400);
  console.log('1 lettre :', await p.isVisible('#suggPatients'));
  // Orthographe différente : « Kampou » pour KHAMPHOUI
  await p.keyboard.type('ampou'); await p.waitForTimeout(400);
  console.log('« Kampou » →', JSON.stringify(await liste()));
  // Prénom tapé dans le champ nom (usage lao)
  await p.fill('#c_nom', ''); await p.type('#c_nom', 'Noy'); await p.waitForTimeout(400);
  console.log('« Noy » (prénom) →', JSON.stringify(await liste()));
  // Choix d'un patient
  await p.fill('#c_nom', ''); await p.type('#c_nom', 'Kampou'); await p.waitForTimeout(400);
  const detail = await p.textContent('#suggPatients .sugg-detail');
  await p.tap('#suggPatients .sugg-ligne'); await p.waitForTimeout(900);
  const f = await p.evaluate(() => ({ nom: c_nom.value, prenom: c_prenom.value, genre: c_genre.value, age: c_age.value, village: COMBOS.c_habitation.getValue(),
    liste: getComputedStyle(suggPatients).display, bandeau: patientChoisiInfo.textContent.replace(/\s+/g, ' ').trim(), badge: patientIdText.textContent }));
  console.log('Détail ligne :', detail.trim());
  console.log('Après choix :', JSON.stringify(f));
  console.log('Même identifiant :', await p.evaluate(async () => { const r = await determinerIdPatient(); const c = (await dbGetAll('consultations')).find(x => x.nom === 'KHAMPHOUI'); return r.connu && r.id === c.patientId; }));
  // La liste ne revient pas tant que le nom n'est pas modifié
  await p.focus('#c_prenom'); await p.waitForTimeout(300);
  console.log('Liste fermée après choix :', !(await p.isVisible('#suggPatients')));
  // « Ce n'est pas ce patient »
  await p.tap('#patientChoisiInfo button'); await p.waitForTimeout(600);
  console.log('Annulation :', JSON.stringify(await p.evaluate(() => ({ nom: c_nom.value, prenom: c_prenom.value, age: c_age.value, village: COMBOS.c_habitation.getValue(), bandeau: patientChoisiInfo.style.display, focus: document.activeElement.id }))));
  // Nouveau patient : « continuer la saisie »
  await p.type('#c_nom', 'Kh'); await p.waitForTimeout(400);
  const n = (await liste()).length; await p.tap('.sugg-nouveau'); await p.waitForTimeout(300);
  console.log('« Kh » :', n, 'propositions | après « Aucun de ces patients » :', await p.isVisible('#suggPatients'), '| saisie gardée :', await p.inputValue('#c_nom'));
  // Recherche tolérante
  await p.evaluate(() => goScreen('recherche')); await p.waitForTimeout(300);
  await p.fill('#rch_nom', 'kampoui'); await p.evaluate(() => lancerRecherche()); await p.waitForTimeout(600);
  console.log('Recherche « kampoui » :', await p.evaluate(() => document.body.innerText.includes('KHAMPHOUI')));
  await b.close();
})();
