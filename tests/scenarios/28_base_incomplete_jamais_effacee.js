// Base incomplète (une partie manque) : l'application ne l'efface plus ; elle s'arrête sur un message et permet une sauvegarde de secours
const { chromium } = require('playwright');
const R = require('./_relais');
(async () => {
  const b = await chromium.launch(R.cr({}));
  const ctx = await b.newContext({ locale: 'fr-FR', acceptDownloads: true });
  const p = await ctx.newPage(); const erreurs = []; p.on('pageerror', e => erreurs.push(e.message));
  await R.cr.role(p, 'tablette');
  await p.goto('file://' + R.APP); await p.waitForTimeout(2500);
  // On fabrique une base de même version à laquelle il manque la fiche médicaments, avec une consultation dedans
  await p.evaluate(() => new Promise((res, rej) => {
    db.close();
    const del = indexedDB.deleteDatabase(DB_NAME);
    del.onerror = () => rej(del.error);
    del.onsuccess = () => {
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = e => { const d = e.target.result;
        ['consultations', 'receptions', 'sorties'].forEach(s => d.createObjectStore(s, { keyPath: 'id', autoIncrement: true }));
        d.createObjectStore('parametres', { keyPath: 'cle' });
        e.target.transaction.objectStore('consultations').add({ date: '2026-11-01', nom: 'PRECIEUSE', createdAt: '2026-11-01T08:00:00.000Z' }); };
      req.onsuccess = e => { e.target.result.close(); res(); };
      req.onerror = () => rej(req.error);
    };
  }));
  await p.reload(); await p.waitForTimeout(3000);
  console.log('Message affiché :', await p.isVisible('#erreurBase'), '|', (await p.textContent('#erreurBase h2')).trim(), '|', /Rien n'a été effacé/.test(await p.textContent('#erreurBase')));
  console.log('Détail :', await p.textContent('#erreurBaseDetail'));
  const lire = () => p.evaluate(() => new Promise(res => { const r = indexedDB.open(DB_NAME); r.onsuccess = e => { const d = e.target.result; const noms = [...d.objectStoreNames];
    const q = d.transaction('consultations').objectStore('consultations').getAll(); q.onsuccess = () => { d.close(); res({ noms: noms.join(','), consultations: q.result.map(c => c.nom) }); }; }; }));
  console.log('Base après démarrage :', JSON.stringify(await lire()));
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 10000 }), p.click('#erreurBaseSauver')]);
  await dl.saveAs(R.chemin('secours.json'));
  const s = JSON.parse(R.fs.readFileSync(R.chemin('secours.json')));
  console.log('Sauvegarde de secours :', dl.suggestedFilename().replace(/\d{4}-\d{2}-\d{2}_\d{2}h\d{2}/, 'DATE'), '| consultations :', s.consultations.map(c => c.nom).join(','));
  await p.reload(); await p.waitForTimeout(3000);
  console.log('Après un second démarrage :', JSON.stringify(await lire()));
  await b.close();
})().catch(e => { console.error('ECHEC', e); process.exit(1); });
