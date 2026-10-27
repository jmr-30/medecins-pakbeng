// Passage de relais hebdomadaire : tablette (vendredi) → pharmacienne (week-end) → tablette (lundi)
const _path = require('path');
const APP = process.env.APP || _path.resolve(__dirname, '..', '..', 'index.html');
const DEMO = process.env.DEMO || _path.resolve(__dirname, '..', '..', 'demo', 'demo_data.json');
const _cr = require('./_chromium');
const { chromium } = require('playwright');
const fs = require('fs'), os = require('os');
const TMP = fs.mkdtempSync(_path.join(os.tmpdir(), 'reprise-'));
async function appareil(b, role) {
  const ctx = await b.newContext({ locale: 'fr-FR', viewport: { width: 800, height: 1200 }, acceptDownloads: true });
  const p = await ctx.newPage(); p.on('pageerror', e => console.log('ERR', e.message));
  if (role) await _cr.role(p, role);
  p.__telecharges = []; p.on('download', d => p.__telecharges.push(d.suggestedFilename()));
  await p.goto('file://' + APP); await p.waitForTimeout(2500);
  await p.evaluate(() => { window.__autoValider = true; window.__msgs = [];
    const orig = boiteDialogue; boiteDialogue = o => { window.__msgs.push(o); return orig(o); }; });
  return p;
}
const sauver = async (p, nom) => { const j = await p.evaluate(async () => [await (await genererBlobJSON()).text(), nomFichierJSON()]); fs.writeFileSync(_path.join(TMP, nom), j[0]); return j[1]; };
const reprendre = async (p, nom) => {
  await (await p.$('#repriseJSONFile')).setInputFiles(_path.join(TMP, nom));
  await p.waitForEvent('load', { timeout: 20000 }); await p.waitForTimeout(2500);
  await p.evaluate(() => { window.__autoValider = true; window.__msgs = []; const orig = boiteDialogue; boiteDialogue = o => { window.__msgs.push(o); return orig(o); }; });
};
const etat = p => p.evaluate(async () => ({ c: (await dbGetAll('consultations')).length, r: (await dbGetAll('receptions')).length, s: (await dbGetAll('sorties')).length,
  m: getMissionNumero(), role: localStorage.getItem('role_appareil') }));
