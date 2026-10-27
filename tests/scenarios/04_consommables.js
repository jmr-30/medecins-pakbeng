const _path = require('path');
const APP = process.env.APP || _path.resolve(__dirname, '..', '..', 'index.html');
const DEMO = process.env.DEMO || _path.resolve(__dirname, '..', '..', 'demo', 'demo_data.json');
const _cr = require('./_chromium');
const { JSDOM } = require('jsdom'); require('fake-indexeddb/auto'); const fs = require('fs');
let html = fs.readFileSync(APP, 'utf8').replace(/<link[^>]+fonts[^>]*>/g, '');
const errors = []; let prompts = ['Abaisse-langue bois', 'boîte de 100', 'Consommable médical'];
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://exemple.test/',
  beforeParse(w) { w.indexedDB = indexedDB; w.IDBKeyRange = IDBKeyRange; w.scrollTo = () => {};
    w.confirm = () => true; w.__autoValider = true; w.prompt = () => prompts.shift() ?? ''; w.alert = () => {};
    w.addEventListener('error', e => errors.push(String(e.message))); w.console.error = (...a) => errors.push(a.join(' ')); } });
const w = dom.window, d = w.document, wait = ms => new Promise(r => setTimeout(r, ms));
const ev = (el, t) => el.dispatchEvent(new w.Event(t, { bubbles: true }));
(async () => {
  await wait(2500);
  if (d.getElementById('screen-mission').classList.contains('active')) { d.getElementById('m_numero').value = 'Mission T'; await w.eval('enregistrerMission()'); await wait(300); }
  w.eval("goScreen('consommables')"); await wait(600);
  console.log('Résumé :', d.getElementById('consoResume').textContent, '| catégories :', [...d.getElementById('consoCat').options].map(o => o.text).join(', '));
  const inp = [...d.querySelectorAll('#consoBody input')];
  inp[0].value = '12'; ev(inp[0], 'input'); inp[1].value = '3'; ev(inp[1], 'input');
  d.getElementById('consoRemarque').value = 'Test'; ev(d.getElementById('consoRemarque'), 'input');
  await w.eval('validerInventaireConso()'); await wait(500);
  const inp2 = [...d.querySelectorAll('#consoBody input')]; inp2[0].value = '10'; ev(inp2[0], 'input');
  console.log('Écart affiché :', d.querySelector('#consoBody .conso-ecart').textContent, '| dernier comptage :', d.querySelector('#consoBody td:nth-child(3)').textContent.trim().slice(0, 12));
  d.getElementById('conso_nom').value = 'Thermomètre frontal'; d.getElementById('conso_cat').value = 'Matériel médical'; d.getElementById('conso_unite').value = 'pièce';
  await w.eval('ajouterConsommable()'); await wait(300);
  const l = await w.eval("getParam('consommables', REF_CONSOMMABLES)");
  console.log('Articles :', l.length, '| ajouté :', l.some(a => a.nom === 'Thermomètre frontal'));
  await w.eval(`modifierConsommable('${l[0].id}')`); await wait(300);
  console.log('Modifié :', (await w.eval("getParam('consommables', REF_CONSOMMABLES)"))[0].nom);
  console.log('Historique :', d.getElementById('consoHistorique').textContent.replace(/\s+/g, ' ').trim());
  console.log('Erreurs JS :', errors.length ? errors.slice(0, 5) : 'aucune');
  process.exit(0);
})();
