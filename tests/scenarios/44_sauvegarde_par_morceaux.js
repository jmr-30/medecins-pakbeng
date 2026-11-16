// Sauvegarde .json écrite par morceaux : même contenu qu'avant, fichier plus léger, copie interne jamais lue ni exportée, écran jamais figé longtemps
const { chromium } = require('playwright');
const R = require('./_relais');
(async () => {
  const b = await chromium.launch(R.cr({}));
  const p = await R.appareil(b, 'tablette', true);
  const r = await p.evaluate(async () => {
    // 3 000 consultations de plus, et une copie interne d'avant reprise
    const tx = db.transaction('consultations', 'readwrite'); const st = tx.objectStore('consultations');
    for (let n = 0; n < 3000; n++) st.add({ date: '2026-11-0' + (1 + n % 9), nom: 'NOM' + n, prenom: 'É"\\n' + n, notes: n % 7 ? '' : 'ligne 1\nligne 2', prescription: [{ molecule: 'X — 1 mg — cpr', quantite: 1, lots: [] }], createdAt: 'c' + n });
    await new Promise(res => { tx.oncomplete = res; });
    await setParam('copie_avant_reprise', { le: new Date().toISOString(), fichier: 'x.json', repere: null, donnees: { consultations: new Array(2000).fill({ nom: 'ANCIEN' }) } });
    await setParam('reperes_apres_reprise', { mission: null, base: null, message: '' });
    // Ce que produisait l'ancienne écriture : tout le contenu, mis en page d'un bloc
    const [consultations, receptions, sorties, stockConfig, parametres] = await Promise.all(['consultations', 'receptions', 'sorties', 'stock_config', 'parametres'].map(s => dbGetAll(s)));
    const lus = []; const origGet = IDBObjectStore.prototype.get, origAll = IDBObjectStore.prototype.getAll;
    IDBObjectStore.prototype.get = function (k) { if (this.name === 'parametres') lus.push(k); return origGet.call(this, k); };
    IDBObjectStore.prototype.getAll = function (...a) { if (this.name === 'parametres') lus.push('TOUT'); return origAll.apply(this, a); };
    // Pendant l'écriture, on compte les fois où la main est rendue à l'écran (une par morceau de 500 enregistrements)
    let pauses = 0; const origTimeout = window.setTimeout; window.setTimeout = (f, ms, ...a) => { if (!ms) pauses++; return origTimeout(f, ms, ...a); };
    const blob = await genererBlobJSON(); window.setTimeout = origTimeout;
    IDBObjectStore.prototype.get = origGet; IDBObjectStore.prototype.getAll = origAll;
    const texte = await blob.text(), d = JSON.parse(texte);
    const ancien = { consultations, receptions, sorties, stockConfig, parametres: parametres.filter(x => !['dossier_sauvegarde', 'copie_avant_reprise', 'reperes_apres_reprise'].includes(x.cle)) };
    return { cles: Object.keys(d).join(','), identique: Object.keys(ancien).every(k => JSON.stringify(d[k]) === JSON.stringify(ancien[k])), nb: d.consultations.length,
      copieLue: lus.includes('copie_avant_reprise') || lus.includes('TOUT'), copieExportee: texte.includes('ANCIEN') || d.parametres.some(x => /copie|reperes/.test(x.cle)),
      plusLeger: texte.length < JSON.stringify({ ...d }, null, 2).length * 0.8, uneLigneParEnregistrement: texte.split('\n').length > d.consultations.length, pauses, type: blob.type };
  });
  console.log('Clés du fichier :', r.cles);
  console.log(`Contenu identique à l'ancienne écriture : ${r.identique} (${r.nb} consultations) | type : ${r.type}`);
  console.log('Copie interne : lue', r.copieLue, '| exportée', r.copieExportee);
  console.log('Fichier plus léger :', r.plusLeger, '| un enregistrement par ligne :', r.uneLigneParEnregistrement, '| main rendue à l\'écran pendant l\'écriture :', r.pauses >= 6 ? 'oui' : 'non (' + r.pauses + ')');
  // Le fichier reste repris et restauré comme avant
  R.fs.writeFileSync(R.chemin('s.json'), await p.evaluate(async () => (await genererBlobJSON()).text()));
  const neuf = await R.appareil(b, 'tablette');
  await (await neuf.$('#importJSONFile')).setInputFiles(R.chemin('s.json')); await neuf.waitForTimeout(5000);
  console.log('Restauré sur un appareil neuf :', await neuf.evaluate(async () => (await dbGetAll('consultations')).length), 'consultations');
  await b.close();
})().catch(e => { console.error('ECHEC', e); process.exit(1); });
