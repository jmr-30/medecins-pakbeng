// Valeurs impossibles refusées, valeurs inhabituelles confirmées (consultation, réception, sortie)
const { chromium } = require('playwright');
const R = require('./_relais');
(async () => {
  const b = await chromium.launch(R.cr({}));
  const p = await R.appareil(b, 'tablette');
  await p.evaluate(() => localStorage.setItem('mission_active', JSON.stringify({ numero: 'Mission 9', debut: '2020-01-01', fin: '2099-01-01' })));
  const MOL = await p.evaluate(async () => Object.entries(await calculerStock()).find(([m, l]) => stockDisponible(l) > 50 && uniteDe(m) !== 'plaquette')[0]);
  await R.auto(p, false);
  const essai = async (titre, modif) => {
    await p.evaluate(async MOL => { goScreen('consultation'); effacerConsultation(); document.getElementById('c_date').value = dateAujourdhui(); document.getElementById('c_nom').value = 'TEST'; document.getElementById('c_age').value = '30';
      COMBOS.c_lieu.setValue(REF.lieux[0]); COMBOS.c_med1.setValue((await getParam('medecins', REF.medecins))[0]); COMBOS.presc_mol_1.setValue(MOL); document.getElementById('presc_qty_1').value = '6'; }, MOL);
    await p.waitForTimeout(600); await p.evaluate(modif); await p.evaluate(() => { document.getElementById('toast').textContent = ''; confirmerAvantEnregistrement(); }); await p.waitForTimeout(600);
    let issue;
    if (await p.isVisible('#dlg.ouvert')) { issue = `${(await p.textContent('#dlgTitre')).trim()} — ${(await p.textContent('#dlgMsg')).split('\n').filter(l => l.startsWith('•')).join(' ').replace(MOL, 'MÉDICAMENT')}`; await p.click('#dlgAnnuler'); await p.waitForTimeout(300); }
    else if (await p.evaluate(() => document.getElementById('confirmModal').style.display === 'flex')) { issue = 'accepté sans question'; await p.evaluate(() => fermerConfirmModal()); }
    else issue = 'refusé — ' + (await p.textContent('#toast')).trim().replace(MOL, 'MÉDICAMENT');
    console.log(`${titre} : ${issue}`);
  };
  await essai('Valeurs normales', () => {});
  await essai('Âge 350', () => { document.getElementById('c_age').value = '350'; });
  await essai('Âge −4', () => { document.getElementById('c_age').value = '-4'; });
  await essai('Quantité 100000', () => { document.getElementById('presc_qty_1').value = '100000'; });
  await essai('Quantité −5', () => { document.getElementById('presc_qty_1').value = '-5'; });
  await essai('Quantité 2,5', () => { document.getElementById('presc_qty_1').value = '2.5'; });
  await essai('Température 370', () => { document.getElementById('k_temp').value = '370'; });
  await essai('Âge 115 et tension 30', () => { document.getElementById('c_age').value = '115'; document.getElementById('k_tas').value = '30'; });
  // Réception
  const auj = await p.evaluate(() => dateAujourdhui());
  const reception = async (titre, date, per, q, garder) => {
    const n = await p.evaluate(async () => (await dbGetAll('receptions')).length);
    await p.evaluate(async ([MOL, date, per, q]) => { goScreen('reception'); document.getElementById('r_date').value = date; document.getElementById('r_fourn').selectedIndex = 1; COMBOS.r_mol.setValue(MOL);
      document.getElementById('r_perdate').value = per; document.getElementById('r_qty').value = q; enregistrerReception(); }, [MOL, date, per, q]);
    await p.waitForTimeout(600);
    let issue = 'acceptée sans question';
    if (await p.isVisible('#dlg.ouvert')) { issue = (await p.textContent('#dlgMsg')).split('\n').filter(l => l.startsWith('•')).map(l => l.split(' : ')[0]).join(' '); await p.click(garder ? '#dlgOk' : '#dlgAnnuler'); await p.waitForTimeout(700); }
    console.log(`${titre} : ${issue} | enregistrée : ${(await p.evaluate(async () => (await dbGetAll('receptions')).length)) - n}`);
    await p.evaluate(() => effacerReception()); await p.waitForTimeout(1600);
  };
  await reception('Réception normale', auj, '2031-01-01', '100', true);
  await reception('Réception déjà périmée, corrigée', auj, '2020-01-01', '10', false);
  await reception('Réception déjà périmée, confirmée', auj, '2020-01-01', '10', true);
  await reception('Réception future de 9 999 999', '2031-01-01', '2032-01-01', '9999999', false);
  await b.close();
})().catch(e => { console.error('ECHEC', e); process.exit(1); });
