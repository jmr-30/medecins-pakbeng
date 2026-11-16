// Rapport de fin de mission : le stock initial importé une fois la mission commencée reste le « Stock début de mission »
const { chromium } = require('playwright');
const XLSX = require('xlsx');
const R = require('./_relais');
const M = 'RAPPORT — TEST — cpr';
(async () => {
  const b = await chromium.launch(R.cr({}));
  const p = await R.appareil(b, 'tablette');
  await p.evaluate(async M => {
    const j = n => { const d = new Date(); d.setDate(d.getDate() + n); return dateLocaleISO(d); };
    localStorage.setItem('mission_active', JSON.stringify({ numero: 'Mission R', debut: j(-5), fin: j(5), medecins: 'Dr A' }));
    await dbAdd('receptions', { date: j(-4), fournisseur: 'Stock initial — stock_M.xlsx', molecule: M, lot: 'Exp. 06/2031', datePeremption: '2031-06-01', quantite: 100, createdAt: 'r1' });   // importé le 2e jour
    await dbAdd('receptions', { date: j(-2), fournisseur: 'Achat local', molecule: M, lot: 'Exp. 06/2031', datePeremption: '2031-06-01', quantite: 20, createdAt: 'r2' });                  // vraie entrée
    await dbAdd('consultations', { date: j(-3), nom: 'A', lieu: 'Dispensaire Pakbeng', mission: 'Mission R', prescription: [{ molecule: M, quantite: 10, lots: [{ lot: 'Exp. 06/2031', datePeremption: '2031-06-01', quantite: 10 }] }], createdAt: 'c1' });
    goScreen('historique'); await chargerHistorique(); _histoMissionCourante = 'Mission R';
  }, M);
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 20000 }), p.evaluate(() => { exporterMission(); })]);
  await dl.saveAs(R.chemin('rapport.xlsx')); const wb = XLSX.readFile(R.chemin('rapport.xlsx'));
  const s = XLSX.utils.sheet_to_json(wb.Sheets['Stock mission']).find(r => r['Molécule'] === M);
  const c = XLSX.utils.sheet_to_json(wb.Sheets['Consommation']).find(r => r['Molécule'] === M);
  console.log(`Stock mission : début ${s['Stock début de mission']} | entrées ${s['Entrées pendant la mission']} | délivrées ${s['Délivrées au dispensaire']} | fin ${s['Stock fin de mission']}`);
  console.log(`Consommation : début ${c['Stock début']} | entrées ${c['Entrées']} | fin ${c['Stock fin']}`);
  await b.close();
})().catch(e => { console.error('ECHEC', e); process.exit(1); });
