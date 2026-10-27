const _path = require('path');
const APP = process.env.APP || _path.resolve(__dirname, '..', '..', 'index.html');
const DEMO = process.env.DEMO || _path.resolve(__dirname, '..', '..', 'demo', 'demo_data.json');
const _cr = require('./_chromium');
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch(_cr({}));
  const ctx = await b.newContext({ locale: 'fr-FR', viewport: { width: 800, height: 1200 }, acceptDownloads: true });
  const p = await ctx.newPage(); await _cr.role(p); let natif = 0; p.on('dialog', d => { natif++; d.accept(); }); p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('file://' + APP); await p.waitForTimeout(2500);
  await p.evaluate(() => { window.__autoValider = true; });
  await (await p.$('#importJSONFile')).setInputFiles(DEMO); await p.waitForTimeout(3000);
  await p.evaluate(() => { window.__autoValider = false; goScreen('parametres'); });
  const etat = async () => p.evaluate(async () => ({ c: (await dbGetAll('consultations')).length, r: (await dbGetAll('receptions')).length, m: getMissionNumero(), ls: localStorage.length }));
  console.log('Avant :', JSON.stringify(await etat()));
  // Mot incorrect
  await p.click('button:has-text("Réinitialiser l\'application…")'); await p.waitForTimeout(300);
  console.log('Fenêtre 1 :', await p.textContent('#dlgTitre'));
  const dl = p.waitForEvent('download'); await p.click('#dlgOk'); const d1 = await dl;
  console.log('Sauvegarde téléchargée :', d1.suggestedFilename());
  await p.waitForTimeout(400); console.log('Fenêtre 2 :', await p.textContent('#dlgTitre'));
  await p.fill('#dlgChamp0', 'effacé'); await p.click('#dlgOk'); await p.waitForTimeout(500);
  console.log('Mot faux → intact :', JSON.stringify(await etat()));
  // Mot correct
  await p.click('button:has-text("Réinitialiser l\'application…")'); await p.waitForTimeout(300);
  const dl2 = p.waitForEvent('download'); await p.click('#dlgOk'); const d2 = await dl2;
  const chemin = await d2.path(); const sauve = JSON.parse(fs.readFileSync(chemin, 'utf8'));
  console.log('Contenu sauvegarde :', sauve.consultations.length, 'consultations');
  await p.waitForTimeout(400); await p.fill('#dlgChamp0', 'effacer');
  await Promise.all([p.waitForNavigation(), p.click('#dlgOk')]); await p.waitForTimeout(3500);
  console.log('Après redémarrage :', JSON.stringify(await etat()), '| fenêtre :', await p.isVisible('#dlg.ouvert'), await p.textContent('#dlgTitre'));
  // Restauration enchaînée
  const fc = p.waitForEvent('filechooser'); await p.click('#dlgOk'); const ch = await fc; await ch.setFiles(chemin);
  await p.waitForTimeout(800); console.log('Fenêtre import :', await p.textContent('#dlgTitre'));
  await p.click('#dlgOk'); await p.waitForTimeout(3500);
  if (await p.isVisible('#dlg.ouvert')) { await p.click('#dlgOk'); await p.waitForTimeout(1000); }
  console.log('Après restauration :', JSON.stringify(await etat()));
  // Piège du stock initial : sauvegarde d'une tablette au stock initial remplacé
  await p.evaluate(async () => { window.__autoValider = true; });
  const j = { ...sauve, consultations: [], sorties: [], receptions: [{ date: '2026-09-01', fournisseur: 'Stock initial — stock.xlsx', molecule: 'PARACETAMOL — 500 mg — cpr', lot: 'Exp. 03/2028', datePeremption: '2028-03-01', quantite: 500, createdAt: '2026-09-01T08:00:00.000Z' }] };
  fs.writeFileSync(require('os').tmpdir() + '/stock_remplace.json', JSON.stringify(j));
  const av = await p.evaluate(async () => (await dbGetAll('receptions')).filter(r => r.fournisseur === 'Stock initial Mission 8').length);
  await (await p.$('#importJSONFile')).setInputFiles(require('os').tmpdir() + '/stock_remplace.json'); await p.waitForTimeout(3000);
  const ap = await p.evaluate(async () => ({ m8: (await dbGetAll('receptions')).filter(r => r.fournisseur === 'Stock initial Mission 8').length, autre: (await dbGetAll('receptions')).filter(r => r.fournisseur === 'Stock initial — stock.xlsx').length }));
  console.log('Stock pré-chargé Mission 8 avant/après :', av, '→', ap.m8, '| nouveau stock initial :', ap.autre, '| boîtes natives :', natif);
  await b.close();
})();
