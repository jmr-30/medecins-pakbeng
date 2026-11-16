// « Restaurer .json » : réservé à un appareil vide ; sur un appareil qui contient des données, renvoi vers la reprise (stock initial jamais compté deux fois)
const { chromium } = require('playwright');
const R = require('./_relais');
const MOL = 'X — 1 mg — cpr';
(async () => {
  const b = await chromium.launch(R.cr({}));
  // Appareil neuf (seul le stock pré-chargé est présent) : la restauration se fait directement
  const neuf = await R.appareil(b, 'tablette');
  console.log('Appareil neuf considéré vide :', await neuf.evaluate(() => appareilVide()));
  await R.auto(neuf, false);
  await (await neuf.$('#importJSONFile')).setInputFiles(R.DEMO); await neuf.waitForTimeout(700);
  console.log('Sur appareil vide :', (await neuf.textContent('#dlgTitre')).trim());
  await neuf.click('#dlgOk'); await neuf.waitForTimeout(3000);
  console.log('Restauré :', await neuf.evaluate(async () => (await dbGetAll('consultations')).length), 'consultations | vide ensuite :', await neuf.evaluate(() => appareilVide()));

  // Tablette en service : son stock initial vient d'un fichier ; la pharmacienne l'a réimporté corrigé (180 au lieu de 200)
  const tab = await R.appareil(b, 'tablette', true);
  await tab.evaluate(async MOL => { await dbAdd('receptions', { date: '2026-11-01', fournisseur: 'Stock initial — M9.xlsx', molecule: MOL, lot: 'Exp. 06/2028', datePeremption: '2028-06-01', quantite: 200, createdAt: '2026-11-01T08:00:00.000Z' }); }, MOL);
  await R.sauver(tab, 'tablette.json');
  const f = JSON.parse(R.fs.readFileSync(R.chemin('tablette.json')));
  f.provenance = { role: 'pharmacie', libelle: 'Appareil de la pharmacienne' }; f.exportedAt = new Date(Date.now() + 1000).toISOString();
  f.receptions = f.receptions.map(r => r.molecule === MOL ? { ...r, fournisseur: 'Stock initial — M9_corrige.xlsx', quantite: 180, createdAt: '2026-11-08T10:00:00.000Z' } : r);
  R.fs.writeFileSync(R.chemin('pharma.json'), JSON.stringify(f));
  console.log('Avant :', await R.stock(tab, MOL));
  // Le médecin choisit « Restaurer .json » par erreur
  await R.auto(tab, false);
  await (await tab.$('#importJSONFile')).setInputFiles(R.chemin('pharma.json')); await tab.waitForTimeout(700);
  console.log('Sur appareil non vide :', (await tab.textContent('#dlgTitre')).trim(), '| boutons :', await tab.textContent('#dlgOk'), '/', await tab.textContent('#dlgAnnuler'));
  await tab.click('#dlgAnnuler'); await tab.waitForTimeout(500);
  console.log('Après « Abandonner » :', await R.stock(tab, MOL));
  await (await tab.$('#importJSONFile')).setInputFiles(R.chemin('pharma.json')); await tab.waitForTimeout(700);
  await tab.click('#dlgOk'); await tab.waitForTimeout(900);
  console.log('Puis :', (await tab.textContent('#dlgTitre')).trim());
  await tab.click('#dlgOk'); await tab.waitForEvent('load', { timeout: 20000 }); await tab.waitForTimeout(2500);
  console.log('Après reprise :', await R.stock(tab, MOL));
  await b.close();
})().catch(e => { console.error('ECHEC', e); process.exit(1); });
