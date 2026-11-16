// Date de consultation dans le futur ou hors de la mission : confirmation demandée ; le rapport compte dans la mission toute consultation qui lui est rattachée
const { chromium } = require('playwright');
const XLSX = require('xlsx');
const R = require('./_relais');
const M = 'RAPPORT — TEST — cpr';
(async () => {
  const b = await chromium.launch(R.cr({}));
  const p = await R.appareil(b, 'tablette');
  const j = n => p.evaluate(n => { const d = new Date(); d.setDate(d.getDate() + n); return dateLocaleISO(d); }, n);
  const [debut, fin, avant, apres, futur, dans] = [await j(-5), await j(5), await j(-9), await j(-7), await j(3), await j(-1)];
  await p.evaluate(async ([M, debut, fin, avant]) => {
    localStorage.setItem('mission_active', JSON.stringify({ numero: 'Mission R', debut, fin, medecins: 'Dr A' }));
    await setParam('molecules', [...await getParam('molecules', REF.molecules), M]); await rechargerCombosMolecules();
    await dbAdd('receptions', { date: avant, fournisseur: 'Test', molecule: M, lot: 'Exp. 06/2031', datePeremption: '2031-06-01', quantite: 100, createdAt: 'r1' });
  }, [M, debut, fin, avant]);
  // Saisie par l'écran : renvoie le titre de la fenêtre d'alerte (ou « aucune »), puis choisit « garder » ou « corriger »
  const saisir = async (nom, date, garder) => {
    await R.auto(p, false);
    await p.evaluate(async ([nom, date, M]) => { goScreen('consultation'); effacerConsultation(); document.getElementById('c_date').value = date; document.getElementById('c_nom').value = nom;
      COMBOS.c_lieu.setValue('Dispensaire Pakbeng'); COMBOS.c_med1.setValue((await getParam('medecins', REF.medecins))[0]); COMBOS.presc_mol_1.setValue(M); document.getElementById('presc_qty_1').value = '10'; }, [nom, date, M]);
    await p.waitForTimeout(700);
    await p.evaluate(() => { confirmerAvantEnregistrement(); }); await p.waitForTimeout(600);
    const alerte = await p.isVisible('#dlg.ouvert');
    const txt = alerte ? `${(await p.textContent('#dlgTitre')).trim()} — ${/FUTUR/.test(await p.textContent('#dlgMsg')) ? 'futur' : 'hors mission'}` : 'aucune alerte';
    if (alerte) { await p.click(garder ? '#dlgOk' : '#dlgAnnuler'); await p.waitForTimeout(600); }
    const pret = await p.evaluate(() => document.getElementById('confirmModal').style.display === 'flex');
    if (pret) { await p.evaluate(() => enregistrerConsultation()); await p.waitForTimeout(900); }
    console.log(`${nom} : ${txt} | enregistrée : ${await p.evaluate(async n => (await dbGetAll('consultations')).some(c => c.nom === n), nom)}`);
    await p.waitForTimeout(1600);
  };
  await saisir('DANS LA MISSION', dans, true);
  await saisir('FUTUR CORRIGE', futur, false);
  await saisir('FUTUR', futur, true);
  await saisir('AVANT LA MISSION', apres, true);     // 7 jours avant aujourd'hui : avant le début de la mission
  // Rapport : les trois consultations sont rattachées à la mission
  await p.evaluate(async () => { goScreen('historique'); await chargerHistorique(); _histoMissionCourante = 'Mission R'; });
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 20000 }), p.evaluate(() => { exporterMission(); })]);
  await dl.saveAs(R.chemin('rapport.xlsx')); const wb = XLSX.readFile(R.chemin('rapport.xlsx'));
  const s = XLSX.utils.sheet_to_json(wb.Sheets['Stock mission']).find(r => r['Molécule'] === M);
  const synth = Object.fromEntries(XLSX.utils.sheet_to_json(wb.Sheets['Synthèse'], { header: 1 }).filter(r => r.length >= 2).map(r => [r[0], r[1]]));
  const reel = await p.evaluate(async M => Object.values((await calculerStock())[M]).reduce((a, l) => a + l.restant, 0), M);
  console.log(`Rapport : ${synth['Consultations']} consultations | début ${s['Stock début de mission']} | délivrées ${s['Délivrées au dispensaire']} | stock fin ${s['Stock fin de mission']} | stock réel ${reel}`);
  // Modifier une consultation sans toucher à sa date ne redemande rien
  await R.auto(p, false);
  await p.evaluate(async () => { const c = (await dbGetAll('consultations')).find(x => x.nom === 'AVANT LA MISSION'); await modifierConsultation(c.id, 'recherche'); }); await p.waitForTimeout(900);
  await p.evaluate(() => { document.getElementById('c_nom').value = 'AVANT LA MISSION (CORRIGE)'; confirmerAvantEnregistrement(); }); await p.waitForTimeout(700);
  console.log('Modification sans changer la date : alerte :', await p.isVisible('#dlg.ouvert'));
  await b.close();
})().catch(e => { console.error('ECHEC', e); process.exit(1); });