(async () => {
  const b = await chromium.launch(_cr({}));
  // ── Premier lancement sans rôle : la question est posée
  const p0 = await b.newPage(); await p0.goto('file://' + APP); await p0.waitForTimeout(3200);
  console.log('Question rôle :', await p0.isVisible('#dlg.ouvert'), '|', await p0.textContent('#dlgTitre'), '|', await p0.evaluate(() => [...document.querySelectorAll('#dlgChamp0 option')].map(o => o.value).join('/')));
  await p0.selectOption('#dlgChamp0', 'pharmacie'); await p0.click('#dlgOk'); await p0.waitForTimeout(300);
  console.log('Rôle choisi :', await p0.evaluate(() => [roleAppareil(), nomFichierJSON().replace(/\d{4}-\d{2}-\d{2}_\d{2}h\d{2}/, 'DATE')].join(' | ')));
  await p0.close();

  // ── Vendredi : tablette avec la démo, sauvegarde
  const tab = await appareil(b, 'tablette');
  await (await tab.$('#importJSONFile')).setInputFiles(DEMO); await tab.waitForTimeout(3000);
  const nomVendredi = await sauver(tab, 'vendredi.json');
  console.log('Fichier vendredi :', nomVendredi.replace(/\d{4}-\d{2}-\d{2}_\d{2}h\d{2}/, 'DATE'), '| provenance :', JSON.parse(fs.readFileSync(_path.join(TMP, 'vendredi.json'))).provenance.libelle);
  const t0 = await etat(tab); console.log('Tablette vendredi :', JSON.stringify(t0));

  // ── Week-end : la pharmacienne reprend, corrige le stock
  const ph = await appareil(b, 'pharmacie');
  await reprendre(ph, 'vendredi.json');
  console.log('Pharmacie après reprise :', JSON.stringify(await etat(ph)));
  const actions = await ph.evaluate(async () => {
    const recs = await dbGetAll('receptions');
    const aAnnuler = recs.find(r => !String(r.fournisseur).startsWith('Stock initial')) || recs[recs.length - 1];
    await annulerMouvement('receptions', aAnnuler.id);
    const aCorriger = recs.find(r => r.id !== aAnnuler.id);
    await dbPut('receptions', { ...aCorriger, quantite: 777, modifieLe: new Date().toISOString() });
    await dbAdd('receptions', { date: dateAujourdhui(), fournisseur: 'Pharmacie Lyon', molecule: 'AMOXICILLINE — 500 mg — gélule', lot: 'Exp. 06/2028', datePeremption: '2028-06-01', quantite: 300, createdAt: new Date().toISOString() });
    return { annule: aAnnuler.createdAt, corrige: aCorriger.createdAt };
  });
  await ph.waitForTimeout(200);
  await sauver(ph, 'dimanche.json');
  const dim = JSON.parse(fs.readFileSync(_path.join(TMP, 'dimanche.json')));
  console.log('Fichier dimanche : provenance', dim.provenance.libelle, '| base', dim.base.role);

  // ── Lundi matin : une consultation saisie sur la tablette avant la reprise
  await tab.waitForTimeout(100);
  await tab.evaluate(async () => { await dbAdd('consultations', { date: dateAujourdhui(), nom: 'LUNDI', prenom: 'Test', sexe: 'F', age: 30, lieu: 'Dispensaire', createdAt: new Date().toISOString() }); });
  await reprendre(tab, 'dimanche.json');
  const msgs = await tab.evaluate(() => localStorage.getItem('journal') || '');
  const r = await tab.evaluate(async (a) => {
    const recs = await dbGetAll('receptions'), j = (await dbGet('parametres', 'journal_corrections'))?.valeur || [];
    return { annuleAbsente: !recs.some(x => x.createdAt === a.annule), corrige: recs.find(x => x.createdAt === a.corrige)?.quantite,
      lyon: recs.filter(x => x.fournisseur === 'Pharmacie Lyon').length, lundi: (await dbGetAll('consultations')).filter(c => c.nom === 'LUNDI').length,
      reprise: j.some(x => x.action === 'reprise'), annulJournal: j.some(x => x.action === 'annulation') };
  }, actions);
  console.log('Tablette lundi :', JSON.stringify(await etat(tab)));
  console.log('Relais :', JSON.stringify(r));
  console.log('Copie de sécurité :', tab.__telecharges.map(n => n.replace(/\d{4}-\d{2}-\d{2}_\d{2}h\d{2}/, 'DATE')).join(', '));

  // ── Message de confirmation (relu sur une nouvelle tentative, sans valider)
  await tab.evaluate(async () => { await dbAdd('consultations', { date: dateAujourdhui(), nom: 'MARDI', prenom: 'Test', sexe: 'M', age: 40, lieu: 'Dispensaire', createdAt: new Date().toISOString() }); window.__autoValider = false; });
  await (await tab.$('#repriseJSONFile')).setInputFiles(_path.join(TMP, 'dimanche.json')); await tab.waitForTimeout(800);
  const txt = await tab.textContent('#dlgMsg');
  console.log('Titre :', await tab.textContent('#dlgTitre'));
  console.log('Message provenance :', txt.includes('Sauvegarde de : Appareil de la pharmacienne'), '| base :', txt.includes('Construite à partir de : Tablette du dispensaire'), '| conservée :', /CONSERVÉES \(2\)[\s\S]*LUNDI[\s\S]*MARDI/.test(txt));
  await tab.click('#dlgAnnuler'); await tab.waitForTimeout(300);
  console.log('Après « Retour » :', JSON.stringify(await etat(tab)));
  await b.close();
})();
