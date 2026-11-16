// Consultation identique déjà enregistrée : avertissement à l'enregistrement et à la reprise d'un brouillon
const { chromium } = require('playwright');
const R = require('./_relais');
(async () => {
  const b = await chromium.launch(R.cr({}));
  const p = await R.appareil(b, 'tablette');
  await p.evaluate(() => localStorage.setItem('mission_active', JSON.stringify({ numero: 'Mission 9', debut: '2020-01-01', fin: '2099-01-01' })));
  const MOL = await p.evaluate(async () => Object.entries(await calculerStock()).find(([m, l]) => stockDisponible(l) > 50 && uniteDe(m) !== 'plaquette')[0]);
  const nb = nom => p.evaluate(async n => (await dbGetAll('consultations')).filter(c => normNomPatient(c.nom) === normNomPatient(n)).length, nom);
  const remplir = (nom, qte) => p.evaluate(async ([nom, qte, MOL]) => { goScreen('consultation'); effacerConsultation(); document.getElementById('c_date').value = dateAujourdhui(); document.getElementById('c_nom').value = nom; document.getElementById('c_prenom').value = 'Kham';
    COMBOS.c_lieu.setValue(REF.lieux[0]); COMBOS.c_med1.setValue((await getParam('medecins', REF.medecins))[0]); COMBOS.presc_mol_1.setValue(MOL); document.getElementById('presc_qty_1').value = qte; }, [nom, qte, MOL]);
  // Tente l'enregistrement : renvoie le titre de l'alerte éventuelle, et répond « garder » ou non
  const tenter = async (titre, enregistrerQuandMeme) => {
    await R.auto(p, false); await p.waitForTimeout(700);
    await p.evaluate(() => { confirmerAvantEnregistrement(); }); await p.waitForTimeout(600);
    const alerte = await p.isVisible('#dlg.ouvert'); const t = alerte ? (await p.textContent('#dlgTitre')).trim() : 'aucune alerte';
    if (alerte) { await p.click(enregistrerQuandMeme ? '#dlgOk' : '#dlgAnnuler'); await p.waitForTimeout(500); }
    if (await p.evaluate(() => document.getElementById('confirmModal').style.display === 'flex')) { await p.evaluate(() => enregistrerConsultation()); await p.waitForTimeout(900); }
    console.log(`${titre} : ${t} | SOMCHAI enregistrées : ${await nb('SOMCHAI')}`);
    await p.waitForTimeout(1600);
  };
  await remplir('SOMCHAI', '6'); await tenter('Première saisie', true);
  await remplir('SOMCHAI', '6'); await tenter('Même saisie refaite, abandonnée', false);
  await remplir('Somchaï', '6'); await tenter('Même saisie (nom écrit autrement), enregistrée quand même', true);
  await remplir('SOMCHAI', '10'); await tenter('Même patient, autre quantité (seconde visite)', true);

  // Brouillon resté après une fermeture brutale, alors que la consultation était enregistrée
  await remplir('BROUILLON', '6'); await p.evaluate(() => autosaverConsultation()); await p.waitForTimeout(3500);
  const brouillon = await p.evaluate(() => localStorage.getItem('brouillon_consultation'));
  await R.auto(p); await p.evaluate(async () => { await confirmerAvantEnregistrement(); await enregistrerConsultation(); }); await p.waitForTimeout(900);
  await p.evaluate(b => localStorage.setItem('brouillon_consultation', b), brouillon);
  await p.reload(); await p.waitForSelector('#dlg.ouvert', { timeout: 15000 }); await p.waitForTimeout(300);
  const msg = await p.textContent('#dlgMsg');
  console.log('Brouillon au redémarrage : signale la consultation déjà enregistrée :', /DÉJÀ été enregistrée/.test(msg), '| conseille d\'effacer :', /Effacer le brouillon/.test(msg));
  await p.click('#dlgAnnuler'); await p.waitForTimeout(500);
  console.log('Après « Effacer le brouillon » : brouillon effacé :', await p.evaluate(() => !localStorage.getItem('brouillon_consultation')), '| BROUILLON enregistrées :', await nb('BROUILLON'));
  // Un brouillon ordinaire (consultation jamais enregistrée) ne déclenche pas l'avertissement
  await p.evaluate(b => localStorage.setItem('brouillon_consultation', b.replace('BROUILLON', 'JAMAIS VU')), brouillon);
  await p.reload(); await p.waitForSelector('#dlg.ouvert', { timeout: 15000 }); await p.waitForTimeout(300);
  console.log('Brouillon ordinaire : avertissement :', /DÉJÀ/.test(await p.textContent('#dlgMsg')));
  await b.close();
})().catch(e => { console.error('ECHEC', e); process.exit(1); });
