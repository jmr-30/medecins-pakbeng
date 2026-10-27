const _path = require('path');
const APP = process.env.APP || _path.resolve(__dirname, '..', '..', 'index.html');
const DEMO = process.env.DEMO || _path.resolve(__dirname, '..', '..', 'demo', 'demo_data.json');
const _cr = require('./_chromium');
const { JSDOM } = require('jsdom'); require('fake-indexeddb/auto'); const fs = require('fs');
let html = fs.readFileSync(APP, 'utf8').replace(/<link[^>]+fonts[^>]*>/g, '');
const errors = []; let confirms = [];
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://exemple.test/',
  beforeParse(w) { w.indexedDB = indexedDB; w.IDBKeyRange = IDBKeyRange; w.scrollTo = () => {};
    w.confirm = m => { confirms.push(m.split('\n')[0]); return true; }; w.prompt = () => ''; w.alert = () => {};
    w.addEventListener('error', e => errors.push(String(e.message))); w.console.error = (...a) => errors.push(a.join(' ')); } });
const w = dom.window, d = w.document, wait = ms => new Promise(r => setTimeout(r, ms));
async function consult(nom, prenom, age, genre, date, mol, qty) {
  w.eval("goScreen('consultation')"); await wait(150);
  d.getElementById('c_date').value = date;
  w.eval("COMBOS.c_lieu.setValue('Dispensaire Pakbeng'); COMBOS.c_med1.setValue('Dr. Martin')");
  d.getElementById('c_nom').value = nom; d.getElementById('c_prenom').value = prenom;
  d.getElementById('c_age').value = age; d.getElementById('c_genre').value = genre;
  if (mol) { w.eval(`COMBOS.presc_mol_1.setValue(${JSON.stringify(mol)})`); await wait(400); d.getElementById('presc_qty_1').value = qty; }
  await w.eval('enregistrerConsultation()'); await wait(500);
}
(async () => {
  await wait(2500);
  console.log('Titre :', d.title);
  if (d.getElementById('screen-mission').classList.contains('active')) { d.getElementById('m_numero').value = 'Mission 10'; await w.eval('enregistrerMission()'); await wait(300); }
  const MOL = 'AMLODIPINE — 5 mg — cpr';
  await consult('Souk', 'Kham', '34', 'Masculin', '2025-07-01', MOL, 10);
  await consult('SOUK', 'Khàm', '35', 'Masculin', '2026-07-01', MOL, 5);
  await consult('SOUK', 'Kham', '60', 'Masculin', '2026-07-02');
  const cs = await w.eval("dbGetAll('consultations')");
  console.log('IDs :', cs.map(c => c.patientId).join(' | '));
  console.log('Même patient 1 et 2 :', cs[0].patientId === cs[1].patientId, '| homonyme différent :', cs[2].patientId !== cs[0].patientId);
  // Badge patient connu
  w.eval("goScreen('consultation')"); await wait(100);
  d.getElementById('c_nom').value = 'souk'; d.getElementById('c_prenom').value = 'kham'; d.getElementById('c_age').value = '35'; d.getElementById('c_date').value = '2026-08-01';
  w.eval('majPatientIdBadge()'); await wait(600);
  console.log('Badge :', d.getElementById('patientIdText').textContent);
  w.eval("effacerConsultation()");
  // Seuil puis renommage molécule
  await w.eval(`dbPut('stock_config', { molecule: ${JSON.stringify(MOL)}, stockMinimal: 100, stockConfort: 500 })`);
  w.eval("goScreen('parametres')"); await wait(500);
  const mols = await w.eval("getParam('molecules', REF.molecules)");
  const idx = mols.indexOf(MOL);
  d.getElementById('molecules_item_' + idx).value = 'AMLODIPINE — 5 mg — comprimé';
  confirms = [];
  await w.eval("sauvegarderListe('molecules','param-molecules',null)"); await wait(800);
  const NEW = 'AMLODIPINE — 5 mg — comprimé';
  const recs = (await w.eval("dbGetAll('receptions')")).filter(r => r.molecule === NEW).length;
  const cs2 = await w.eval("dbGetAll('consultations')");
  console.log('Renommage molécule — confirmé :', confirms.length, '| réceptions renommées :', recs,
    '| prescriptions :', cs2.filter(c => (c.prescription || []).some(p => p.molecule === NEW)).length,
    '| seuil déplacé :', JSON.stringify(await w.eval(`dbGet('stock_config', ${JSON.stringify(NEW)})`)), '| ancien seuil :', await w.eval(`dbGet('stock_config', ${JSON.stringify(MOL)})`));
  const stock = await w.eval('calculerStock()');
  console.log('Stock nouvelle molécule :', Object.values(stock[NEW] || {}).map(l => l.lot + ' ' + l.restant).join(' | '), '| ancienne présente :', !!stock[MOL]);
  // Renommage médecin
  const meds = await w.eval("getParam('medecins', REF.medecins)");
  w.eval("chargerParametres()"); await wait(400);
  d.getElementById('medecins_item_' + meds.indexOf('Dr. Martin')).value = 'Dr. Jacques Martin';
  await w.eval("sauvegarderListe('medecins','param-medecins',null)"); await wait(500);
  console.log('Médecin renommé dans consultations :', (await w.eval("dbGetAll('consultations')")).every(c => c.medecin1 === 'Dr. Jacques Martin'));
  // Restauration JSON avec une autre mission
  const blob = await w.eval('genererBlobJSON()'); const txt = await blob.text(); const data = JSON.parse(txt);
  data.mission = { numero: 'Mission 9', debut: '2026-07-20', fin: '2026-08-03', medecins: '' };
  data.parametres = [{ cle: 'lieux', valeur: ['Dispensaire Pakbeng', 'Village Test Import'] }];
  const file = new w.File([JSON.stringify(data)], 'test.json', { type: 'application/json' });
  confirms = [];
  await w.importerJSON({ files: [file], value: '' }); await wait(800);
  console.log('Restauration — questions :', confirms.length, confirms.map(c => c.slice(0, 40)));
  console.log('Mission active après "OK" :', w.getMissionActive().numero);
  const lieux = await w.eval("getParam('lieux', REF.lieux)");
  console.log('Lieux fusionnés :', lieux.length, lieux.includes('Village Test Import'), lieux.includes('Kham'));
  console.log('Erreurs JS :', errors.length ? errors.slice(0, 5) : 'aucune');
  process.exit(0);
})();
