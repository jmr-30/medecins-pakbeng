// Mémoire des données lues : plus de relecture complète de la base à chaque affichage, et jamais de donnée périmée après une écriture
const { chromium } = require('playwright');
const R = require('./_relais');
(async () => {
  const b = await chromium.launch(R.cr({}));
  const p = await R.appareil(b, 'tablette', true);
  await p.evaluate(() => {   // compte les lectures complètes de chaque store
    window.__lectures = {}; const orig = IDBObjectStore.prototype.getAll;
    IDBObjectStore.prototype.getAll = function (...a) { window.__lectures[this.name] = (window.__lectures[this.name] || 0) + 1; return orig.apply(this, a); };
  });
  const lectures = () => p.evaluate(() => { const l = window.__lectures; window.__lectures = {}; return ['consultations', 'receptions', 'sorties'].map(s => l[s] || 0).join('/'); });
  const MOL = await p.evaluate(async () => Object.entries(await calculerStock()).find(([m, l]) => stockDisponible(l) > 50)[0]);
  await p.evaluate(async MOL => { goScreen('consultation'); COMBOS.presc_mol_1.setValue(MOL); document.getElementById('presc_qty_1').value = '1'; await calculerAllocationsPrescription(); }, MOL);
  await lectures();
  // 1. Dix frappes dans la quantité, puis tour des écrans : aucune relecture de la base
  await p.evaluate(async () => { for (let i = 2; i <= 11; i++) { document.getElementById('presc_qty_1').value = String(i); await calculerAllocationsPrescription(); } });
  console.log('Dix aperçus de prescription — lectures complètes (consultations/réceptions/sorties) :', await lectures());
  await p.evaluate(async () => { await chargerStock(); await chargerInventaire(); await chargerHistorique(); await majCompteurARevoir(); await chargerIndexPatients(); await chargerStock(); });
  console.log('Tour des écrans (stock, inventaire, historique, accueil, suggestions) :', await lectures());

  // 2. Après chaque sorte d'écriture, le stock servi est identique à un calcul complet refait sur la base
  const juste = async titre => {
    const r = await p.evaluate(async MOL => { const a = await calculerStock(); delete _memoireStores.consultations; delete _memoireStores.receptions; delete _memoireStores.sorties;
      const b = await calculerStockComplet(); return { ok: JSON.stringify(a) === JSON.stringify(b), dispo: stockDisponible(a[MOL]) }; }, MOL);
    console.log(`${titre} : stock servi = stock recalculé : ${r.ok} | disponible ${r.dispo}`);
  };
  const d0 = await p.evaluate(async MOL => stockDisponible((await calculerStock())[MOL]), MOL);
  const lot = await p.evaluate(async MOL => lotsFEFO((await calculerStock())[MOL])[0], MOL);
  await juste('Départ');
  const id = await p.evaluate(async ([MOL, lot]) => dbAdd('consultations', { date: dateAujourdhui(), nom: 'MEMOIRE', prescription: [{ molecule: MOL, quantite: 7, lots: [{ lot: lot.lot, datePeremption: lot.datePeremption, quantite: 7 }] }], createdAt: new Date().toISOString() }), [MOL, lot]);
  await juste('Consultation ajoutée (−7)');
  await p.evaluate(async ([id, MOL, lot]) => dbPut('consultations', { id, date: dateAujourdhui(), nom: 'MEMOIRE', prescription: [{ molecule: MOL, quantite: 3, lots: [{ lot: lot.lot, datePeremption: lot.datePeremption, quantite: 3 }] }], createdAt: 'x' }), [id, MOL, lot]);
  await juste('Consultation modifiée (−3)');
  await p.evaluate(id => dbDelete('consultations', id), id);
  await juste('Consultation supprimée');
  await p.evaluate(async ([MOL, lot]) => dbAdd('receptions', { date: dateAujourdhui(), fournisseur: 'Test', molecule: MOL, lot: lot.lot, datePeremption: lot.datePeremption, quantite: 20, createdAt: 'r' }), [MOL, lot]);
  await juste('Réception (+20)');
  await p.evaluate(async ([MOL, lot]) => ecrireEnBloc([{ store: 'sorties', type: 'add', valeur: { date: dateAujourdhui(), motif: 'Casse', molecule: MOL, lot: lot.lot, datePeremption: lot.datePeremption, quantite: 5, createdAt: 's' } }]), [MOL, lot]);
  await juste('Écriture groupée : sortie (−5)');
  // Écriture faite en dehors des fonctions de l'application : elle est vue aussi
  await p.evaluate(([MOL, lot]) => new Promise(res => { const tx = db.transaction('sorties', 'readwrite'); tx.objectStore('sorties').add({ date: dateAujourdhui(), motif: 'Autre', molecule: MOL, lot: lot.lot, datePeremption: lot.datePeremption, quantite: 2, createdAt: 's2' }); tx.oncomplete = res; }), [MOL, lot]);
  await juste('Écriture directe dans la base (−2)');
  // Écriture annulée : rien ne change
  await p.evaluate(([MOL, lot]) => new Promise(res => { const tx = db.transaction('sorties', 'readwrite'); tx.objectStore('sorties').add({ date: dateAujourdhui(), motif: 'Autre', molecule: MOL, lot: lot.lot, quantite: 50, createdAt: 's3' }); tx.onabort = res; tx.abort(); }), [MOL, lot]);
  await juste('Écriture annulée');
  console.log('Évolution attendue du disponible :', [d0, d0 - 7, d0 - 3, d0, d0 + 20, d0 + 15, d0 + 13, d0 + 13].join(' → '));

  // 2 bis. Une écriture simple met la mémoire à jour sans tout relire ; le résultat reste identique à la base
  await p.evaluate(async () => { await calculerStock(); await dbGetAll('stock_config'); }); await lectures();
  const apres = await p.evaluate(async ([MOL, lot]) => {
    const id = await dbAdd('consultations', { date: dateAujourdhui(), nom: 'SANS RELECTURE', prescription: [{ molecule: MOL, quantite: 4, lots: [{ lot: lot.lot, datePeremption: lot.datePeremption, quantite: 4 }] }], createdAt: 'm1' });
    const d1 = stockDisponible((await calculerStock())[MOL]);
    await dbPut('consultations', { ...(await dbGet('consultations', id)), nom: 'SANS RELECTURE 2' });
    await dbPut('stock_config', { molecule: 'AAA — test', suivi: true }); await dbPut('stock_config', { molecule: 'AAA — test', suivi: false, stockMinimal: 3 });
    const idR = await dbAdd('receptions', { date: dateAujourdhui(), fournisseur: 'Test', molecule: MOL, lot: lot.lot, datePeremption: lot.datePeremption, quantite: 9, createdAt: 'm2' });
    await dbDelete('receptions', idR); await dbDelete('consultations', id);
    const noms = (await dbGetAll('consultations')).map(c => c.nom);
    return { d1, d2: stockDisponible((await calculerStock())[MOL]), supprimee: !noms.includes('SANS RELECTURE 2') };
  }, [MOL, lot]);
  console.log('Sept écritures simples — lectures complètes :', await lectures(), '| disponible', apres.d1 - apres.d2 === -4 ? 'juste' : 'FAUX', '| suppression vue :', apres.supprimee);
  const identique = await p.evaluate(async () => { const r = {}; for (const st of ['consultations', 'receptions', 'sorties', 'stock_config']) { const garde = JSON.stringify(await dbGetAll(st)); delete _memoireStores[st]; r[st] = garde === JSON.stringify(await dbGetAll(st)); } return r; });
  console.log('Mémoire identique à la base après ces écritures :', JSON.stringify(identique));

  // 3. Ce que reçoit l'appelant lui appartient : le modifier ne fausse pas la suite
  const r = await p.evaluate(async MOL => {
    const a = await calculerStock(); Object.values(a[MOL]).forEach(l => { l.restant = -999; }); delete a[Object.keys(a)[1]];
    const liste = await dbGetAll('consultations'); const premier = liste[0].id; liste.reverse(); liste.length = 3;
    const b = await calculerStock(), liste2 = await dbGetAll('consultations');
    return { stockIntact: Object.values(b[MOL]).every(l => l.restant !== -999) && Object.keys(b).length > Object.keys(a).length, listeIntacte: liste2[0].id === premier && liste2.length > 3 };
  }, MOL);
  console.log('Résultat modifié par l\'appelant :', JSON.stringify(r));
  await b.close();
})().catch(e => { console.error('ECHEC', e); process.exit(1); });
