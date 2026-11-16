// MISSION FICTIVE COMPLÈTE, du paramétrage au rapport de fin de mission, sur deux appareils (pharmacienne et tablette).
//
// Le test tient sa propre comptabilité du stock (« registre »), indépendante de l'application : chaque entrée, délivrance,
// sortie et écart d'inventaire y est noté, et la délivrance FEFO y est recalculée à part. À chaque étape, le stock de
// l'application doit être identique au registre, lot par lot, et toutes les consultations attendues doivent être présentes.
//
// Déroulé (l'horloge des deux appareils est pilotée par le test ; la mission chevauche janvier et février 2027) :
//   22 janv.  Pharmacienne : import du stock initial (fichier Excel), fiche médicaments, listes, mission → fichier de préparation
//   25 janv.  Tablette : reprise du fichier de préparation
//   25-29     Tablette : consultations (FEFO sur plusieurs lots, lot imposé, stock insuffisant, ligne sans quantité, plaquettes),
//             réception, casse, correction d'une consultation, annulation
//   29 janv.  Vendredi soir : la tablette exporte → la pharmacienne reprend, ajoute une réception, renomme un médicament,
//             change un prix, annule une réception → exporte le dimanche
//   30 janv.  Samedi, sur la tablette : consultations (dont une avec le médicament renommé entre-temps), annulation, nouveau village
//   1er févr. Lundi : la tablette reprend le fichier de la pharmacienne
//   1-5 févr. Consultations, sortie d'un lot périmé, inventaire (un écart, des quantités « à régulariser » soldées)
//   8 févr.   Export Excel, rapport de fin de mission, sauvegarde finale restaurée sur un appareil neuf
const { chromium } = require('playwright');
const XLSX = require('xlsx');
const R = require('./_relais');
const fs = R.fs;

// ── Vérifications ──────────────────────────────────────────────────
let ok = 0; const echecs = [];
const verifier = (titre, cond, detail) => { if (cond) ok++; else echecs.push(titre + (detail ? ' — ' + detail : '')); };
const egal = (titre, obtenu, attendu) => verifier(titre, JSON.stringify(obtenu) === JSON.stringify(attendu), `obtenu ${JSON.stringify(obtenu)} ; attendu ${JSON.stringify(attendu)}`);

// ── Horloge simulée (identique sur les deux appareils, une minute par action) ──
let horloge = new Date('2027-01-22T08:00:00+07:00').getTime();
const jour = () => new Date(horloge + 7 * 3600e3).toISOString().slice(0, 10);   // date au Laos
async function a(p, quand) {   // place l'appareil à l'instant voulu (ou une minute plus tard)
  if (quand) { const t = new Date(quand + ':00+07:00').getTime(); if (t <= horloge) throw new Error('horloge : retour en arrière ' + quand); horloge = t; } else horloge += 60e3;
  await p.context().clock.setFixedTime(new Date(horloge));
}

// ── Registre indépendant ───────────────────────────────────────────
// Une saisie = { type, nom?, mv: [{ k, lot, q }] } ; k est la clé stable du médicament (son nom peut changer en cours de route).
const REG = '(à régulariser)';
const peremption = lot => { const m = /^Exp\. (\d\d)\/(\d{4})$/.exec(lot); return m ? `${m[2]}-${m[1]}-01` : ''; };
const stockRegistre = vue => { const s = {}; for (const e of vue) for (const m of e.mv) { s[m.k] = s[m.k] || {}; s[m.k][m.lot] = (s[m.k][m.lot] || 0) + m.q; } return s; };
// Délivrance FEFO recalculée par le test : lot imposé d'abord, puis les lots non périmés, du plus proche de la péremption au plus lointain
function fefo(vue, k, quantite, lotImpose, sauf) {
  const lots = stockRegistre([...vue].filter(e => e !== sauf))[k] || {};
  const valides = Object.keys(lots).filter(l => l !== REG && lots[l] > 0 && peremption(l) >= jour()).sort((x, y) => peremption(x).localeCompare(peremption(y)));
  const ordre = lotImpose && lots[lotImpose] > 0 ? [lotImpose, ...valides.filter(l => l !== lotImpose)] : valides;
  const mv = []; let reste = quantite;
  for (const l of ordre) { if (reste <= 0) break; const q = Math.min(lots[l], reste); mv.push({ k, lot: l, q: -q }); reste -= q; }
  if (reste > 0) mv.push({ k, lot: REG, q: -reste });
  return mv;
}

