// Import du stock initial (fichier de la pharmacienne) et renommage d'un médicament : tout est écrit, ou rien
const { chromium } = require('playwright');
const R = require('./_relais');
const panne = (p, n) => p.evaluate(n => { let k = 0; const o = { add: IDBObjectStore.prototype.add, put: IDBObjectStore.prototype.put };
  for (const m of ['add', 'put']) IDBObjectStore.prototype[m] = function (...a) { if (++k === n) throw new Error('panne simulée'); return o[m].apply(this, a); };
  window.__finPanne = () => { IDBObjectStore.prototype.add = o.add; IDBObjectStore.prototype.put = o.put; }; }, n);
const etat = p => p.evaluate(async () => { const r = await dbGetAll('receptions'); const f = [...new Set(r.map(x => x.fournisseur))];
  return `${r.length} réceptions (${f.join(', ')}) | nouveau médicament dans la liste : ${(await getParam('molecules', REF.molecules)).includes('MEDICAMENT NEUF — 10 mg — cpr')}`; });
(async () => {
  const b = await chromium.launch(R.cr({}));
  const p = await R.appareil(b, 'tablette');
  // Fichier de la pharmacienne : 60 lignes
  const xlsx = await p.evaluate(async () => {
    await chargerXLSX();
    const lignes = [['DCI', 'NOM COMMERCIAL', 'DOSE', 'FORME', 'STOCK DEBUT DE MISSION', 'DATE DE PÉREMPTION'], ['MEDICAMENT NEUF', '', '10 mg', 'cpr', 500, new Date(2028, 5, 1)]];
    for (let i = 0; i < 59; i++) lignes.push(['PARACETAMOL', 'Doliprane', '500 mg', 'cpr', 10, new Date(2027 + (i % 3), i % 12, 1)]);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(lignes, { cellDates: true }), 'Stock');
    return XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  });
  R.fs.writeFileSync(R.chemin('stock_M9.xlsx'), Buffer.from(xlsx, 'base64'));
  console.log('Avant :', await etat(p));
  await panne(p, 8);
  await (await p.$('#importStockFile')).setInputFiles(R.chemin('stock_M9.xlsx')); await p.waitForTimeout(2500);
  await p.evaluate(() => window.__finPanne());
  console.log('Import interrompu :', (await p.textContent('#toast')).trim(), '|', await etat(p));
  await (await p.$('#importStockFile')).setInputFiles(R.chemin('stock_M9.xlsx')); await p.waitForTimeout(2500);
  console.log('Import complet :', (await p.textContent('#toast')).trim().replace(/\s+/g, ' '), '|', await etat(p));
  console.log('Repère « stock initial chargé » :', await p.evaluate(async () => !!(await dbGet('parametres', 'stock_initial_charge'))));

  // Renommage d'un médicament présent dans des consultations, des réceptions et la fiche
  const MOL = 'MEDICAMENT NEUF — 10 mg — cpr', MOL2 = 'MEDICAMENT RENOMME — 10 mg — cpr';
  await p.evaluate(async MOL => {
    await dbPut('stock_config', { molecule: MOL, suivi: true, unite: 'unité', stockMinimal: 5 });
    for (let i = 0; i < 6; i++) await dbAdd('consultations', { date: '2026-11-0' + (i + 1), nom: 'P' + i, prescription: [{ molecule: MOL, quantite: 10, lots: [{ lot: 'Exp. 06/2028', datePeremption: '2028-06-01', quantite: 10 }] }], createdAt: 'c' + i });
  }, MOL);
  const noms = () => p.evaluate(async ([MOL, MOL2]) => { const c = await dbGetAll('consultations'), r = await dbGetAll('receptions');
    const n = async m => c.filter(x => x.prescription?.[0]?.molecule === m).length + r.filter(x => x.molecule === m).length + ((await dbGet('stock_config', m)) ? 1 : 0); return `ancien nom : ${await n(MOL)} | nouveau nom : ${await n(MOL2)}`; }, [MOL, MOL2]);
  console.log('Avant renommage —', await noms(), '| stock :', (await R.stock(p, MOL)).split(' ')[0]);
  await panne(p, 4);
  const issue = await p.evaluate(async ([MOL, MOL2]) => { try { await renommerDansDonnees('molecules', MOL, MOL2); return 'terminé'; } catch(e) { return 'erreur signalée'; } finally { window.__finPanne(); } }, [MOL, MOL2]);
  console.log('Renommage interrompu :', issue, '—', await noms());
  await p.evaluate(([MOL, MOL2]) => renommerDansDonnees('molecules', MOL, MOL2), [MOL, MOL2]);
  console.log('Renommage complet —', await noms(), '| stock sous le nouveau nom :', (await R.stock(p, MOL2)).split(' ')[0]);
  await b.close();
})().catch(e => { console.error('ECHEC', e); process.exit(1); });
