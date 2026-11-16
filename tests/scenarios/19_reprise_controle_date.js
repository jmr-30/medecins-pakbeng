// Reprise d'une sauvegarde : contrôle de la date du fichier (plus ancien refusé, déjà repris signalé, retour en arrière possible)
const _path = require('path');
const APP = process.env.APP || _path.resolve(__dirname, '..', '..', 'index.html');
const DEMO = process.env.DEMO || _path.resolve(__dirname, '..', '..', 'demo', 'demo_data.json');
const _cr = require('./_chromium');
const { chromium } = require('playwright');
const fs = require('fs'), os = require('os');
const TMP = fs.mkdtempSync(_path.join(os.tmpdir(), 'reprise-date-'));
const chemin = n => _path.join(TMP, n);
const auto = p => p.evaluate(() => { window.__autoValider = true; });
async function appareil(b, role) {
  const ctx = await b.newContext({ locale: 'fr-FR', viewport: { width: 800, height: 1200 }, acceptDownloads: true });
  const p = await ctx.newPage(); p.on('pageerror', e => console.log('ERR', e.message));
  await _cr.role(p, role);
  p.on('download', async d => { if (/avant_reprise/.test(d.suggestedFilename())) await d.saveAs(chemin('avant_reprise.json')); });
  await p.goto('file://' + APP); await p.waitForTimeout(2500); await auto(p);
  return p;
}
const sauver = async (p, nom) => fs.writeFileSync(chemin(nom), await p.evaluate(async () => (await genererBlobJSON()).text()));
const reprendre = async (p, nom) => { await auto(p); await (await p.$('#repriseJSONFile')).setInputFiles(chemin(nom)); await p.waitForEvent('load', { timeout: 20000 }); await p.waitForTimeout(2500); };
// Présente le fichier sans valider : renvoie le titre et le message de la fenêtre, puis la ferme
const presenter = async (p, nom) => {
  await p.evaluate(() => { window.__autoValider = false; });
  await (await p.$('#repriseJSONFile')).setInputFiles(chemin(nom)); await p.waitForTimeout(900);
  const r = { titre: (await p.textContent('#dlgTitre')).trim(), msg: await p.textContent('#dlgMsg'), retour: await p.isVisible('#dlgAnnuler') };
  await p.click(r.retour ? '#dlgAnnuler' : '#dlgOk'); await p.waitForTimeout(300);
  return r;
};
const nb = p => p.evaluate(async () => (await dbGetAll('consultations')).length);
(async () => {
  const b = await chromium.launch(_cr({}));
  const tab = await appareil(b, 'tablette');
  await (await tab.$('#importJSONFile')).setInputFiles(DEMO); await tab.waitForTimeout(3000);
  await sauver(tab, 'vendredi.json');
  const ph = await appareil(b, 'pharmacie');
  await reprendre(ph, 'vendredi.json');
  await ph.evaluate(async () => { await dbAdd('receptions', { date: dateAujourdhui(), fournisseur: 'Pharmacie Lyon', molecule: 'AMOXICILLINE — 500 mg — gélule', lot: 'Exp. 06/2028', datePeremption: '2028-06-01', quantite: 300, createdAt: new Date().toISOString() }); });
  await ph.waitForTimeout(50); await sauver(ph, 'samedi.json');
  await ph.evaluate(async () => { await dbAdd('receptions', { date: dateAujourdhui(), fournisseur: 'Pharmacie Lyon', molecule: 'IBUPROFENE — 400 mg — cpr', lot: 'Exp. 06/2028', datePeremption: '2028-06-01', quantite: 100, createdAt: new Date().toISOString() }); });
  await ph.waitForTimeout(50); await sauver(ph, 'dimanche.json');

  // Lundi : la tablette reprend le fichier du dimanche
  await reprendre(tab, 'dimanche.json');
  const n0 = await nb(tab);
  // 1. Fichier plus ancien de la pharmacienne (samedi) : refusé
  let r = await presenter(tab, 'samedi.json');
  console.log('Fichier plus ancien :', r.titre, '| choix « Remplacer » proposé :', r.retour, '| inchangé :', (await nb(tab)) === n0, '|', /plus ANCIEN que la sauvegarde déjà reprise/.test(r.msg));
  // 2. Sa propre sauvegarde du vendredi : refusée aussi
  r = await presenter(tab, 'vendredi.json');
  console.log('Propre sauvegarde ancienne :', r.titre);
  // 3. Le même fichier une seconde fois : signalé, sans danger
  r = await presenter(tab, 'dimanche.json');
  console.log('Même fichier :', r.titre, '| signalé déjà repris :', /DÉJÀ été repris/.test(r.msg));
  // 4. Fichier sans date : refusé
  const sansDate = JSON.parse(fs.readFileSync(chemin('dimanche.json'))); delete sansDate.exportedAt; fs.writeFileSync(chemin('sansdate.json'), JSON.stringify(sansDate));
  r = await presenter(tab, 'sansdate.json');
  console.log('Fichier sans date :', r.titre, '|', (r.msg.split('\n').find(l => l.startsWith('•')) || '').trim());
  // 5. Fichier plus récent de la pharmacienne : accepté
  await ph.evaluate(async () => { await dbAdd('receptions', { date: dateAujourdhui(), fournisseur: 'Pharmacie Lyon', molecule: 'PARACETAMOL — 500 mg — cpr', lot: 'Exp. 06/2028', datePeremption: '2028-06-01', quantite: 50, createdAt: new Date().toISOString() }); });
  await ph.waitForTimeout(50); await sauver(ph, 'lundi.json');
  r = await presenter(tab, 'lundi.json');
  console.log('Fichier plus récent :', r.titre);
  // 6. Retour en arrière avec la copie « avant_reprise » de la tablette, puis nouvelle reprise du fichier du dimanche
  console.log('Copie de sécurité téléchargée :', fs.existsSync(chemin('avant_reprise.json')));
  await reprendre(tab, 'avant_reprise.json');
  r = await presenter(tab, 'dimanche.json');
  console.log('Reprise de nouveau possible :', r.titre);
  await b.close();
})().catch(e => { console.error('ECHEC', e); process.exit(1); });
