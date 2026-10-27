const _path = require('path');
const APP = process.env.APP || _path.resolve(__dirname, '..', '..', 'index.html');
const DEMO = process.env.DEMO || _path.resolve(__dirname, '..', '..', 'demo', 'demo_data.json');
const _cr = require('./_chromium');
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(_cr({ args: ['--lang=fr-FR'] }));
  const p = await (await b.newContext({ locale: 'fr-FR', viewport: { width: 1180, height: 820 }, deviceScaleFactor: 1 })).newPage();
  p.on('dialog', d => d.accept()); p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('file://' + APP); await p.waitForTimeout(2500);
  await p.evaluate(() => { window.__autoValider = true; });
  const inp = await p.$('input[type=file][onchange^="importerJSON"]');
  await inp.setInputFiles(process.argv[2] || DEMO); await p.waitForTimeout(4000);
  const r = await p.evaluate(async () => ({ c: (await dbGetAll('consultations')).length, rec: (await dbGetAll('receptions')).length, s: (await dbGetAll('sorties')).length,
    m: getMissionNumero(), arv: (await patientsARevoir()).length, fiche: uniteDe('LEVONORGESTREL / ETHINYLESTRADIOL (Leeloo) — 0,10 mg / 0,02 mg — plaquette') }));
  console.log(JSON.stringify(r));
  await p.evaluate(() => goAccueil()); await p.waitForTimeout(800);
  
  await b.close();
})();
