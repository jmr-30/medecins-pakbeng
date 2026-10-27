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
  const consult = async (date, nom, prenom, age, genre, hab, patho, mols, extra) => {
    set('c_date', date); w.eval("COMBOS.c_lieu.setValue('Dispensaire Pakbeng'); COMBOS.c_med1.setValue('Dr. Martin')");
    set('c_nom', nom); set('c_prenom', prenom); set('c_age', age); d.getElementById('c_genre').value = genre; ev(d.getElementById('c_genre'), 'change');
    if (hab) w.eval(`COMBOS.c_habitation.setValue(${JSON.stringify(hab)})`);
    if (patho) { w.eval(`COMBOS.spec_1.setValue(${JSON.stringify(patho[0])}); majPathologies(1, ${JSON.stringify(patho[0])})`); await wait(80); w.eval(`COMBOS.patho_1.setValue(${JSON.stringify(patho[1])})`); }
    mols.forEach((m, k) => { w.eval(`COMBOS.presc_mol_${k+1}.setValue(${JSON.stringify(m)})`); set('presc_qty_' + (k+1), '10'); });
    await wait(300);
    if (extra) await extra();
    await w.eval('confirmerAvantEnregistrement()'); await wait(400);
    const conf = d.getElementById('confirmResume').textContent.replace(/\s+/g, ' ');
    await w.eval('enregistrerConsultation()'); await wait(600);
    return conf;
  };
  const spec = w.eval("Object.keys(REF.specialites)[0]"), pat = w.eval("REF.specialites[Object.keys(REF.specialites)[0]][0]");
  const mols = w.eval("REF.molecules.slice(0,12)");
  const ibu = w.eval("REF.molecules.find(m=>/ibupro/i.test(m))"), doxy = w.eval("REF.molecules.find(m=>/doxycy/i.test(m))"), para = w.eval("REF.molecules.find(m=>/parac/i.test(m))");
  console.log('Spé/patho :', spec, '/', pat, '| ibu:', ibu, '| doxy:', doxy);
  // Historique pour les suggestions : 3 consultations avec la même pathologie
  for (const [n, ms] of [['AA', [mols[5], mols[7]]], ['BB', [mols[5]]], ['CC', [mols[5], mols[9]]]])
    await consult('2026-05-0' + n.length, n, 'x', '30', 'Masculin', 'Ban Kham', [spec, pat], ms);
  // n°5 et n°6 : à revoir + orientation
  const conf1 = await consult(dateIso(-40), 'SOUK', 'Kham', '50', 'Masculin', 'Ban Kham', null, [para], async () => {
    d.getElementById('c_arevoir').checked = true; ev(d.getElementById('c_arevoir'), 'change');
    d.getElementById('c_arevoir_delai').value = '1 mois'; ev(d.getElementById('c_arevoir_delai'), 'change'); set('c_arevoir_motif', 'contrôle tension');
    console.log('Échéance affichée :', d.getElementById('arevoirEcheance').textContent);
    d.getElementById('c_orient').checked = true; ev(d.getElementById('c_orient'), 'change');
    set('c_orient_hop', 'Hôpital de Muang Houn'); set('c_orient_motif', 'suspicion appendicite'); d.getElementById('c_orient_accord').value = 'Oui';
  });
  console.log('Confirmation suivi :', (conf1.match(/Suivi.*?(?=Notes|$)/) || [''])[0].slice(0, 200));
  await consult(dateIso(-3), 'VONG', 'Naly', '25', 'Féminin', 'Ban Done', null, [], async () => {
    d.getElementById('c_arevoir').checked = true; ev(d.getElementById('c_arevoir'), 'change');
    d.getElementById('c_arevoir_delai').value = 'Prochaine mission'; ev(d.getElementById('c_arevoir_delai'), 'change');
  });
  // n°7 : grossesse
  set('c_nom', 'PHET'); set('c_prenom', 'Mai'); set('c_age', '28'); d.getElementById('c_genre').value = 'Féminin'; ev(d.getElementById('c_genre'), 'change'); await wait(50);
  console.log('Ligne grossesse visible (F 28 ans) :', d.getElementById('grossesseRow').style.display === '');
  d.getElementById('c_grossesse').value = 'Enceinte'; ev(d.getElementById('c_grossesse'), 'change'); set('c_grossesse_sa', '26');
  console.log('Bandeau :', d.getElementById('alerteGrossesseBandeau').textContent);
  w.eval(`COMBOS.presc_mol_1.setValue(${JSON.stringify(ibu)})`); w.eval(`COMBOS.presc_mol_2.setValue(${JSON.stringify(doxy)})`); set('presc_qty_1', '6'); set('presc_qty_2', '6'); await wait(800);
  console.log('Alerte ligne 1 :', d.getElementById('presc_apercu_1').textContent.slice(0, 110));
  console.log('Alerte ligne 2 :', d.getElementById('presc_apercu_2').textContent.slice(0, 90));
  await w.eval('confirmerAvantEnregistrement()'); await wait(400);
  console.log('Confirmation grossesse :', /Patiente enceinte — à vérifier/.test(d.getElementById('confirmResume').textContent));
  await w.eval('enregistrerConsultation()'); await wait(600);
  set('c_genre', ''); d.getElementById('c_genre').value = 'Masculin'; ev(d.getElementById('c_genre'), 'change');
  console.log('Masquée pour un homme :', d.getElementById('grossesseRow').style.display === 'none');
  w.eval('effacerConsultation()');
  // reprise grossesse (rappel)
  set('c_date', dateIso(0)); set('c_nom', 'Phet'); set('c_prenom', 'mai'); set('c_age', '28'); d.getElementById('c_genre').value = 'Féminin'; ev(d.getElementById('c_genre'), 'change'); await wait(1200);
  console.log('Rappel grossesse :', d.getElementById('grossesseInfo').textContent);
  w.eval('effacerConsultation()');
  // n°8 : suggestions
  w.eval(`COMBOS.spec_1.setValue(${JSON.stringify(spec)}); majPathologies(1, ${JSON.stringify(spec)})`); await wait(50); w.eval(`COMBOS.patho_1.setValue(${JSON.stringify(pat)})`);
  d.getElementById('presc_mol_1').dispatchEvent(new w.Event('focus')); await wait(50);
  const dd = d.querySelector('#presc_mol_1').parentNode.querySelector('.combo-dropdown');
  console.log('Suggestions :', dd.querySelector('.combo-groupe')?.textContent, '|', [...dd.querySelectorAll('.combo-option.prio')].map(o => o.textContent.slice(0, 25) + ' ×' + o.dataset.n).join(' ; '));
  w.eval('effacerConsultation()');
  // Liste à revoir
  w.eval("goScreen('accueil')"); await wait(400);
  console.log('Accueil :', d.getElementById('arevoirSub').textContent);
  w.eval("goScreen('arevoir')"); await wait(400);
  console.log('Villages :', [...d.getElementById('arv_village').options].map(o => o.textContent).join(' | '));
  console.log('Liste :', [...d.querySelectorAll('.arv-card')].map(c => c.textContent.replace(/\s+/g, ' ').trim().slice(0, 120)).join('\n   '));
  // Nouvelle consultation depuis la liste puis enregistrement → sort de la liste
  const id = (await w.eval("dbGetAll('consultations')")).find(c => c.nom === 'SOUK').id;
  await w.eval(`nouvelleConsultationPour(${JSON.stringify(id)})`); await wait(1200);
  console.log('Pré-rempli :', d.getElementById('c_nom').value, d.getElementById('c_age').value, d.getElementById('patientIdText').textContent);
  set('c_date', dateIso(0)); w.eval("COMBOS.c_lieu.setValue('Dispensaire Pakbeng'); COMBOS.c_med1.setValue('Dr. Martin')");
  await w.eval('enregistrerConsultation()'); await wait(600);
  w.eval("goScreen('arevoir')"); await wait(400);
  console.log('Après revisite, reste :', d.querySelectorAll('.arv-card').length, '| hôpital mémorisé :', JSON.stringify((await w.eval("getParam('hopitaux')")).slice(-1)));
  // ═══ Fiche patient ═══
  w.eval("goScreen('recherche')"); await wait(200);
  set('rch_nom', 'souk'); await w.eval('lancerRecherche()'); await wait(200);
  const cards = d.querySelectorAll('#rechercheResults .result-card');
  console.log('Résultats SOUK :', cards.length, '|', d.querySelector('#rechercheResults').textContent.replace(/\s+/g,' ').trim().slice(0,300));
  cards[0].dispatchEvent(new w.MouseEvent('click', { bubbles: true })); await wait(600);
  console.log('Écran fiche active :', d.getElementById('screen-patient').classList.contains('active'));
  const z = d.getElementById('fichePatientZone');
  console.log('En-tête :', z.querySelector('.fp-entete').textContent.replace(/\s+/g, ' ').trim().slice(0, 260));
  console.log('Blocs :', [...z.querySelectorAll('.fp-titre')].map(t => t.textContent.trim()).join(' | '));
  console.log('Chronologie :', z.querySelectorAll('.fp-consult').length, 'consultations');
  set('rch_nom', ''); await w.eval('lancerRecherche()'); await wait(200); console.log('Tous :', d.querySelector('#rechercheResults div').textContent, '| cartes :', d.querySelectorAll('#rechercheResults .result-card').length);
  // Retour
  w.eval('retourDepuisFiche()'); await wait(100);
  console.log('Retour recherche :', d.getElementById('screen-recherche').classList.contains('active'));
  // Phet : constantes + grossesse
  set('rch_nom', 'phet'); await w.eval('lancerRecherche()'); await wait(200);
  d.querySelector('#rechercheResults .result-card').dispatchEvent(new w.MouseEvent('click', { bubbles: true })); await wait(600);
  console.log('Phet :', z.querySelector('.fp-entete').textContent.replace(/\s+/g, ' ').trim().slice(0, 200));
  // Modifier depuis la fiche → retour à la fiche
  const idSouk = (await w.eval("dbGetAll('consultations')")).filter(c => c.nom === 'SOUK').pop().id;
  ouvrir = await w.eval(`ouvrirFichePatient(${idSouk}, 'recherche')`); await wait(400);
  await w.eval(`modifierConsultation(${idSouk}, 'patient')`); await wait(1000);
  set('c_notes', 'Note ajoutée en modification');
  await w.eval('enregistrerConsultation()'); await wait(800);
  console.log('Après modif, écran fiche :', d.getElementById('screen-patient').classList.contains('active'), '| note visible :', z.textContent.includes('Note ajoutée en modification'));
  // Nouvelle consultation depuis la fiche
  await w.eval('nouvelleConsultationDepuisFiche()'); await wait(1200);
  console.log('Nouvelle consultation pré-remplie :', d.getElementById('c_nom').value, d.getElementById('patientIdText').textContent);
  w.eval('effacerConsultation()');
  for (const c of (await w.eval("dbGetAll('consultations')")).filter(c => c.nom === 'SOUK')) { c.constantes = c.date < '2026-10-01' ? { tas: 165, tad: 95, poids: 68.5 } : { tas: 142, tad: 88, poids: 66, pouls: 72 }; c.allergies = 'Pénicilline'; await w.eval('dbPut')('consultations', c); }
  await w.eval(`ouvrirFichePatient(${idSouk}, 'recherche')`); await wait(400);
  console.log('Tableau constantes :', z.querySelector('.fp-table')?.textContent.replace(/\s+/g, ' '));
  console.log('Alerte allergie :', z.querySelector('.fp-entete').textContent.includes('Allergies : Pénicilline'));
  console.log('Erreurs JS :', errors.length ? errors.slice(0, 5) : 'aucune'); process.exit(0);
})();
function dateIso(j) { const x = new Date(); x.setDate(x.getDate() + j); return x.toISOString().slice(0, 10); }
