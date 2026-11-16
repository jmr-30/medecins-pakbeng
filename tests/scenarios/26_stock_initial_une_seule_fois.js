// Stock initial pré-chargé : chargé une seule fois, même si le premier lancement est interrompu ou si les préférences du navigateur sont perdues
const { chromium } = require('playwright');
const R = require('./_relais');
const nb = p => p.evaluate(async () => ({ receptions: (await dbGetAll('receptions')).length, repereBase: !!(await dbGet('parametres', 'stock_initial_charge')) }));
(async () => {
  const b = await chromium.launch(R.cr({}));
  const ctx = await b.newContext({ locale: 'fr-FR' });
  const p = await ctx.newPage(); p.on('pageerror', e => console.log('ERR', e.message));
  await R.cr.role(p, 'tablette');
  // Premier lancement interrompu : la 100e écriture du stock initial échoue (panne simulée)
  await p.addInitScript(() => {
    if (sessionStorage.getItem('panne') === 'non') return;
    let n = 0; const orig = IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add = function (...a) { if (this.name === 'receptions' && ++n === 100) throw new Error('panne simulée'); return orig.apply(this, a); };
  });
  await p.goto('file://' + R.APP); await p.waitForTimeout(3000);
  console.log('Lancement interrompu :', JSON.stringify(await nb(p)));
  // Deuxième lancement, sans panne : le stock est chargé en entier, une fois
  await p.evaluate(() => sessionStorage.setItem('panne', 'non'));
  await p.reload(); await p.waitForTimeout(3000);
  console.log('Lancement suivant :', JSON.stringify(await nb(p)));
  // Préférences du navigateur perdues (ancien repère effacé) : pas de second chargement
  await p.evaluate(() => { localStorage.removeItem('stock_initial_charge'); });
  await p.reload(); await p.waitForTimeout(3000);
  console.log('Ancien repère perdu :', JSON.stringify(await nb(p)));
  // Appareil déjà en service avant cette version (ancien repère seul) : le repère est reporté dans la base, sans rechargement
  await p.evaluate(async () => { await dbDelete('parametres', 'stock_initial_charge'); localStorage.setItem('stock_initial_charge', '2026-06-14T00:00:00.000Z'); });
  await p.reload(); await p.waitForTimeout(3000);
  console.log('Appareil déjà en service :', JSON.stringify(await nb(p)));
  // Stock initial vidé volontairement (tout sorti) puis redémarrage : rien n'est rechargé
  await p.evaluate(async () => { for (const r of await dbGetAll('receptions')) await dbDelete('receptions', r.id); localStorage.removeItem('stock_initial_charge'); });
  await p.reload(); await p.waitForTimeout(3000);
  console.log('Réceptions supprimées :', JSON.stringify(await nb(p)));
  await b.close();
})().catch(e => { console.error('ECHEC', e); process.exit(1); });
