// Reprise d'une sauvegarde : un fichier invalide, ancien ou une écriture interrompue ne doivent RIEN modifier
const _path = require('path');
const APP = process.env.APP || _path.resolve(__dirname, '..', '..', 'index.html');
const DEMO = process.env.DEMO || _path.resolve(__dirname, '..', '..', 'demo', 'demo_data.json');
const _cr = require('./_chromium');
const { chromium } = require('playwright');
const fs = require('fs'), os = require('os');
const TMP = fs.mkdtempSync(_path.join(os.tmpdir(), 'reprise-inv-'));
const etat = p => p.evaluate(async () => ({ c: (await dbGetAll('consultations')).length, r: (await dbGetAll('receptions')).length, s: (await dbGetAll('sorties')).length,
  fiches: (await dbGetAll('stock_config')).length, reglages: (await dbGetAll('parametres')).length }));
const ecrire = (nom, contenu) => { fs.writeFileSync(_path.join(TMP, nom), typeof contenu === 'string' ? contenu : JSON.stringify(contenu)); return _path.join(TMP, nom); };
(async () => {
  const b = await chromium.launch(_cr({}));
  const ctx = await b.newContext({ locale: 'fr-FR', viewport: { width: 800, height: 1200 }, acceptDownloads: true });
  const p = await ctx.newPage(); p.on('pageerror', e => console.log('ERR', e.message));
  await _cr.role(p, 'tablette');
  let recharges = 0; p.on('load', () => recharges++);
  await p.goto('file://' + APP); await p.waitForTimeout(2500);
  await (await p.$('#importJSONFile')).setInputFiles(DEMO); await p.waitForTimeout(600);
  if (await p.isVisible('#dlg.ouvert')) await p.click('#dlgOk');
  await p.waitForTimeout(3000);
  await p.evaluate(async () => { await dbAdd('consultations', { date: dateAujourdhui(), nom: 'LOCALE', prenom: 'Test', lieu: 'Dispensaire', createdAt: new Date().toISOString() }); });
  const bon = JSON.parse(await p.evaluate(async () => (await genererBlobJSON()).text()));
  bon.consultations = bon.consultations.filter(c => c.nom !== 'LOCALE');
  const avant = JSON.stringify(await etat(p)); recharges = 0;
  console.log('Avant :', avant);

  const essai = async (titre, contenu) => {
    await (await p.$('#repriseJSONFile')).setInputFiles(ecrire('essai.json', contenu)); await p.waitForTimeout(900);
    const dlg = await p.isVisible('#dlg.ouvert');
    const t = dlg ? await p.textContent('#dlgTitre') : await p.textContent('#toast');
    const msg = dlg ? await p.textContent('#dlgMsg') : '';
    if (dlg) await p.click('#dlgOk'); await p.waitForTimeout(400);
    console.log(`${titre} : ${t.trim()} | inchangé : ${JSON.stringify(await etat(p)) === avant} | rechargée : ${recharges > 0}` + (msg ? ` | ${msg.split('\n').find(l => l.startsWith('•')) || ''}` : ''));
  };
  await essai('Fichier tronqué', JSON.stringify(bon).slice(0, 5000));
  await essai('Fiche sans nom', { ...bon, stockConfig: [{ suivi: true }, ...bon.stockConfig] });
  const ancien = { ...bon }; delete ancien.stockConfig; delete ancien.parametres;
  await essai('Ancienne version', ancien);
  await essai('Consultations illisibles', { ...bon, consultations: { 0: 'x' } });
  await essai('Quantité invalide', { ...bon, receptions: [{ ...bon.receptions[0], quantite: 'douze' }, ...bon.receptions.slice(1)] });
  await essai('Autre application', { ...bon, appName: 'Autre' });

  // Écriture interrompue en plein milieu (panne simulée à la 40e écriture) : rien ne doit avoir changé
  await p.evaluate(() => { window.__autoValider = true; let n = 0; const orig = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...a) { if (++n === 40) throw new Error('panne simulée'); return orig.apply(this, a); }; window.__restaurerPut = () => { IDBObjectStore.prototype.put = orig; }; });
  await (await p.$('#repriseJSONFile')).setInputFiles(ecrire('bon.json', bon)); await p.waitForTimeout(2500);
  await p.evaluate(() => { window.__restaurerPut(); window.__autoValider = false; });
  console.log('Panne en cours d\'écriture : inchangé :', JSON.stringify(await etat(p)) === avant, '| rechargée :', recharges > 0,
    '| consultation locale toujours là :', await p.evaluate(async () => (await dbGetAll('consultations')).some(c => c.nom === 'LOCALE')));

  // Le même fichier, sans panne : la reprise se fait
  await p.evaluate(() => { window.__autoValider = true; });
  await (await p.$('#repriseJSONFile')).setInputFiles(ecrire('bon.json', bon));
  await p.waitForEvent('load', { timeout: 20000 }); await p.waitForTimeout(2500);
  console.log('Fichier valide : repris :', JSON.stringify(await etat(p)), '| consultation locale conservée :', await p.evaluate(async () => (await dbGetAll('consultations')).some(c => c.nom === 'LOCALE')),
    '| journal :', await p.evaluate(async () => ((await dbGet('parametres', 'journal_corrections'))?.valeur || []).some(j => j.action === 'reprise')));
  await b.close();
})().catch(e => { console.error('ECHEC', e); process.exit(1); });
