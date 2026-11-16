// Annuler la dernière reprise : retour aux données d'avant, saisies faites depuis conservées, copie interne jamais exportée
const _path = require('path');
const APP = process.env.APP || _path.resolve(__dirname, '..', '..', 'index.html');
const DEMO = process.env.DEMO || _path.resolve(__dirname, '..', '..', 'demo', 'demo_data.json');
const _cr = require('./_chromium');
const { chromium } = require('playwright');
const fs = require('fs'), os = require('os');
const TMP = fs.mkdtempSync(_path.join(os.tmpdir(), 'annul-reprise-'));
const chemin = n => _path.join(TMP, n);
const etat = p => p.evaluate(async () => ({ c: (await dbGetAll('consultations')).length, r: (await dbGetAll('receptions')).length, fiches: (await dbGetAll('stock_config')).length,
  lyon: (await dbGetAll('receptions')).filter(x => x.fournisseur === 'Pharmacie Lyon').length, repere: !!localStorage.getItem('base_reprise') }));
(async () => {
  const b = await chromium.launch(_cr({}));
  const ctx = await b.newContext({ locale: 'fr-FR', viewport: { width: 800, height: 1200 }, acceptDownloads: true });
  const p = await ctx.newPage(); p.on('pageerror', e => console.log('ERR', e.message));
  await _cr.role(p, 'tablette');
  await p.goto('file://' + APP); await p.waitForTimeout(2500);
  await p.evaluate(() => { window.__autoValider = true; });
  await (await p.$('#importJSONFile')).setInputFiles(DEMO); await p.waitForTimeout(3000);
  console.log('Bouton avant toute reprise :', await p.evaluate(() => document.getElementById('btnAnnulerReprise').style.display !== 'none'));
  const avant = await etat(p); console.log('Avant la reprise :', JSON.stringify(avant));

  // Fichier « de la pharmacienne » : une réception en plus, une consultation en moins, moins de fiches
  const f = JSON.parse(await p.evaluate(async () => (await genererBlobJSON()).text()));
  f.provenance = { role: 'pharmacie', libelle: 'Appareil de la pharmacienne' }; f.exportedAt = new Date(Date.now() + 1000).toISOString();
  const retiree = f.consultations.pop();
  f.parametres.push({ cle: 'journal_corrections', valeur: [{ le: new Date().toISOString(), action: 'annulation', type: 'consultation', resume: 'x', champs: [], motif: '', avant: retiree, apres: null }] });
  f.receptions.push({ date: '2026-11-08', fournisseur: 'Pharmacie Lyon', molecule: 'AMOXICILLINE — 500 mg — gélule', lot: 'Exp. 06/2028', datePeremption: '2028-06-01', quantite: 300, createdAt: '2026-11-08T10:00:00.000Z' });
  f.stockConfig = f.stockConfig.slice(0, 100);
  fs.writeFileSync(chemin('pharma.json'), JSON.stringify(f));
  await p.evaluate(() => { window.__autoValider = true; });
  await (await p.$('#repriseJSONFile')).setInputFiles(chemin('pharma.json')); await p.waitForEvent('load', { timeout: 20000 }); await p.waitForTimeout(2500);
  console.log('Après la reprise :', JSON.stringify(await etat(p)), '| bouton :', await p.evaluate(() => document.getElementById('btnAnnulerReprise').style.display !== 'none'), '|', (await p.textContent('#btnAnnulerReprise')).replace(/\(du .*\)/, '(du DATE)'));
  const exp = JSON.parse(await p.evaluate(async () => (await genererBlobJSON()).text()));
  console.log('Copie interne absente de la sauvegarde exportée :', !exp.parametres.some(x => x.cle === 'copie_avant_reprise'));

  // Une consultation saisie après la reprise, puis annulation de la reprise
  await p.waitForTimeout(50);
  await p.evaluate(async () => { await dbAdd('consultations', { date: dateAujourdhui(), nom: 'APRES', prenom: 'Reprise', lieu: 'Dispensaire', createdAt: new Date().toISOString() }); });
  await p.evaluate(() => { window.__autoValider = false; });
  await p.evaluate(() => { annulerDerniereReprise(); }); await p.waitForTimeout(900);
  console.log('Question :', (await p.textContent('#dlgTitre')).trim(), '| saisie conservée annoncée :', /1 saisie\(s\) faites depuis la reprise seront CONSERVÉES/.test(await p.textContent('#dlgMsg')));
  await p.click('#dlgOk'); await p.waitForEvent('load', { timeout: 20000 }); await p.waitForTimeout(2500);
  const apres = await etat(p);
  console.log('Après annulation :', JSON.stringify(apres), '| identique à avant, plus la saisie :', apres.c === avant.c + 1 && apres.r === avant.r && apres.fiches === avant.fiches && apres.lyon === 0 && !apres.repere,
    '| consultation APRES :', await p.evaluate(async () => (await dbGetAll('consultations')).some(c => c.nom === 'APRES')),
    '| bouton :', await p.evaluate(() => document.getElementById('btnAnnulerReprise').style.display !== 'none'));
  // Le fichier de la pharmacienne peut être repris de nouveau
  await p.evaluate(() => { window.__autoValider = false; });
  await (await p.$('#repriseJSONFile')).setInputFiles(chemin('pharma.json')); await p.waitForTimeout(900);
  console.log('Nouvelle reprise possible :', (await p.textContent('#dlgTitre')).trim());
  await b.close();
})().catch(e => { console.error('ECHEC', e); process.exit(1); });
