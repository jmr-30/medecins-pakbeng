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
  w.eval("goScreen('consultation')"); await wait(150);
  set('c_date', '2025-07-01'); w.eval("COMBOS.c_lieu.setValue('Dispensaire Pakbeng'); COMBOS.c_med1.setValue('Dr. Martin')");
  set('c_nom', 'SOUK'); set('c_prenom', 'Kham'); set('c_age', '50'); d.getElementById('c_genre').value = 'Masculin';
  w.eval("COMBOS.presc_mol_1.setValue('AMOXICILLINE — 500 mg — gélule')"); await wait(500);
  console.log('Ligne posologie visible :', d.getElementById('presc_poso_row_1').style.display === '', '| ligne 2 cachée :', d.getElementById('presc_poso_row_2').style.display === 'none');
  set('presc_pm_1', '1'); set('presc_ps_1', '1'); set('presc_pj_1', '10'); await wait(100);
  console.log('Qté auto 1-0-1 × 10 j :', d.getElementById('presc_qty_1').value, '|', d.getElementById('presc_pinfo_1').textContent);
  set('presc_pc_1', '½'); await wait(50);
  console.log('Avec ½ au coucher :', d.getElementById('presc_qty_1').value);
  set('presc_pc_1', ''); set('presc_pcons_1', 'au repas'); await wait(50);
  const sir = w.eval("(REF.molecules||[]).find(m=>/sirop|flacon/i.test(m))") || 'PARACETAMOL — 120 mg/5 ml — sirop';
  w.eval(`COMBOS.presc_mol_2.setValue(${JSON.stringify(sir)})`); await wait(500);
  set('presc_pm_2', '1'); set('presc_pj_2', '5'); await wait(50);
  console.log('Sirop non calculé :', JSON.stringify(d.getElementById('presc_qty_2').value), '|', d.getElementById('presc_pinfo_2').textContent);
  set('presc_qty_2', '1');
  // saisie manuelle prioritaire
  set('presc_qty_1', '25'); set('presc_pj_1', '12'); await wait(50);
  console.log('Qté manuelle conservée :', d.getElementById('presc_qty_1').value);
  set('presc_qty_1', '20'); set('presc_pj_1', '10');
  w.eval('afficherConsignePatient()');
  const cm = d.getElementById('consigneContenu').textContent.replace(/\s+/g, ' ');
  console.log('Consigne ouverte :', d.getElementById('consigneModal').style.display, '|', cm.slice(0, 170));
  await w.eval('enregistrerConsultation()'); await wait(500);
  const c1 = (await w.eval("dbGetAll('consultations')"))[0];
  console.log('Enregistré :', JSON.stringify(c1.prescription.map(p => ({ m: p.molecule.slice(0, 12), q: p.quantite, poso: p.posologie }))));
  console.log('Formulaire vidé :', d.getElementById('presc_pm_1').value === '' && d.getElementById('presc_poso_row_1').style.display === 'none');
  // patient reconnu → reprise
  set('c_date', '2026-01-10'); set('c_nom', 'Souk'); set('c_prenom', 'kham'); set('c_age', '50'); await wait(1200);
  const rp = d.getElementById('reprisePrescription');
  console.log('Bouton reprise :', rp.style.display, '|', rp.textContent.replace(/\s+/g, ' ').trim());
  console.log('Historique :', d.getElementById('historiqueContenu').textContent.replace(/\s+/g, ' ').match(/AMOX[^·]*/)?.[0]);
  w.eval('reprendrePrescription()'); await wait(700);
  console.log('Repris :', w.eval("COMBOS.presc_mol_1.getValue()"), d.getElementById('presc_qty_1').value, d.getElementById('presc_pm_1').value, d.getElementById('presc_ps_1').value, d.getElementById('presc_pj_1').value, d.getElementById('presc_pcons_1').value, '| L2', d.getElementById('presc_qty_2').value);
  // export / réimport
  const t = w.eval("lirePosoTexte('1-0-1-0 · 10 j · au repas')");
  console.log('Relecture texte :', JSON.stringify(t));
  set('c_nom', 'VONG'); set('c_prenom', 'Naly'); await wait(1200);
  console.log('Autre patient — bouton masqué :', rp.style.display);
  // modification
  w.eval('effacerConsultation && effacerConsultation()'); await wait(200);
  await w.eval(`modifierConsultation(${JSON.stringify(c1.id)})`); await wait(1200);
  console.log('Édition recharge posologie :', d.getElementById('presc_pm_1').value, d.getElementById('presc_pj_1').value, '| bouton reprise :', rp.style.display);
  w.eval('quitterEdition(); effacerConsultation()');
  // ═══ Montrer au patient ═══
  w.eval("goScreen('consultation')"); await wait(100);
  set('c_nom', 'KEO'); set('c_prenom', 'Lan'); set('c_age', '40'); w.eval("COMBOS.c_lieu.setValue('Dispensaire Pakbeng'); COMBOS.c_med1.setValue('Dr. Martin')");
  w.eval("COMBOS.presc_mol_1.setValue('AMOXICILLINE — 500 mg — gélule')"); await wait(400);
  set('presc_pm_1', '1'); set('presc_ps_1', '1'); set('presc_pj_1', '7'); set('presc_pcons_1', 'au repas');
  w.eval(`COMBOS.presc_mol_2.setValue(${JSON.stringify(sir)})`); await wait(400); set('presc_qty_2', '1'); set('presc_pm_2', '1'); set('presc_pj_2', '3');
  await w.eval('confirmerAvantEnregistrement()'); await wait(300);
  w.eval('afficherConsignePatient();montrerConsigne(0)');
  const sh = d.getElementById('consigneShow');
  console.log('Plein écran :', sh.style.display, '|', d.getElementById('showCompteur').textContent, '|', d.getElementById('showContenu').textContent.replace(/\s+/g, ' ').trim().slice(0, 160));
  console.log('Modale consigne cachée :', d.getElementById('consigneModal').style.display, '| précédent caché :', d.getElementById('showPrec').style.visibility);
  w.eval('montrerConsigne(_showIdx + 1)');
  console.log('Page 2 :', d.getElementById('showCompteur').textContent, d.getElementById('showContenu').textContent.replace(/\s+/g, ' ').trim().slice(0, 60), '| suivant caché :', d.getElementById('showSuiv').style.visibility);
  w.eval('fermerMontrerConsigne()');
  console.log('Fermé :', sh.style.display, '| confirmation toujours ouverte :', d.getElementById('confirmModal').style.display);
  await w.eval('enregistrerConsultation()'); await wait(600);
  console.log('Bandeau après enregistrement :', d.getElementById('derniereConsigneBar').style.display, d.getElementById('derniereConsigneNom').textContent, '| formulaire vidé :', d.getElementById('c_nom').value === '');
  w.eval('montrerDerniereConsigne()'); console.log('Montrer la dernière :', sh.style.display, d.getElementById('showCompteur').textContent); w.eval('fermerMontrerConsigne()');
  const idK = (await w.eval("dbGetAll('consultations')")).find(c => c.nom === 'KEO').id;
  await w.eval(`ouvrirFichePatient(${idK}, 'recherche')`); await wait(400);
  const b = [...d.querySelectorAll('#fichePatientZone button')].find(x => x.textContent.includes('Consigne'));
  console.log('Bouton fiche patient :', !!b);
  b.click(); await wait(300); console.log('Depuis la fiche :', sh.style.display, d.getElementById('showContenu').textContent.replace(/\s+/g, ' ').trim().slice(0, 50));
  console.log('Erreurs JS :', errors.length ? errors.slice(0, 5) : 'aucune'); process.exit(0);
})();