// ── Appareils ──────────────────────────────────────────────────────
const noms = { pharma: {}, tab: {} };   // nom courant de chaque médicament, par appareil
const vues = { pharma: new Set(), tab: new Set() };   // saisies présentes sur chaque appareil
const annulees = { pharma: new Set(), tab: new Set() };
const stockApp = p => p.evaluate(async () => { const s = {}; for (const [mol, lots] of Object.entries(await calculerStock())) for (const l of Object.values(lots)) if (l.restant !== 0) { s[mol] = s[mol] || {}; s[mol][l.lot] = l.restant; } return s; });
async function comparer(titre, p, qui) {
  const app = await stockApp(p), reg = stockRegistre(vues[qui]), attendu = {};
  for (const [k, lots] of Object.entries(reg)) for (const [lot, q] of Object.entries(lots)) if (q !== 0) { attendu[noms[qui][k]] = attendu[noms[qui][k]] || {}; attendu[noms[qui][k]][lot] = q; }
  const tri = o => Object.fromEntries(Object.keys(o).sort().map(m => [m, Object.fromEntries(Object.keys(o[m]).sort().map(l => [l, o[m][l]]))]));
  const nomsTest = Object.values(noms[qui]); const appTest = Object.fromEntries(Object.entries(app).filter(([m]) => nomsTest.includes(m) || /^ZZ/.test(m)));
  egal(`Stock ${titre}`, tri(appTest), tri(attendu));
  const consAtt = [...vues[qui]].filter(e => e.type === 'c').map(e => e.nom).sort();
  const consApp = (await p.evaluate(async () => (await dbGetAll('consultations')).map(c => c.nom))).sort();
  egal(`Consultations ${titre}`, consApp, consAtt);
  const total = Object.values(attendu).reduce((s, l) => s + Object.values(l).reduce((x, y) => x + y, 0), 0);
  console.log(`${titre} : ${consAtt.length} consultations, stock total ${total}`);
}
// Passage de relais dans le registre : la destination prend les saisies de la source, garde les siennes, et aucune saisie annulée d'un côté ne revient
function relais(source, dest, instantane) {
  const morts = new Set([...instantane.annulees, ...annulees[dest]]);
  vues[dest] = new Set([...instantane.vue, ...vues[dest]].filter(e => !morts.has(e)));
  annulees[dest] = morts;
  for (const k of Object.keys(instantane.noms)) if (instantane.renommes.includes(k) || !noms[dest][k]) noms[dest][k] = instantane.noms[k];
}
const photo = (qui, renommes = []) => ({ vue: new Set(vues[qui]), annulees: new Set(annulees[qui]), noms: { ...noms[qui] }, renommes });

