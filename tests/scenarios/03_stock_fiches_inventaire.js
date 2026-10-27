const _path = require('path');
const APP = process.env.APP || _path.resolve(__dirname, '..', '..', 'index.html');
const DEMO = process.env.DEMO || _path.resolve(__dirname, '..', '..', 'demo', 'demo_data.json');
const _cr = require('./_chromium');
const { JSDOM } = require('jsdom'); require('fake-indexeddb/auto'); const fs = require('fs');
let html = fs.readFileSync(APP, 'utf8').replace(/<link[^>]+fonts[^>]*>/g, '');
const errors = [];
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://exemple.test/',
  beforeParse(w) { w.indexedDB = indexedDB; w.IDBKeyRange = IDBKeyRange; w.scrollTo = () => {};
    w.confirm = () => true; w.__autoValider = true; w.prompt = () => ''; w.alert = () => {};
    w.addEventListener('error', e => errors.push(String(e.message))); w.console.error = (...a) => errors.push(a.join(' ')); } });
const w = dom.window, d = w.document, wait = ms => new Promise(r => setTimeout(r, ms));
const ev = (el, t) => el.dispatchEvent(new w.Event(t, { bubbles: true }));
(async () => {
  await wait(2500);
  if (d.getElementById('screen-mission').classList.contains('active')) { d.getElementById('m_numero').value = 'Mission T'; await w.eval('enregistrerMission()'); await wait(300); }
  console.log('Motifs :', [...d.getElementById('s_motif').options].map(o => o.text).join(' | '));
  // Fiche
  w.eval("goScreen('stock_config')"); await wait(600);
  const MOL = 'DESOGESTREL — 75 µg — plaquette cpr', MOL2 = 'AMLODIPINE — 5 mg — cpr', MOL3 = 'AC FOLIQUE — 5 mg — cpr';
  const row = m => [...d.querySelectorAll('#stockConfigBody tr')].find(t => t.getAttribute('data-mol') === m);
  let r = row(MOL); const sel = r.querySelector('[data-champ=unite]'); sel.value = 'plaquette'; ev(sel, 'change'); await wait(150);
  r = row(MOL2);
  for (const [c, v] of [['stockMinimal', '5000'], ['stockConfort', '8000'], ['prixFR', '0,05'], ['prixLAK', '1200']]) { const i = r.querySelector(`[data-champ=${c}]`); i.value = v; ev(i, 'change'); await wait(120); }
  r = row(MOL3); const cb = r.querySelector('[data-champ=suivi]'); cb.checked = false; ev(cb, 'change'); await wait(120);
  for (const [c, v] of [['stockMinimal', '5000'], ['stockConfort', '8000']]) { const i = r.querySelector(`[data-champ=${c}]`); i.value = v; ev(i, 'change'); await wait(120); }
  console.log('Fiche enregistrée :', JSON.stringify(await w.eval(`dbGet('stock_config', ${JSON.stringify(MOL2)})`)));
  // Commande
  w.eval("goScreen('commande')"); await wait(800);
  const txt = d.getElementById('commandeBody').textContent.replace(/\s+/g, ' ');
  console.log('Commande :', txt.slice(0, 200));
  console.log('Non suivi absent de la commande :', !txt.includes('AC FOLIQUE'));
  // Stock
  w.eval("goScreen('stock')"); await wait(1000);
  const stockTxt = d.getElementById('stockBody').textContent.replace(/\s+/g, ' ');
  console.log('Stock — plaquettes affiché :', /DESOGESTREL.*?plaq\./.test(stockTxt), '| non suivi :', /AC FOLIQUE — 5 mg — cpr non suivi/.test(stockTxt));
  console.log('Alertes accueil sans AC FOLIQUE commander :', !d.getElementById('alerteList').textContent.includes('AC FOLIQUE — 5 mg — cpr — commander'));
  // Prescription unité
  w.eval("goScreen('consultation')"); await wait(200);
  w.eval(`COMBOS.presc_mol_1.setValue(${JSON.stringify(MOL)})`); await wait(500);
  console.log('Placeholder qté :', d.getElementById('presc_qty_1').placeholder, '| option lot :', d.getElementById('presc_lot_1').options[1]?.text);
  w.eval('effacerConsultation()');
  // Inventaire
  w.eval("goScreen('inventaire')"); await wait(1200);
  const avant = (await w.eval('calculerStock()'))[MOL2];
  const lots = Object.values(avant);
  console.log('Lots amlodipine :', lots.map(l => l.lot + ' ' + l.restant).join(' | '));
  d.getElementById('invSearch').value = 'amlo'; w.eval('afficherInventaire()'); await wait(100);
  const inputs = [...d.querySelectorAll('#invBody input')].filter(i => i.getAttribute('data-mol') === MOL2);
  inputs[0].value = String(lots[0].restant - 40); ev(inputs[0], 'input');
  inputs[1].value = String(lots[1].restant + 15); ev(inputs[1], 'input');
  console.log('Résumé :', d.getElementById('invResume').textContent);
  w.eval(`COMBOS.inv_mol.setValue(${JSON.stringify(MOL2)})`); d.getElementById('inv_per').value = '2029-05-01'; d.getElementById('inv_qty').value = '30';
  w.eval('ajouterLotInventaire()'); await wait(100);
  await w.eval('validerInventaire()'); await wait(800);
  const apres = (await w.eval('calculerStock()'))[MOL2];
  console.log('Après inventaire :', Object.values(apres).map(l => l.lot + ' ' + l.restant).join(' | '));
  console.log('Historique :', d.getElementById('invHistorique').textContent.replace(/\s+/g, ' ').slice(0, 160));
  const sorties = (await w.eval("dbGetAll('sorties')")).filter(s => s.motif === 'Inventaire').length;
  console.log('Sorties « Inventaire » :', sorties, '| brouillon vidé :', !w.localStorage.getItem('brouillon_inventaire'));
  console.log('Erreurs JS :', errors.length ? errors.slice(0, 5) : 'aucune');
  process.exit(0);
})();
