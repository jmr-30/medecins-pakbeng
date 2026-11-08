// Fiche médicaments validée (nov. 2026) : appareil neuf pré-rempli, nom commercial affiché et cherchable
const _path = require('path');
const APP = process.env.APP || _path.resolve(__dirname, '..', '..', 'index.html');
const _cr = require('./_chromium');
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(_cr({}));
  const p = await (await b.newContext({ locale: 'fr-FR', viewport: { width: 800, height: 1200 }, hasTouch: true })).newPage();
  await _cr.role(p); p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('file://' + APP); await p.waitForTimeout(2500);
  // 1. Appareil neuf : la fiche est pré-chargée une seule fois
  const f = await p.evaluate(async () => {
    const all = await dbGetAll('stock_config'); const m = Object.fromEntries(all.map(x => [x.molecule, x]));
    const tam = m['TAMSULOSINE — 0,4 mg — cpr'], pyr = m['PYRANTEL — 125 mg — cpr'], eno = m['ENOXAPARINE — 4000 UI / 0,4 ml — injectable'];
    return { fiches: all.length, molecules: REF.molecules.length, tam: !!tam, ancienTam: REF.molecules.includes('TAMSULOSINE — 4 mg — cpr'),
      pyr: REF.molecules.filter(x => /^PYRANTEL/.test(x)).length, pyrMin: pyr && pyr.stockMinimal, enoSuivi: eno && eno.suivi,
      aspSup: REF.molecules.includes('AC ACETYLSALICYLIQUE — 75 mg — cpr'), sansFiche: REF.molecules.filter(x => !m[x]).length,
      rac: REF.molecules.filter(x => /^RACECADOTRIL/.test(x)).map(x => x.match(/— ([\d,]+) mg/)[1]).join('<') };
  });
  console.log('Fiches chargées :', f.fiches, '| médicaments :', f.molecules, '| sans fiche :', f.sansFiche);
  console.log('Tamsulosine 0,4 mg :', f.tam, '| ancienne 4 mg retirée :', !f.ancienTam);
  console.log('Pyrantel : un seul produit :', f.pyr === 1, '| mini', f.pyrMin);
  console.log('Enoxaparine non suivie :', f.enoSuivi === false, '| supprimé absent :', !f.aspSup);
  console.log('Racécadotril croissant :', f.rac);
  // 2. Une fiche modifiée n'est pas écrasée au redémarrage
  await p.evaluate(async () => { const c = await dbGet('stock_config', 'TAMSULOSINE — 0,4 mg — cpr'); c.stockMinimal = 77; await dbPut('stock_config', c); });
  await p.reload(); await p.waitForTimeout(2500);
  console.log('Fiche modifiée conservée :', await p.evaluate(async () => (await dbGet('stock_config', 'TAMSULOSINE — 0,4 mg — cpr')).stockMinimal === 77));
  // 3. Nom commercial : cherchable dans la liste de prescription et affiché à côté de la DCI
  const r = await p.evaluate(() => {
    const c = new Combo('c_nom', REF.molecules, { alias: princepsDe }); c.inputEl.value = 'fuc'; c._show('fuc');
    const o = [...c.dropdown.querySelectorAll('.combo-option')].map(x => ({ v: x.dataset.valeur, t: x.textContent }));
    return { n: o.length, ex: o.find(x => /FUSIDIQUE/.test(x.v)) };
  });
  console.log('Recherche « fuc » (Fucidine) :', r.n >= 1, '| valeur propre :', r.ex && r.ex.v, '| affichage :', r.ex && r.ex.t);
  // 4. Filtre de la fiche médicaments par nom commercial
  await p.evaluate(() => goScreen('stock_config')); await p.waitForTimeout(800);
  await p.fill('#stockConfigSearch', 'exacyl'); await p.waitForTimeout(500);
  console.log('Fiche filtrée « exacyl » :', await p.$$eval('#stockConfigBody tr', t => t.map(x => x.getAttribute('data-mol')).join(' | ')));
  await b.close();
})();
