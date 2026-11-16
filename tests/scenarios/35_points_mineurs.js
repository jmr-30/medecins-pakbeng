// Points mineurs de l'audit : périmés annoncés dans le stock, plaquettes dans les libellés, historique des inventaires, modification jamais tronquée
const { chromium } = require('playwright');
const R = require('./_relais');
(async () => {
  const b = await chromium.launch(R.cr({}));
  const p = await R.appareil(b, 'tablette');
  const r = await p.evaluate(async () => {
    const attendre = ms => new Promise(r => setTimeout(r, ms));
    const res = {};
    const mols = await getParam('molecules', REF.molecules);
    for (const f of await dbGetAll('stock_config')) _stockConfigs[f.molecule] = f;
    const PLAQ = mols.find(m => uniteDe(m) === 'plaquette'), U = 'MEDICAMENT TEST — 1 mg — cpr';
    await setParam('molecules', [...mols, U]);
    for (const x of await dbGetAll('receptions')) if (x.molecule === PLAQ) await dbDelete('receptions', x.id);
    // 1. Stock : 40 périmés + 5 utilisables, seuil minimal 10
    await dbPut('stock_config', { molecule: U, suivi: true, unite: 'unité', stockMinimal: 10, stockConfort: 50 });
    await dbAdd('receptions', { date: '2026-01-01', fournisseur: 'Test', molecule: U, lot: 'Exp. 01/2026', datePeremption: '2026-01-01', quantite: 40, createdAt: 'r1' });
    await dbAdd('receptions', { date: '2026-01-01', fournisseur: 'Test', molecule: U, lot: 'Exp. 06/2028', datePeremption: '2028-06-01', quantite: 5, createdAt: 'r2' });
    await dbAdd('receptions', { date: '2026-11-10', fournisseur: 'Test', molecule: PLAQ, lot: 'Exp. 06/2028', datePeremption: '2028-06-01', quantite: 12, createdAt: 'r3' });
    goScreen('stock'); await chargerStock(); await attendre(300);
    const cell = document.querySelector(`tr.stock-mol-row[data-mol="${U}"] .c-stock`);
    res.stock = `${cell.textContent.replace(/\s+/g, ' ').trim()} | couleur d'alerte : ${cell.style.color === 'var(--orange)'}`;
    // 2. Liste des réceptions : plaquettes
    goScreen('reception'); await chargerMouvements('receptions'); await attendre(300);
    res.mouvement = [...document.querySelectorAll('#mvt_receptions_liste strong')].map(e => e.textContent)[0];
    // 3. Inventaire : unités et plaquettes annoncées séparément
    _invMoteur = await calculerStock();
    localStorage.setItem(INV_KEY, JSON.stringify({ comptes: { [invCle(U, 'Exp. 06/2028')]: 3, [invCle(PLAQ, 'Exp. 06/2028')]: 10 }, nouveaux: [] }));
    const msgs = []; const orig = boiteDialogue; boiteDialogue = o => { msgs.push(o.message || ''); return orig(o); };
    window.__autoValider = true; await validerInventaire(); boiteDialogue = orig;
    res.inventaire = msgs.join('\n').split('\n').find(l => /en moins/.test(l));
    // 4. Historique : 60 inventaires de médicaments n'effacent pas celui des consommables
    const invs = [];
    for (let i = 0; i < 60; i++) invs.push({ le: new Date(Date.now() - i * 1000).toISOString(), type: 'medicaments', lignes: [] });
    invs.push({ le: '2026-01-01T00:00:00.000Z', type: 'consommables', lignes: [] });
    const l = limiterInventaires(invs);
    res.historique = `${l.filter(x => x.type === 'medicaments').length} médicaments, ${l.filter(x => x.type === 'consommables').length} consommables`;
    // 5. Consultation à 6 médicaments (données importées) : modification refusée, rien de perdu
    const id = await dbAdd('consultations', { date: '2026-11-02', nom: 'SIX', lieu: REF.lieux[0], prescription: [1, 2, 3, 4, 5, 6].map(i => ({ molecule: 'M' + i, quantite: 0, lots: [] })), createdAt: 'c6' });
    window.__autoValider = false;
    modifierConsultation(id, 'recherche'); await attendre(700);
    res.modif = document.getElementById('dlgTitre').textContent.trim() + ' | écran de modification ouvert : ' + (document.getElementById('editionBanner').style.display === 'block');
    document.getElementById('dlgOk').click(); await attendre(300);
    res.lignes = (await dbGet('consultations', id)).prescription.length;
    return res;
  });
  console.log('Stock affiché :', r.stock);
  console.log('Réception d\'un contraceptif :', r.mouvement);
  console.log('Inventaire :', r.inventaire);
  console.log('Historique des inventaires :', r.historique);
  console.log('Consultation à 6 médicaments :', r.modif, '| lignes conservées :', r.lignes);
  await b.close();
})().catch(e => { console.error('ECHEC', e); process.exit(1); });
