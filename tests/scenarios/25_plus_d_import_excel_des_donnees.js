// L'import des données depuis un fichier Excel est retiré (il dupliquait tout) ; l'export Excel et l'import du stock initial restent
const { chromium } = require('playwright');
const R = require('./_relais');
(async () => {
  const b = await chromium.launch(R.cr({}));
  const p = await R.appareil(b, 'tablette', true);
  await p.evaluate(() => goScreen('plus')); await p.waitForTimeout(300);
  const r = await p.evaluate(async () => ({
    boutonImportDonnees: [...document.querySelectorAll('button')].some(x => /Importer \.xlsx/.test(x.textContent)),
    champFichier: !!document.getElementById('importFile'), fenetre: !!document.getElementById('importModal'), fonction: typeof window.importerExcel,
    exportExcel: [...document.querySelectorAll('button')].some(x => /Télécharger \(\.xlsx\)/.test(x.textContent)) && typeof exporterExcel === 'function',
    importStockInitial: !!document.getElementById('importStockFile') && typeof importerStockInitial === 'function',
    feuillesExport: (await genererWorkbook()).SheetNames.join(', '),
  }));
  console.log('Import Excel des données :', JSON.stringify({ bouton: r.boutonImportDonnees, champ: r.champFichier, fenetre: r.fenetre, fonction: r.fonction }));
  console.log('Conservés : export Excel', r.exportExcel, '| feuilles :', r.feuillesExport, '| import du stock initial :', r.importStockInitial);
  await b.close();
})().catch(e => { console.error('ECHEC', e); process.exit(1); });
