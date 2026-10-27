const _path = require('path');
const APP = process.env.APP || _path.resolve(__dirname, '..', '..', 'index.html');
const DEMO = process.env.DEMO || _path.resolve(__dirname, '..', '..', 'demo', 'demo_data.json');
const _cr = require('./_chromium');
const { JSDOM } = require('jsdom');
require('fake-indexeddb/auto');
const fs = require('fs');
let html = fs.readFileSync(APP, 'utf8');
html = html.replace(/<link[^>]+fonts[^>]*>/g, '');
const errors = [];
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://exemple.test/',
  beforeParse(w) {
    w.indexedDB = indexedDB; w.IDBKeyRange = IDBKeyRange; w.scrollTo = () => {};
    w.confirm = () => true; w.__autoValider = true; w.prompt = () => ''; w.alert = () => {};
    w.addEventListener('error', e => errors.push(String(e.message)));
    w.console.error = (...a) => errors.push(a.join(' '));
  } });
const w = dom.window, d = w.document;
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await wait(2500);
  const ev = (el, t) => el.dispatchEvent(new w.Event(t, { bubbles: true }));
  // Mission
  if (d.getElementById('screen-mission').classList.contains('active')) {
    d.getElementById('m_numero').value = 'Mission T';
    await w.eval('enregistrerMission()'); await wait(300);
  }
  console.log('lieux (début) :', (await w.eval("getParam('lieux', REF.lieux)")).slice(0, 4).join(' | '), '…', (await w.eval("getParam('lieux', REF.lieux)")).length);
  w.eval("goScreen('consultation')"); await wait(200);
  w.eval("COMBOS.c_lieu.setValue('Dispensaire Pakbeng'); COMBOS.c_med1.setValue('Dr. Martin')");
  d.getElementById('c_nom').value = 'TEST <i>A&B</i>'; d.getElementById('c_age').value = '30';
  // village inconnu → bouton d'ajout
  const hab = d.getElementById('c_habitation'); hab.value = 'Ban Nouveau'; ev(hab, 'input'); await wait(500);
  console.log('Bouton ajout visible :', d.getElementById('habitationAjout').style.display, '|', d.getElementById('habitationAjout').textContent.trim());
  await w.eval('ajouterVillageDepuisConsultation()'); await wait(200);
  const lieux = await w.eval("getParam('lieux', REF.lieux)");
  console.log('Village ajouté :', lieux.includes('Ban Nouveau'), '| position triée :', lieux.indexOf('Ban Nouveau'), '| total', lieux.length);
  d.getElementById('c_examen').value = 'TA 12/8, auscultation normale';
  d.getElementById('c_notes').value = 'note';
  await w.eval('confirmerAvantEnregistrement()'); await wait(400);
  console.log('Confirmation :', d.getElementById('confirmResume').textContent.replace(/\s+/g, ' ').slice(0, 220));
  await w.eval('enregistrerConsultation()'); await wait(600);
  const cs = await w.eval("dbGetAll('consultations')");
  const c = cs[cs.length - 1];
  console.log('Enregistré :', JSON.stringify({ nom: c.nom, habitation: c.habitation, examen: c.examen }));
  console.log('Formulaire vidé :', JSON.stringify(d.getElementById('c_habitation').value), JSON.stringify(d.getElementById('c_examen').value));
  // Recherche par habitation
  w.eval("goScreen('recherche')"); await wait(300);
  w.eval("COMBOS.rch_habitation.setValue('Ban Nouveau')");
  await w.eval('lancerRecherche()'); await wait(300);
  console.log('Recherche :', d.getElementById('rechercheResults').textContent.replace(/\s+/g, ' ').slice(0, 160));
  // Modification
  await w.eval(`modifierConsultation(${c.id}, 'recherche')`); await wait(500);
  console.log('Modif pré-remplie :', d.getElementById('c_habitation').value, '|', d.getElementById('c_examen').value);
  d.getElementById('c_examen').value = 'TA 13/8';
  await w.eval('enregistrerConsultation()'); await wait(600);
  const c2 = (await w.eval("dbGetAll('consultations')")).find(x => x.id === c.id);
  const j = (await w.eval("getParam('journal_corrections', [])"))[0];
  console.log('Après modif :', c2.examen, '| journal :', j.champs.join(', '));
  // Renommage dans les Paramètres
  w.eval("goScreen('parametres')"); await wait(400);
  const idx = lieux.indexOf('Ban Nouveau');
  const inp = d.getElementById('lieux_item_' + idx);
  inp.value = 'Ban Nouveau Renommé';
  await w.eval("sauvegarderListe('lieux','param-lieux',null)"); await wait(500);
  const c3 = (await w.eval("dbGetAll('consultations')")).find(x => x.id === c.id);
  console.log('Renommage répercuté :', c3.habitation);
  console.log('Erreurs JS :', errors.length ? errors.slice(0, 5) : 'aucune');
  process.exit(0);
})();