// ── Gestes de saisie (par les écrans de l'application) ─────────────
const pause = (p, ms = 500) => p.waitForTimeout(ms);
async function consultation(p, qui, c) {
  await a(p);
  const lignes = c.presc.map(l => ({ ...l, mol: noms[qui][l.k] }));
  await p.evaluate(async ([c, lignes, date]) => {
    goScreen('consultation'); effacerConsultation();
    document.getElementById('c_date').value = date; document.getElementById('c_nom').value = c.nom; document.getElementById('c_prenom').value = c.prenom || '';
    document.getElementById('c_age').value = c.age ?? ''; document.getElementById('c_genre').value = c.genre || '';
    COMBOS.c_lieu.setValue(c.lieu); COMBOS.c_med1.setValue('Dr. Test'); if (c.habitation) COMBOS.c_habitation.setValue(c.habitation);
    lignes.forEach((l, i) => { COMBOS['presc_mol_' + (i + 1)].setValue(l.mol); document.getElementById('presc_qty_' + (i + 1)).value = l.q || ''; });
  }, [c, lignes, jour()]);
  await pause(p, 700);
  await p.evaluate(lignes => lignes.forEach((l, i) => { if (l.lotImpose) document.getElementById('presc_lot_' + (i + 1)).value = l.lotImpose; }), lignes);
  await p.evaluate(async () => { await confirmerAvantEnregistrement(); await enregistrerConsultation(); }); await pause(p, 600);
  const e = { type: 'c', nom: c.nom, lieu: c.lieu, date: jour(), presc: c.presc, mv: c.presc.flatMap(l => l.q > 0 ? fefo(vues[qui], l.k, l.q, l.lotImpose) : []) };
  await controlerLots(p, qui, e);
  vues[qui].add(e);
  return e;
}
// Les lots enregistrés par l'application pour cette consultation doivent être ceux que le registre a calculés
async function controlerLots(p, qui, e) {
  const enr = await p.evaluate(async nom => { const c = (await dbGetAll('consultations')).find(x => x.nom === nom); return c ? c.prescription.flatMap(l => (l.lots || []).map(x => `${l.molecule}|${x.lot}|${x.quantite}`)).sort() : null; }, e.nom);
  egal(`FEFO — ${e.nom}`, enr, e.mv.map(m => `${noms[qui][m.k]}|${m.lot}|${-m.q}`).sort());
}
async function reception(p, qui, k, lot, q, fournisseur) {
  await a(p);
  await p.evaluate(async ([mol, per, q, f, date]) => { goScreen('reception'); document.getElementById('r_date').value = date; document.getElementById('r_fourn').value = f;
    COMBOS.r_mol.setValue(mol); document.getElementById('r_perdate').value = per; document.getElementById('r_qty').value = q; enregistrerReception(); }, [noms[qui][k], peremption(lot), q, fournisseur, jour()]);
  await pause(p);
  const e = { type: 'r', fournisseur, mv: [{ k, lot, q }] }; vues[qui].add(e); return e;
}
async function sortie(p, qui, k, lot, q, motif) {
  await a(p);
  await p.evaluate(mol => { goScreen('sortie'); COMBOS.s_mol.setValue(mol); }, noms[qui][k]); await pause(p, 600);
  await p.evaluate(async ([lot, q, motif, date]) => { document.getElementById('s_date').value = date; document.getElementById('s_motif').value = motif; document.getElementById('s_lotsel').value = lot; document.getElementById('s_qty').value = q; await enregistrerSortie(); }, [lot, q, motif, jour()]);
  await pause(p);
  const e = { type: 's', mv: [{ k, lot, q: -q }] }; vues[qui].add(e); return e;
}
async function annuler(p, qui, e) {
  await a(p);
  if (e.type === 'c') await p.evaluate(async nom => annulerConsultation((await dbGetAll('consultations')).find(c => c.nom === nom).id, ''), e.nom);
  else await p.evaluate(async f => annulerMouvement('receptions', (await dbGetAll('receptions')).find(r => r.fournisseur === f).id), e.fournisseur);
  await pause(p); vues[qui].delete(e); annulees[qui].add(e);
}

