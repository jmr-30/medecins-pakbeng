// Reprise : si les préférences du navigateur sont perdues au rechargement, la mission et le repère de reprise sont relus dans la base
const { chromium } = require('playwright');
const R = require('./_relais');
(async () => {
  const b = await chromium.launch(R.cr({}));
  const tab = await R.appareil(b, 'tablette', true);
  await R.sauver(tab, 'vendredi.json');
  const ph = await R.appareil(b, 'pharmacie');
  // Au prochain chargement de la page, toutes les préférences du navigateur sont effacées (perte simulée)
  await ph.addInitScript(() => { if (sessionStorage.getItem('perdre')) { sessionStorage.removeItem('perdre'); localStorage.clear(); localStorage.setItem('role_appareil', 'pharmacie'); } });
  const etat = p => p.evaluate(async () => ({ mission: getMissionNumero(), repere: !!JSON.parse(localStorage.getItem('base_reprise') || 'null')?.exportedAt,
    receptions: (await dbGetAll('receptions')).length, consultations: (await dbGetAll('consultations')).length, repereEnBase: !!(await dbGet('parametres', 'reperes_apres_reprise')) }));
  await ph.evaluate(() => sessionStorage.setItem('perdre', '1'));
  await R.reprendre(ph, 'vendredi.json');
  console.log('Après reprise avec perte des préférences :', JSON.stringify(await etat(ph)));
  await R.sauver(ph, 'dimanche.json');
  const f = JSON.parse(R.fs.readFileSync(R.chemin('dimanche.json')));
  console.log('Fichier exporté ensuite : base', f.base?.role, '| mission', f.mission?.numero, '| repères internes exportés :', f.parametres.some(x => x.cle === 'reperes_apres_reprise'));
  // Le contrôle de date fonctionne toujours : le fichier du vendredi, déjà repris, est reconnu
  const q = await R.presenter(ph, 'vendredi.json');
  console.log('Même fichier présenté de nouveau : signalé déjà repris :', /DÉJÀ été repris/.test(q.msg));
  // Annulation de la reprise avec la même perte
  await ph.evaluate(() => sessionStorage.setItem('perdre', '1'));
  await R.auto(ph); await ph.evaluate(() => { annulerDerniereReprise(); }); await ph.waitForEvent('load', { timeout: 20000 }); await ph.waitForTimeout(2500);
  console.log('Après annulation avec perte des préférences :', JSON.stringify(await etat(ph)));
  await b.close();
})().catch(e => { console.error('ECHEC', e); process.exit(1); });
