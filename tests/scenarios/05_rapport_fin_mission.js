const _path = require('path');
const APP = process.env.APP || _path.resolve(__dirname, '..', '..', 'index.html');
const DEMO = process.env.DEMO || _path.resolve(__dirname, '..', '..', 'demo', 'demo_data.json');
const _cr = require('./_chromium');
const { JSDOM } = require('jsdom'); require('fake-indexeddb/auto'); const fs = require('fs'); const XLSX = require('xlsx');
let html = fs.readFileSync(APP, 'utf8').replace(/<link[^>]+fonts[^>]*>/g, '');
const errors = []; let ecrit = null;
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://exemple.test/',
  beforeParse(w) { w.indexedDB = indexedDB; w.IDBKeyRange = IDBKeyRange; w.scrollTo = () => {};
    w.confirm = () => true; w.__autoValider = true; w.prompt = () => ''; w.alert = () => {};
    w.XLSX = { ...XLSX, writeFile: (wb, nom) => { ecrit = { wb, nom }; } };
    w.addEventListener('error', e => errors.push(String(e.message))); w.console.error = (...a) => errors.push(a.join(' ')); } });
const w = dom.window, d = w.document, wait = ms => new Promise(r => setTimeout(r, ms));
async function consult(date, lieu, mol, qty) {
  w.eval("goScreen('consultation')"); await wait(150);
  d.getElementById('c_date').value = date;
  w.eval(`COMBOS.c_lieu.setValue(${JSON.stringify(lieu)}); COMBOS.c_med1.setValue('Dr. Martin')`);
  d.getElementById('c_nom').value = 'P' + Math.random().toString(36).slice(2, 6); d.getElementById('c_age').value = '30'; d.getElementById('c_genre').value = 'Féminin';
  w.eval(`COMBOS.presc_mol_1.setValue(${JSON.stringify(mol)})`); await wait(400); d.getElementById('presc_qty_1').value = qty;
  await w.eval('enregistrerConsultation()'); await wait(400);
}
(async () => {
  await wait(2500);
  d.getElementById('m_numero').value = 'Mission 10'; d.getElementById('m_debut').value = '2026-10-15'; d.getElementById('m_fin').value = '2026-10-29';
  await w.eval('enregistrerMission()'); await wait(300);
  const MOL = 'AMLODIPINE — 5 mg — cpr';
  await w.eval(`dbPut('stock_config', { molecule: ${JSON.stringify(MOL)}, stockMinimal: 5000, stockConfort: 8000, prixFR: 0.05, prixLAK: 1200 })`);
  await consult('2026-10-16', 'Dispensaire Pakbeng', MOL, 100);
  await consult('2026-10-17', 'Kham', MOL, 40);
  await w.eval(`dbAdd('sorties', { date: '2026-10-18', motif: 'Casse', molecule: ${JSON.stringify(MOL)}, lot: 'Exp. 02/2028', datePeremption: '2028-02-01', quantite: 10, createdAt: new Date().toISOString() })`);
  // inventaire consommables
  w.eval("goScreen('consommables')"); await wait(500);
  const i0 = d.querySelector('#consoBody input'); i0.value = '5'; i0.dispatchEvent(new w.Event('input', { bubbles: true }));
  await w.eval('validerInventaireConso()'); await wait(400);
  // Historique → rapport
  w.eval("goScreen('historique')"); await wait(600);
  w.eval("afficherDetailMission('Mission 10')"); await wait(300);
  await w.eval('exporterMission()'); await wait(1000);
  if (!ecrit) { console.log('Pas de fichier', errors); process.exit(1); }
  console.log('Fichier :', ecrit.nom, '| onglets :', ecrit.wb.SheetNames.join(', '));
  const sh = n => XLSX.utils.sheet_to_json(ecrit.wb.Sheets[n], { header: 1 });
  console.log('Synthèse :'); sh('Synthèse').slice(0, 32).forEach(r => r.length && console.log('   ', r.join(' : ')));
  const st = XLSX.utils.sheet_to_json(ecrit.wb.Sheets['Stock mission']).filter(r => r['Molécule'] === MOL);
  st.forEach(r => console.log('Lot', r['Lot'], '| début', r['Stock début de mission'], '| disp', r['Délivrées au dispensaire'], '| vill', r['Délivrées dans les villages'], '| détr', r['Détruites / sorties'], '| fin', r['Stock fin de mission'], '| €', r['Valeur stock fin (€)']));
  const co = XLSX.utils.sheet_to_json(ecrit.wb.Sheets['Consommation']).find(r => r['Molécule'] === MOL);
  console.log('Consommation :', JSON.stringify(co));
  console.log('Commande :', JSON.stringify(XLSX.utils.sheet_to_json(ecrit.wb.Sheets['Commande'])[0]));
  console.log('Consommables :', JSON.stringify(XLSX.utils.sheet_to_json(ecrit.wb.Sheets['Consommables'])[0]));
  const moteur = (await w.eval('calculerStock()'))[MOL];
  console.log('Moteur (contrôle) :', Object.values(moteur).map(l => l.lot + ' ' + l.restant).join(' | '));
  const perimes = XLSX.utils.sheet_to_json(ecrit.wb.Sheets['Stock mission']).filter(r => r['À détruire']).length;
  console.log('Lots à détruire :', perimes, '| missions mémorisées :', JSON.stringify((await w.eval("getParam('missions', [])")).map(m => m.numero)));
  console.log('Erreurs JS :', errors.length ? errors.slice(0, 5) : 'aucune');
  process.exit(0);
})();
