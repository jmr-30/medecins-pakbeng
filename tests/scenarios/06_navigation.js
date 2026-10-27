const _path = require('path');
const APP = process.env.APP || _path.resolve(__dirname, '..', '..', 'index.html');
const DEMO = process.env.DEMO || _path.resolve(__dirname, '..', '..', 'demo', 'demo_data.json');
const _cr = require('./_chromium');
const { JSDOM } = require('jsdom'); require('fake-indexeddb/auto'); const fs = require('fs');
let html = fs.readFileSync(APP, 'utf8').replace(/<link[^>]+fonts[^>]*>/g, '');
const errors = [];
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://exemple.test/',
  beforeParse(w) { w.indexedDB = indexedDB; w.IDBKeyRange = IDBKeyRange; w.scrollTo = () => {}; w.confirm = () => true; w.__autoValider = true;
    w.addEventListener('error', e => errors.push(String(e.message))); } });
const w = dom.window, d = w.document, wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await wait(2500);
  const etat = () => ['btnPlus', 'btnBack'].map(i => d.getElementById(i).classList.contains('visible') ? 'oui' : 'non').join(' / ');
  console.log('Démarrage (écran mission forcé) :', etat());
  for (const s of ['accueil', 'plus', 'historique', 'reception', 'consultation', 'recherche', 'consommables']) { w.eval(`goScreen('${s}')`); await wait(150); console.log(s.padEnd(13), '→ Autres fonctions / Accueil :', etat()); }
  d.getElementById('btnPlus').click(); await wait(150);
  console.log('Clic « Autres fonctions » →', d.querySelector('.screen.active').id);
  console.log('Erreurs :', errors.length ? errors : 'aucune'); process.exit(0);
})();
