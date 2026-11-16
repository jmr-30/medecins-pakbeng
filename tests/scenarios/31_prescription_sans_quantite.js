// Un médicament prescrit sans quantité est enregistré au dossier du patient, sans effet sur le stock
const { chromium } = require('playwright');
const R = require('./_relais');
(async () => {
  const b = await chromium.launch(R.cr({}));
  const p = await R.appareil(b, 'tablette');
  const r = await p.evaluate(async () => {
    const attendre = ms => new Promise(r => setTimeout(r, ms));
    localStorage.setItem('mission_active', JSON.stringify({ numero: 'Mission 9', debut: '2020-01-01', fin: '2099-01-01' }));
    const mols = await getParam('molecules', REF.molecules);
    const avecStock = Object.entries(await calculerStock()).find(([m, l]) => stockDisponible(l) > 20)[0], autre = mols.find(m => m !== avecStock);
    const total = async m => Object.values((await calculerStock())[m] || {}).reduce((a, l) => a + l.restant, 0);
    const avant = [await total(avecStock), await total(autre)];
    goScreen('consultation');
    document.getElementById('c_date').value = dateAujourdhui(); document.getElementById('c_nom').value = 'SANSQTE';
    COMBOS.c_lieu.setValue(REF.lieux[0]); COMBOS.c_med1.setValue((await getParam('medecins', REF.medecins))[0]);
    COMBOS.presc_mol_1.setValue(avecStock); document.getElementById('presc_qty_1').value = '6';
    COMBOS.presc_mol_2.setValue(autre); document.getElementById('presc_qty_2').value = '';
    await attendre(600);
    await confirmerAvantEnregistrement(); await attendre(600);
    const resume = document.getElementById('confirmResume').textContent.includes('sans quantité : noté au dossier, rien n\'est retiré du stock');
    await enregistrerConsultation(); await attendre(900);
    let c = (await dbGetAll('consultations')).find(x => x.nom === 'SANSQTE');
    const lignes = c.prescription.map(l => `${l.molecule === avecStock ? 'A' : 'B'} ×${l.quantite} lots:${l.lots.length}`).join(' | ');
    const stock = [await total(avecStock) - avant[0], await total(autre) - avant[1]];
    const fantome = !!((await calculerStock())[autre] || {})['(sans lot)'];
    const wb = await genererWorkbook();
    const exp = XLSX.utils.sheet_to_json(wb.Sheets['Consultations']).find(x => x['Nom'] === 'SANSQTE');
    // Modification (correction du nom) : la ligne sans quantité est toujours là
    await modifierConsultation(c.id, 'recherche'); await attendre(900);
    document.getElementById('c_nom').value = 'SANSQTE CORRIGE';
    await enregistrerConsultation(); await attendre(900);
    c = (await dbGetAll('consultations')).find(x => x.nom === 'SANSQTE CORRIGE');
    return { resume, lignes, stock, fantome, exportB: exp['Molécule 2'] === autre && !exp['Qté 2'], apresModif: c.prescription.map(l => `${l.molecule === avecStock ? 'A' : 'B'} ×${l.quantite}`).join(' | '),
      stockApresModif: [await total(avecStock) - avant[0], await total(autre) - avant[1]] };
  });
  console.log('Confirmation : ligne sans quantité annoncée :', r.resume);
  console.log('Enregistré :', r.lignes);
  console.log('Variation du stock (A, B) :', JSON.stringify(r.stock), '| lot fantôme :', r.fantome, '| export Excel : médicament présent, quantité vide :', r.exportB);
  console.log('Après modification :', r.apresModif, '| variation du stock :', JSON.stringify(r.stockApresModif));
  await b.close();
})().catch(e => { console.error('ECHEC', e); process.exit(1); });
