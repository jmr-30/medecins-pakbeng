const _path = require('path');
const APP = process.env.APP || _path.resolve(__dirname, '..', '..', 'index.html');
const DEMO = process.env.DEMO || _path.resolve(__dirname, '..', '..', 'demo', 'demo_data.json');
const _cr = require('./_chromium');
const { JSDOM } = require('jsdom'); require('fake-indexeddb/auto'); const fs = require('fs');
let html = fs.readFileSync(APP, 'utf8').replace(/<link[^>]+fonts[^>]*>/g, '');
const errors = [];
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://exemple.test/',
  beforeParse(w) { w.indexedDB = indexedDB; w.IDBKeyRange = IDBKeyRange; w.scrollTo = () => {}; w.confirm = () => true; w.__autoValider = true; w.prompt = () => '';
    w.addEventListener('error', e => errors.push(String(e.message))); w.console.error = (...a) => errors.push(a.join(' ')); } });
const w = dom.window, d = w.document, wait = ms => new Promise(r => setTimeout(r, ms));
const ev = (el, t = 'input') => el.dispatchEvent(new w.Event(t, { bubbles: true }));
const set = (id, v) => { const el = d.getElementById(id); el.value = v; ev(el); };
(async () => {
  await wait(2500);
  if (d.getElementById('screen-mission').classList.contains('active')) { d.getElementById('m_numero').value = 'Mission T'; await w.eval('enregistrerMission()'); await wait(300); }
  // 1re consultation
  w.eval("goScreen('consultation')"); await wait(150);
  set('c_date', '2025-07-01'); w.eval("COMBOS.c_lieu.setValue('Dispensaire Pakbeng'); COMBOS.c_med1.setValue('Dr. Martin')");
  set('c_nom', 'SOUK'); set('c_prenom', 'Kham'); set('c_age', '50'); d.getElementById('c_genre').value = 'Masculin';
  set('c_allergies', 'Pénicilline'); set('c_antecedents', 'HTA depuis 2019'); set('c_traitements', 'amlodipine 5 mg 1/j');
  set('k_poids', '68,5'); set('k_taille', '170'); set('k_tas', '165'); set('k_tad', '95'); set('k_temp', '45');
  await wait(100);
  console.log('Contrôle constantes :', d.getElementById('constantesInfo').textContent.trim());
  set('k_temp', '37,2'); await wait(50);
  console.log('Bandeau allergie :', d.getElementById('alerteAllergieBandeau').textContent);
  w.eval("COMBOS.presc_mol_1.setValue('AMOXICILLINE — 500 mg — gélule')"); await wait(500); set('presc_qty_1', '20'); await wait(500);
  console.log('Aperçu ligne 1 :', d.getElementById('presc_apercu_1').textContent.trim().slice(0, 80));
  await w.eval('confirmerAvantEnregistrement()'); await wait(400);
  const conf = d.getElementById('confirmResume').textContent.replace(/\s+/g, ' ');
  console.log('Confirmation — allergie :', /Allergie signalée pour : AMOXICILLINE/.test(conf), '| constantes :', /68,5 kg · TA 165\/95/.test(conf), '| IMC :', d.getElementById('constantesInfo').textContent.trim());
  await w.eval('enregistrerConsultation()'); await wait(500);
  const c1 = (await w.eval("dbGetAll('consultations')"))[0];
  console.log('Enregistré :', JSON.stringify({ allergies: c1.allergies, antecedents: c1.antecedents, traitements: c1.traitements, constantes: c1.constantes }));
  console.log('Formulaire vidé :', d.getElementById('c_allergies').value === '' && d.getElementById('k_poids').value === '');
  // 2e consultation : patient reconnu
  set('c_date', '2026-07-01'); set('c_nom', 'Souk'); set('c_prenom', 'kham'); set('c_age', '51'); await wait(1000);
  console.log('Reprise fiche :', d.getElementById('c_allergies').value, '|', d.getElementById('c_antecedents').value, '|', d.getElementById('ficheRepriseInfo').textContent.trim());
  console.log('Historique :', d.getElementById('historiqueContenu').textContent.replace(/\s+/g, ' ').slice(0, 160));
  set('k_tas', '142'); set('k_tad', '88'); set('k_poids', '66');
  await w.eval('enregistrerConsultation()'); await wait(500);
  set('c_nom', 'SOUK'); set('c_prenom', 'Kham'); set('c_age', '52'); set('c_date', '2027-07-01'); await wait(1000);
  console.log('Évolution :', d.querySelector('#historiqueContenu .histo-card').textContent.replace(/\s+/g, ' ').trim());
  // changement de patient → fiche retirée
  set('c_nom', 'VONG'); set('c_prenom', 'Naly'); await wait(1000);
  console.log('Autre patient — fiche vidée :', d.getElementById('c_allergies').value === '');
  console.log('« aucune connue » ne déclenche rien :', w.eval("motsAllergies('aucune connue').length") === 0);
  console.log('Erreurs JS :', errors.length ? errors.slice(0, 5) : 'aucune'); process.exit(0);
})();
