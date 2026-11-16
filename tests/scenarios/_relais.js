// Outils communs aux scénarios de passage de relais (tablette ⇄ pharmacienne)
const _path = require('path');
const fs = require('fs'), os = require('os');
const _cr = require('./_chromium');
const APP = process.env.APP || _path.resolve(__dirname, '..', '..', 'index.html');
const DEMO = process.env.DEMO || _path.resolve(__dirname, '..', '..', 'demo', 'demo_data.json');
const TMP = fs.mkdtempSync(_path.join(os.tmpdir(), 'relais-'));
const chemin = n => _path.join(TMP, n);
const auto = (p, v = true) => p.evaluate(v => { window.__autoValider = v; }, v);
async function appareil(b, role, avecDemo) {
  const ctx = await b.newContext({ locale: 'fr-FR', viewport: { width: 800, height: 1200 }, acceptDownloads: true });
  const p = await ctx.newPage(); p.on('pageerror', e => console.log('ERR', e.message));
  await _cr.role(p, role);
  await p.goto('file://' + APP); await p.waitForTimeout(2500); await auto(p);
  if (avecDemo) { await (await p.$('#importJSONFile')).setInputFiles(DEMO); await p.waitForTimeout(3000); }
  return p;
}
const sauver = async (p, nom) => { await p.waitForTimeout(30); fs.writeFileSync(chemin(nom), await p.evaluate(async () => (await genererBlobJSON()).text())); };
const reprendre = async (p, nom) => { await auto(p); await (await p.$('#repriseJSONFile')).setInputFiles(chemin(nom)); await p.waitForEvent('load', { timeout: 20000 }); await p.waitForTimeout(2500); await auto(p); };
// Présente un fichier à la reprise sans valider : renvoie le titre et le message, puis referme
const presenter = async (p, nom) => {
  await auto(p, false);
  await (await p.$('#repriseJSONFile')).setInputFiles(chemin(nom)); await p.waitForTimeout(900);
  const r = { titre: (await p.textContent('#dlgTitre')).trim(), msg: await p.textContent('#dlgMsg'), retour: await p.isVisible('#dlgAnnuler') };
  await p.click(r.retour ? '#dlgAnnuler' : '#dlgOk'); await p.waitForTimeout(300); await auto(p);
  return r;
};
// Stock d'un médicament : total et détail par lot
const stock = (p, mol) => p.evaluate(async mol => { const l = Object.values((await calculerStock())[mol] || {}); return l.length ? `${l.reduce((a, x) => a + x.restant, 0)} (${l.map(x => `${x.lot} : ${x.restant}`).join(' ; ')})` : 'aucun'; }, mol);
module.exports = { APP, DEMO, TMP, chemin, auto, appareil, sauver, reprendre, presenter, stock, cr: _cr, fs };
