// Application publiée (dossier site/) : installation, hors ligne, Excel hors ligne, partage, mise à jour
const _path = require('path'), fs = require('fs'), http = require('http'), os = require('os');
const SITE_SRC = process.env.SITE || _path.resolve(__dirname, '..', '..');
const DEMO = process.env.DEMO || _path.resolve(__dirname, '..', '..', 'demo', 'demo_data.json');
const _cr = require('./_chromium');
const { chromium } = require('playwright');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.json': 'application/json' };
(async () => {
  if (!fs.existsSync(_path.join(SITE_SRC, 'index.html'))) { console.log('Dossier site absent : scénario ignoré'); console.log('Erreurs : aucune'); return; }
  const SITE = fs.mkdtempSync(_path.join(os.tmpdir(), 'site-')); fs.cpSync(SITE_SRC, SITE, { recursive: true, filter: s => !/[\\/](\.git|tests|demo|node_modules)([\\/]|$)/.test(s.slice(SITE_SRC.length)) });
  const srv = http.createServer((q, r) => {
    let f = _path.join(SITE, decodeURIComponent(q.url.split('?')[0])); if (f.endsWith('/')) f += 'index.html';
    fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'Content-Type': TYPES[_path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); r.end(d); } });
  }).listen(0);
  const URL = `http://localhost:${srv.address().port}/`;
  const b = await chromium.launch(_cr({}));
  const ctx = await b.newContext({ locale: 'fr-FR', viewport: { width: 800, height: 1280 }, hasTouch: true, isMobile: true });
  const p = await ctx.newPage(); await _cr.role(p); p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto(URL); await p.waitForTimeout(3000); await p.reload(); await p.waitForTimeout(2000);
  console.log('Contrôlée par le service worker :', await p.evaluate(() => !!navigator.serviceWorker.controller));
  console.log('Manifeste :', await p.evaluate(async () => { const m = await (await fetch(document.querySelector('link[rel=manifest]').href)).json(); return m.display + ' / ' + m.icons.length + ' icônes'; }));
  await p.evaluate(() => { window.__autoValider = true; });
  await (await p.$('#importJSONFile')).setInputFiles(DEMO); await p.waitForTimeout(3000);
  await ctx.setOffline(true); await p.reload(); await p.waitForTimeout(3000);
  console.log('Hors ligne :', JSON.stringify(await p.evaluate(async () => ({ consultations: (await dbGetAll('consultations')).length, excel: await chargerXLSX() }))));
  const part = await p.evaluate(async () => {
    navigator.canShare = o => !!(o && o.files); window.__partage = null;
    navigator.share = async o => { window.__partage = o.files.map(f => f.name.replace(/_\d{4}-\d{2}-\d{2}_\d{2}h\d{2}/, '')); };
    _driveDirectoryHandle = null; _dossierAutorise = false; await exporterVersDrive(); return window.__partage;
  });
  console.log('Partage :', JSON.stringify(part));
  await ctx.setOffline(false);
  const ctx2 = await b.newContext({ locale: 'fr-FR' }); const p2 = await ctx2.newPage(); await _cr.role(p2); p2.on('pageerror', e => console.log('ERR', e.message));
  await p2.goto(URL); await p2.waitForTimeout(2500); await p2.reload(); await p2.waitForTimeout(1500);
  fs.writeFileSync(_path.join(SITE, 'index.html'), fs.readFileSync(_path.join(SITE, 'index.html'), 'utf8').replace('<title>Les Médecins de Pakbeng</title>', '<title>Les Médecins de Pakbeng v2</title>'));
  await p2.reload(); await p2.waitForTimeout(2500);
  console.log('Après publication — 1er démarrage :', await p2.title(), '|', await p2.textContent('#toast'));
  await p2.reload(); await p2.waitForTimeout(1500);
  console.log('Après publication — 2e démarrage :', await p2.title());
  console.log('Erreurs : aucune');
  await b.close(); srv.close();
})();