(async () => {
  const b = await chromium.launch(R.cr({}));
  const ouvrir = async role => { const ctx = await b.newContext({ locale: 'fr-FR', timezoneId: 'Asia/Vientiane', viewport: { width: 800, height: 1200 }, acceptDownloads: true });
    await ctx.clock.setFixedTime(new Date(horloge));
    const p = await ctx.newPage(); p.on('pageerror', e => echecs.push('Erreur dans l\'application : ' + e.message));
    await R.cr.role(p, role); await p.goto('file://' + R.APP); await p.waitForTimeout(2500); await R.auto(p); return p; };
  const reprendre = async (p, fichier, quand) => { await a(p, quand); await R.reprendre(p, fichier); };

  // ═══ 22 janvier — la pharmacienne prépare la mission ═══
  const ph = await ouvrir('pharmacie');
  const INITIAL = [   // DCI, dose, forme, quantité, péremption
    ['ZZAMOX', '500 mg', 'gélule', 60, '2027-03'], ['ZZAMOX', '500 mg', 'gélule', 200, '2028-12'],
    ['ZZPARA', '500 mg', 'cpr', 40, '2026-06'], ['ZZPARA', '500 mg', 'cpr', 100, '2028-09'],
    ['ZZPILULE', '0,03 mg', 'cpr', 30, '2029-05'], ['ZZIBU', '400 mg', 'cpr', 20, '2028-08'] ];
  const wb0 = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb0, XLSX.utils.aoa_to_sheet([['DCI', 'NOM COMMERCIAL', 'DOSE', 'FORME', 'STOCK DEBUT DE MISSION', 'DATE DE PÉREMPTION'],
    ...INITIAL.map(([d, dose, f, q, per]) => [d, '', dose, f, q, new Date(Date.UTC(+per.slice(0, 4), +per.slice(5) - 1, 1, 12))])], { cellDates: true }), 'Stock');
  XLSX.writeFile(wb0, R.chemin('stock_initial.xlsx'));
  await a(ph);
  await (await ph.$('#importStockFile')).setInputFiles(R.chemin('stock_initial.xlsx')); await pause(ph, 2500);
  const importes = await ph.evaluate(async () => (await dbGetAll('receptions')).map(r => ({ mol: r.molecule, lot: r.lot, q: r.quantite, f: r.fournisseur })));
  const cle = { ZZAMOX: 'A', ZZPARA: 'B', ZZPILULE: 'C', ZZIBU: 'D' };
  for (const r of importes) noms.pharma[cle[r.mol.split(' ')[0]]] = r.mol;
  egal('Import du stock initial : lots', importes.map(r => `${r.mol.split(' ')[0]} ${r.lot} ${r.q}`).sort(), INITIAL.map(([d, , , q, per]) => `${d} Exp. ${per.slice(5)}/${per.slice(0, 4)} ${q}`).sort());
  verifier('Import du stock initial : stock pré-chargé remplacé', importes.every(r => r.f === 'Stock initial — stock_initial.xlsx'));
  vues.pharma.add({ type: 'r', initial: true, mv: INITIAL.map(([d, , , q, per]) => ({ k: cle[d], lot: `Exp. ${per.slice(5)}/${per.slice(0, 4)}`, q })) });
  await a(ph);
  await ph.evaluate(async noms => {
    await dbPut('stock_config', { molecule: noms.A, suivi: true, unite: 'unité', stockMinimal: 100, stockConfort: 300, prixFR: 0.10, prixLAK: 1000 });
    await dbPut('stock_config', { molecule: noms.B, suivi: true, unite: 'unité', stockMinimal: 50, stockConfort: 150, prixFR: 0.05 });
    await dbPut('stock_config', { molecule: noms.C, suivi: true, unite: 'plaquette', stockMinimal: 10, stockConfort: 40, prixFR: 2 });
    await dbPut('stock_config', { molecule: noms.D, suivi: true, unite: 'unité', stockMinimal: 30, stockConfort: 80, prixLAK: 500 });
    await setParam('medecins', ['Dr. Test', 'Dr. Second']); await setParam('lieux', ['Dispensaire Pakbeng', 'Ban Village']); await setParam('fournisseurs', ['Pharmacie Lyon', 'Achat local']);
    const m = { numero: 'Mission test', debut: '2027-01-25', fin: '2027-02-08', medecins: 'Dr. Test, Dr. Second' };
    localStorage.setItem('mission_active', JSON.stringify(m));
  }, noms.pharma);
  await comparer('Pharmacienne, préparation', ph, 'pharma');
  await a(ph); await R.sauver(ph, 'preparation.json');
  const prep = photo('pharma');

  // ═══ 25 janvier — la tablette reçoit le fichier de préparation ═══
  const tab = await ouvrir('tablette');
  await reprendre(tab, 'preparation.json', '2027-01-25T08:00'); relais('pharma', 'tab', prep);
  await comparer('Tablette après reprise de la préparation', tab, 'tab');
  egal('Mission reçue par la tablette', await tab.evaluate(() => getMissionNumero()), 'Mission test');
  verifier('Fiche médicaments reçue (plaquettes)', await tab.evaluate(async m => (await dbGet('stock_config', m))?.unite === 'plaquette', noms.tab.C));

  // ═══ 25-29 janvier — première semaine ═══
  const T = 'tab', D = 'Dispensaire Pakbeng', V = 'Ban Village';
  await consultation(tab, T, { nom: 'LUNDI-A', age: 30, genre: 'Féminin', lieu: D, presc: [{ k: 'A', q: 40 }, { k: 'C', q: 3 }] });           // un seul lot + plaquettes
  await consultation(tab, T, { nom: 'LUNDI-B', age: 5, genre: 'Masculin', lieu: D, presc: [{ k: 'A', q: 30 }] });                              // FEFO sur deux lots (20 + 10)
  await a(tab, '2027-01-26T08:00');
  const mardi = await consultation(tab, T, { nom: 'MARDI-A', age: 62, genre: 'Masculin', lieu: V, presc: [{ k: 'B', q: 25 }, { k: 'D', q: 0 }] });   // le lot périmé est ignoré ; ligne sans quantité
  await consultation(tab, T, { nom: 'MARDI-B', age: 40, genre: 'Féminin', lieu: V, presc: [{ k: 'A', q: 10, lotImpose: 'Exp. 12/2028' }] }); // lot imposé
  await a(tab, '2027-01-27T08:00');
  const achat = await reception(tab, T, 'B', 'Exp. 02/2028', 80, 'Achat local');
  await consultation(tab, T, { nom: 'MERCREDI-A', age: 12, genre: 'Féminin', lieu: D, presc: [{ k: 'B', q: 90 }] });                           // prend d'abord la réception du jour (péremption plus proche)
  await a(tab, '2027-01-28T08:00');
  await sortie(tab, T, 'A', 'Exp. 12/2028', 8, 'Casse');
  const jeudi = await consultation(tab, T, { nom: 'JEUDI-A', age: 33, genre: 'Masculin', lieu: D, presc: [{ k: 'D', q: 25 }] });               // stock insuffisant : 20 + 5 à régulariser
  await a(tab, '2027-01-29T08:00');
  const doublon = await consultation(tab, T, { nom: 'VENDREDI-DOUBLON', age: 33, genre: 'Masculin', lieu: D, presc: [{ k: 'B', q: 10 }] });
  // Correction du nom d'une consultation : les lots ne bougent pas
  await a(tab);
  await tab.evaluate(async () => { const c = (await dbGetAll('consultations')).find(x => x.nom === 'MARDI-A'); await modifierConsultation(c.id, 'recherche'); }); await pause(tab, 900);
  await tab.evaluate(async () => { document.getElementById('c_nom').value = 'MARDI-A-CORRIGE'; await enregistrerConsultation(); }); await pause(tab, 900);
  mardi.nom = 'MARDI-A-CORRIGE'; await controlerLots(tab, T, mardi);
  // Correction d'une quantité : la ligne est resservie en FEFO
  await a(tab);
  await tab.evaluate(async () => { const c = (await dbGetAll('consultations')).find(x => x.nom === 'LUNDI-B'); await modifierConsultation(c.id, 'recherche'); }); await pause(tab, 900);
  await tab.evaluate(async () => { document.getElementById('presc_qty_1').value = '35'; await enregistrerConsultation(); }); await pause(tab, 900);
  const lundiB = [...vues.tab].find(e => e.nom === 'LUNDI-B'); lundiB.mv = fefo(vues.tab, 'A', 35, '', lundiB); await controlerLots(tab, T, lundiB);
  await comparer('Tablette, vendredi soir', tab, 'tab');
  await a(tab, '2027-01-29T18:00'); await R.sauver(tab, 'vendredi.json');
  const vendredi = photo('tab');

  // ═══ Week-end — la pharmacienne travaille sur sa copie ; la tablette continue ═══
  await reprendre(ph, 'vendredi.json', '2027-01-30T09:00'); relais('tab', 'pharma', vendredi);
  await comparer('Pharmacienne après reprise du vendredi', ph, 'pharma');
  await reception(ph, 'pharma', 'D', 'Exp. 10/2028', 50, 'Pharmacie Lyon');
  await annuler(ph, 'pharma', achat);                                   // elle annule la réception « Achat local » saisie sur la tablette…
  await reception(ph, 'pharma', 'B', 'Exp. 02/2028', 60, 'Pharmacie Lyon');   // … et la ressaisit avec la bonne quantité
  await a(ph);
  const nouveauNomD = noms.pharma.D.replace('ZZIBU', 'ZZIBUPROFENE');
  await ph.evaluate(async ([ancien, nouveau]) => {   // renommage, comme l'écran Paramètres
    await setParam('molecules', (await getParam('molecules', REF.molecules)).map(m => m === ancien ? nouveau : m));
    await renommerDansDonnees('molecules', ancien, nouveau);
    await journaliser('renommage', 'liste', null, null, `${ancien} → ${nouveau}`, { liste: 'molecules', ancien, nouveau });
    await dbPut('stock_config', { ...(await dbGet('stock_config', nouveau)), prixLAK: 650 });   // prix modifié en cours de mission
  }, [noms.pharma.D, nouveauNomD]);
  noms.pharma.D = nouveauNomD;
  await comparer('Pharmacienne, dimanche soir', ph, 'pharma');
  await a(ph, '2027-01-31T20:00'); await R.sauver(ph, 'dimanche.json');
  const dimanche = photo('pharma', ['D']);

  // Samedi sur la tablette (après l'export du vendredi) : horloge de la tablette ramenée au samedi matin
  horloge = new Date('2027-01-30T08:00:00+07:00').getTime();
  await tab.evaluate(async () => setParam('lieux', [...await getParam('lieux', []), 'Ban Samedi']));
  await consultation(tab, T, { nom: 'SAMEDI-A', age: 50, genre: 'Féminin', lieu: V, habitation: 'Ban Samedi', presc: [{ k: 'D', q: 4 }] });   // ancien nom du médicament, tout à régulariser
  await consultation(tab, T, { nom: 'SAMEDI-B', age: 8, genre: 'Masculin', lieu: D, presc: [{ k: 'A', q: 20 }] });
  await annuler(tab, T, doublon);

  // ═══ Lundi 1er février — la tablette reprend le fichier de la pharmacienne ═══
  horloge = new Date('2027-01-31T20:30:00+07:00').getTime();
  await reprendre(tab, 'dimanche.json', '2027-02-01T08:00'); relais('pharma', 'tab', dimanche);
  await comparer('Tablette, lundi après reprise', tab, 'tab');
  const lundi = await tab.evaluate(async ([ancien, nouveau]) => ({ ancienNom: Object.keys(await calculerStock()).includes(ancien), prix: (await dbGet('stock_config', nouveau))?.prixLAK,
    village: (await getParam('lieux', [])).includes('Ban Samedi'), achatLocal: (await dbGetAll('receptions')).some(r => r.fournisseur === 'Achat local'),
    doublon: (await dbGetAll('consultations')).some(c => c.nom === 'VENDREDI-DOUBLON'), samedi: (await dbGetAll('consultations')).find(c => c.nom === 'SAMEDI-A').prescription[0].molecule === nouveau }), [vendredi.noms.D, nouveauNomD]);
  egal('Lundi : effets du relais', lundi, { ancienNom: false, prix: 650, village: true, achatLocal: false, doublon: false, samedi: true });

  // ═══ 1er-5 février — seconde semaine ═══
  await consultation(tab, T, { nom: 'FEVRIER-A', age: 70, genre: 'Féminin', lieu: D, presc: [{ k: 'D', q: 12 }, { k: 'C', q: 2 }] });
  await a(tab, '2027-02-03T08:00');
  await tab.evaluate(async mol => sortirLotPerime(mol, 'Exp. 06/2026', 40, '2026-06-01'), noms.tab.B); await pause(tab); vues.tab.add({ type: 's', mv: [{ k: 'B', lot: 'Exp. 06/2026', q: -40 }] });
  await consultation(tab, T, { nom: 'FEVRIER-B', age: 3, genre: 'Masculin', lieu: V, presc: [{ k: 'B', q: 15 }, { k: 'A', q: 60 }] });
  // Inventaire du 5 février : A, un lot compte 3 de moins ; D, tous les lots comptés → les quantités à régulariser sont soldées
  await a(tab, '2027-02-05T17:00');
  const avantInv = stockRegistre(vues.tab);
  const comptes = { A: { ...avantInv.A, 'Exp. 12/2028': avantInv.A['Exp. 12/2028'] - 3 }, D: Object.fromEntries(Object.entries(avantInv.D).filter(([l]) => l !== REG)) };
  await tab.evaluate(async ([comptes, noms]) => { _invMoteur = await calculerStock(); const c = {};
    for (const [k, lots] of Object.entries(comptes)) for (const [lot, q] of Object.entries(lots)) c[invCle(noms[k], lot)] = q;
    localStorage.setItem(INV_KEY, JSON.stringify({ comptes: c, nouveaux: [] })); await validerInventaire(); }, [comptes, noms.tab]);
  await pause(tab, 800);
  vues.tab.add({ type: 'inv', mv: [{ k: 'A', lot: 'Exp. 12/2028', q: -3 }, { k: 'D', lot: REG, q: -avantInv.D[REG] }] });
  verifier('Inventaire : il y avait des quantités à régulariser à solder', avantInv.D[REG] < 0);
  await comparer('Tablette après inventaire', tab, 'tab');
  // La pharmacienne a ramené de 80 à 60 une réception dont 80 avaient déjà été délivrées : ce lot est à −20.
  // Le registre le sait (stock identique ci-dessus) et l'écran Stock doit le signaler — c'est la seule anomalie attendue.
  egal('Anomalies de stock signalées en fin de mission', await tab.evaluate(async noms => anomaliesStock(await calculerStock(), await getParam('molecules', [])).filter(x => Object.values(noms).includes(x.molecule)).map(x => `${x.type} ${x.lot}`), noms.tab), ['negatif Exp. 02/2028']);

  // ═══ 8 février — fin de mission : export Excel, rapport, sauvegarde ═══
  await a(tab, '2027-02-08T18:00');
  const feuilles = await tab.evaluate(async () => { const wb = await genererWorkbook(); return Object.fromEntries(wb.SheetNames.map(n => [n, XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1 })])); });
  egal('Export Excel : feuilles', Object.keys(feuilles), ['Consultations', 'Receptions', 'Sorties']);
  egal('Export Excel : colonnes des réceptions', feuilles.Receptions[0], ['Date', 'Fournisseur', 'Molécule', 'N° lot', 'Date péremption', 'Quantité']);
  egal('Export Excel : colonnes des sorties', feuilles.Sorties[0], ['Date', 'Motif', 'Molécule', 'N° lot', 'Date péremption', 'Quantité']);
  egal('Export Excel : colonnes des consultations', feuilles.Consultations[0], ['Date', 'Lieu', 'Médecin 1', 'Médecin 2', 'Nom', 'Prénom', 'Âge', 'Tranche', 'Genre', "Lieu d'habitation", 'Allergies', 'Antécédents', 'Traitements au long cours',
    'Poids (kg)', 'Taille (cm)', 'TA systolique', 'TA diastolique', 'Pouls', 'Température (°C)', 'SpO2 (%)', 'Glycémie (g/L)', 'Examen clinique et complémentaire', 'Grossesse', 'Grossesse (SA)',
    'À revoir (délai)', 'À revoir (motif)', 'À revoir (échéance)', 'À revoir (retiré)', 'Orientation (hôpital)', 'Orientation (motif)', 'Orientation (accord famille)',
    ...[1, 2, 3, 4].flatMap(i => [`Spécialité ${i}`, `Pathologie ${i}`]), ...[1, 2, 3, 4, 5].flatMap(i => [`Molécule ${i}`, `Lot ${i}`, `Qté ${i}`, `Posologie ${i}`]), 'Notes', 'ID Patient', 'Mission']);
  const cons = [...vues.tab].filter(e => e.type === 'c');
  egal('Export Excel : une ligne par consultation', feuilles.Consultations.length - 1, cons.length);

  // Rapport de fin de mission
  await tab.evaluate(async () => { goScreen('historique'); await chargerHistorique(); _histoMissionCourante = 'Mission test'; });
  const [dl] = await Promise.all([tab.waitForEvent('download', { timeout: 20000 }), tab.evaluate(() => { exporterMission(); })]);
  await dl.saveAs(R.chemin('rapport.xlsx'));
  const rap = XLSX.readFile(R.chemin('rapport.xlsx'));
  egal('Rapport : feuilles', rap.SheetNames, ['Synthèse', 'Stock mission', 'Consommation', 'Commande', 'Consommables', 'Consultations', 'Orientations', 'Patients à revoir', 'Pathologies']);
  const synth = Object.fromEntries(XLSX.utils.sheet_to_json(rap.Sheets['Synthèse'], { header: 1 }).filter(r => r.length >= 2).map(r => [r[0], r[1]]));
  egal('Rapport : dates de la mission (à cheval sur deux mois)', synth['Dates'], 'du 25/01/2027 au 08/02/2027');
  egal('Rapport : nombre de consultations', synth['Consultations'], cons.length);
  const rapCons = XLSX.utils.sheet_to_json(rap.Sheets['Consultations']);
  egal('Rapport : consultations de janvier et de février', [rapCons.filter(c => c.Date.startsWith('2027-01')).length, rapCons.filter(c => c.Date.startsWith('2027-02')).length],
    [cons.filter(c => c.date.startsWith('2027-01')).length, cons.filter(c => c.date.startsWith('2027-02')).length]);
  verifier('Rapport : la consultation corrigée apparaît une fois, sous son nouveau nom', rapCons.filter(c => /^MARDI-A/.test(c.Nom)).map(c => c.Nom).join() === 'MARDI-A-CORRIGE');
  const stockRap = XLSX.utils.sheet_to_json(rap.Sheets['Stock mission']).filter(r => Object.values(noms.tab).includes(r['Molécule']));
  const final = stockRegistre(vues.tab), parNom = Object.fromEntries(Object.entries(noms.tab).map(([k, n]) => [n, k]));
  let lignesOk = 0;
  for (const r of stockRap) {
    const k = parNom[r['Molécule']], lot = r['Lot'];
    const somme = r['Stock début de mission'] + r['Entrées pendant la mission'] - r['Délivrées au dispensaire'] - r['Délivrées dans les villages'] - r['Détruites / sorties'] + r["Écart d'inventaire"];
    const debutAtt = INITIAL.filter(([d, , , , per]) => cle[d] === k && `Exp. ${per.slice(5)}/${per.slice(0, 4)}` === lot).reduce((s, x) => s + x[3], 0);
    const delivre = lieuVillage => -cons.filter(c => (c.lieu !== D) === lieuVillage).flatMap(c => c.mv).filter(m => m.k === k && m.lot === lot).reduce((s, m) => s + m.q, 0);
    if (r['Stock fin de mission'] === (final[k][lot] || 0) && somme === r['Stock fin de mission'] && r['Stock début de mission'] === debutAtt
        && r['Délivrées au dispensaire'] === delivre(false) && r['Délivrées dans les villages'] === delivre(true)) lignesOk++;
    else echecs.push(`Rapport, ligne ${r['Molécule']} ${lot} : ${JSON.stringify(r)}`);
  }
  egal('Rapport : toutes les lignes de stock sont justes (début, délivrances, fin)', lignesOk, stockRap.length);
  const lotsAttendus = Object.entries(final).flatMap(([k, lots]) => Object.keys(lots).map(l => `${noms.tab[k]}|${l}`)).sort();
  egal('Rapport : tous les lots du registre y figurent', stockRap.map(r => `${r['Molécule']}|${r['Lot']}`).sort(), lotsAttendus);
  const conso = XLSX.utils.sheet_to_json(rap.Sheets['Consommation']).find(r => r['Molécule'] === noms.tab.D);
  egal('Rapport : valeur consommée au prix en vigueur (kips)', conso['Valeur consommée (kips)'], conso['Total délivré'] * 650);
  egal('Rapport : unité des contraceptifs', XLSX.utils.sheet_to_json(rap.Sheets['Consommation']).find(r => r['Molécule'] === noms.tab.C)['Unité'], 'plaquette');
  const totalFin = Object.values(final).reduce((s, l) => s + Object.values(l).reduce((x, y) => x + y, 0), 0);
  console.log(`Rapport de fin de mission : ${stockRap.length} lignes de stock contrôlées, stock final ${totalFin}`);

  // Sauvegarde finale restaurée sur un appareil neuf : rien ne manque
  await a(tab); await R.sauver(tab, 'finale.json');
  const neuf = await ouvrir('tablette');
  await a(neuf); await (await neuf.$('#importJSONFile')).setInputFiles(R.chemin('finale.json')); await pause(neuf, 3500);
  vues.neuf = vues.tab; noms.neuf = noms.tab;
  await comparer('Appareil neuf après restauration de la sauvegarde finale', neuf, 'neuf');
  egal('Appareil neuf : nombre de saisies', await neuf.evaluate(async () => [(await dbGetAll('consultations')).length, (await dbGetAll('receptions')).length, (await dbGetAll('sorties')).length]),
    await tab.evaluate(async () => [(await dbGetAll('consultations')).length, (await dbGetAll('receptions')).length, (await dbGetAll('sorties')).length]));

  await b.close();
  echecs.forEach(e => console.log('ÉCHEC —', e));
  console.log(`Vérifications : ${ok} réussies, ${echecs.length} échec(s)`);
  if (echecs.length) process.exit(1);
})().catch(e => { console.error('ECHEC', e); process.exit(1); });
