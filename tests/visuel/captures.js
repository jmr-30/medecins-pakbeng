const fs = require('fs'), path = require('path');
// Captures de tous les écrans (portrait + paysage) pour comparaison avant/après
const { chromium } = require('playwright');
// Usage : node visuel/captures.js <dossier de sortie> [chemin de l'app] [chemin de la démo]
const APP = path.resolve(process.argv[3] || path.join(__dirname, '..', '..', 'index.html'));
const OUT = path.resolve(process.argv[2] || 'captures');
const DEMO = path.resolve(process.argv[4] || path.join(__dirname, '..', '..', 'demo', 'demo_data.json'));
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const b = await chromium.launch(require('../scenarios/_chromium')({ args: ['--lang=fr-FR', '--font-render-hinting=none'] }));
  for (const [w, h, o] of [[800, 1280, 'P'], [1280, 800, 'L']]) {
    const ctx = await b.newContext({ locale: 'fr-FR', timezoneId: 'Asia/Vientiane', viewport: { width: w, height: h }, hasTouch: true });
    await ctx.route(/^https?:/, r => r.abort());
    const p = await ctx.newPage(); await require('../scenarios/_chromium').role(p); p.on('pageerror', e => console.log('ERR', o, e.message));
    await p.clock.setFixedTime(new Date('2026-10-23T10:00:00+07:00'));
    await p.goto('file://' + APP); await p.waitForTimeout(2500);
    await p.addStyleTag({ content: '*{animation:none!important;transition:none!important;caret-color:transparent!important} #toast{display:none!important}' });
    await p.evaluate(() => { window.__autoValider = true; });
    await (await p.$('#importJSONFile')).setInputFiles(DEMO); await p.waitForTimeout(3000);
    const shot = async n => { await p.waitForTimeout(500); await p.screenshot({ path: path.join(OUT, `${o}_${n}.png`), fullPage: true }); };
    const ecrans = ['accueil', 'plus', 'recherche', 'arevoir', 'stock', 'reception', 'sortie', 'inventaire', 'consommables', 'parametres', 'stock_config', 'historique', 'stats', 'commande', 'mission'];
    for (const e of ecrans) {
      await p.evaluate(e => { e === 'accueil' ? goAccueil() : goScreen(e); window.scrollTo(0, 0); }, e);
      if (e === 'recherche') await p.evaluate(() => lancerRecherche());
      if (e === 'stats') await p.evaluate(() => { document.getElementById('st_du').value = '2026-06-01'; try { calculerStats(); } catch (x) {} });
      if (e === 'historique') await p.waitForTimeout(500);
      await shot(e);
    }
    // Consultation remplie
    await p.evaluate(() => { goScreen('consultation'); effacerConsultation(); masquerDerniereConsigne(); });
    await shot('consultation_vide');
    await p.fill('#c_nom', 'SOUK'); await p.fill('#c_prenom', 'Kham'); await p.fill('#c_age', '49'); await p.selectOption('#c_genre', 'Masculin');
    await p.waitForTimeout(1500);
    await p.evaluate(async () => { COMBOS.spec_1.setValue('CARDIO-VASCULAIRE'); majPathologies(1, 'CARDIO-VASCULAIRE'); await new Promise(r => setTimeout(r, 50)); COMBOS.patho_1.setValue('HTA');
      COMBOS.presc_mol_1.setValue('AMLODIPINE — 5 mg — cpr'); COMBOS.presc_mol_2.setValue('AMOXICILLINE — 500 mg — gélule'); });
    await p.fill('#presc_pm_1', '1'); await p.fill('#presc_pj_1', '30'); await p.fill('#presc_pm_2', '1'); await p.fill('#presc_ps_2', '1'); await p.fill('#presc_pj_2', '7');
    await p.fill('#k_poids', '68'); await p.fill('#k_temp', '45'); await p.check('#c_arevoir'); await p.check('#c_orient');
    await p.waitForTimeout(800);
    await shot('consultation_remplie');
    await p.evaluate(() => { afficherConsignePatient(); }); await shot('consigne');
    await p.evaluate(() => { montrerConsigne(0); }); await shot('montrer');
    await p.evaluate(() => { fermerMontrerConsigne(); window.__autoValider = false; confirmerAvantEnregistrement(); }); await shot('verification');
    await p.evaluate(() => { fermerConfirmModal(); effacerConsultation(); });
    // grossesse
    await p.fill('#c_nom', 'PHET'); await p.fill('#c_age', '27'); await p.selectOption('#c_genre', 'Féminin'); await p.selectOption('#c_grossesse', 'Enceinte'); await p.fill('#c_grossesse_sa', '22');
    await p.evaluate(() => { window.scrollTo(0, 0); }); await shot('grossesse');
    await p.evaluate(() => effacerConsultation());
    // Fiche patient et dialogue
    const id = await p.evaluate(async () => (await dbGetAll('consultations')).find(c => c.nom === 'SOUK').id);
    await p.evaluate(id => ouvrirFichePatient(id, 'recherche'), id); await shot('fiche_patient');
    await p.evaluate(id => { annulerConsultation(id, 'patient'); }, id); await shot('dialogue');
    await p.evaluate(() => document.getElementById('dlgAnnuler').click());
    // Stock : lots dépliés
    await p.evaluate(() => { goScreen('stock'); }); await p.waitForTimeout(1200);
    await p.evaluate(() => { const r = document.querySelector('tr.stock-mol-row[data-mol^="AMLODIPINE — 5 mg"]'); toggleLots(r.dataset.molIdx); r.scrollIntoView({ block: 'start' }); });
    await p.waitForTimeout(400); await p.screenshot({ path: path.join(OUT, `${o}_stock_lots.png`) });
    await ctx.close();
  }
  await b.close();
})();
