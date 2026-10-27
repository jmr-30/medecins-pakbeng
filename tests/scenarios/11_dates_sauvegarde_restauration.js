const _path = require('path');
const APP = process.env.APP || _path.resolve(__dirname, '..', '..', 'index.html');
const DEMO = process.env.DEMO || _path.resolve(__dirname, '..', '..', 'demo', 'demo_data.json');
const _cr = require('./_chromium');
const { chromium } = require('playwright');
const XL = require('fs').readFileSync(require.resolve('xlsx/dist/xlsx.full.min.js'), 'utf8');
const URL = 'file://' + APP;
async function page(b, tz, heure) {
  const ctx = await b.newContext({ locale: 'fr-FR', timezoneId: tz, viewport: { width: 900, height: 1100 } });
  const p = await ctx.newPage(); await _cr.role(p); p.on('pageerror', e => console.log('ERR', e.message));
  if (heure) await p.clock.install({ time: new Date(heure) });
  await p.goto(URL); 
  if (heure) await p.clock.runFor(3000); else await p.waitForTimeout(2500);
  return p;
}
(async () => {
  const b = await chromium.launch(_cr({}));
  // ── 1. Dates : Vientiane à 01h00 locale le 15/10 (= 14/10 18h UTC) et Los Angeles
  for (const [tz, iso] of [['Asia/Vientiane', '2026-10-14T18:00:00Z'], ['America/Los_Angeles', '2026-10-15T08:00:00Z']]) {
    const p = await page(b, tz, iso);
    await p.addScriptTag({ content: XL });
    const r = await p.evaluate(() => {
      const ws = XLSX.utils.aoa_to_sheet([['Date', 'Date texte'], [new Date(2026, 9, 15), '2026-10-15']], { cellDates: true });
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'C');
      const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const row = XLSX.utils.sheet_to_json(XLSX.read(buf, { type: 'array', cellDates: true }).Sheets.C)[0];
      return { auj: dateAujourdhui(), finMission: missionEstTerminee({ fin: dateAujourdhui() }), imp: formatDateImport(row['Date']), impSerial: formatDateImport(46310),
        aff: resumeSaisie('consultation', { nom: 'X', date: '2026-10-15' }), per: formatDateAffichage('2027-04-01'), fichier: nomFichierJSON() };
    });
    console.log(tz, JSON.stringify(r));
    await p.context().close();
  }
  // ── 2. Sauvegarde automatique (dossier simulé), 3. perte, 4. import ancien
  const p = await page(b, 'Asia/Vientiane');
  console.log('Stockage :', await p.evaluate(() => _etatStockage));
  await p.evaluate(() => {
    window.__ecrits = [];
    _driveDirectoryHandle = { name: 'Sauvegardes', getFileHandle: async (nom) => ({ createWritable: async () => ({ write: async (bl) => { window.__ecrits.push({ nom, taille: bl.size }); }, close: async () => {} }) }),
      queryPermission: async () => 'granted', requestPermission: async () => 'granted' };
    _dossierAutorise = true; window.__autoValider = true;
    localStorage.setItem('mission_active', JSON.stringify({ numero: 'M', debut: '2026-01-01', fin: '2027-12-31' }));
  });
  const consult = async (nom) => p.evaluate(async nom => {
    goScreen('consultation'); effacerConsultation();
    COMBOS.c_lieu.setValue('Dispensaire Pakbeng'); COMBOS.c_med1.setValue('Dr. Martin');
    document.getElementById('c_nom').value = nom; document.getElementById('c_age').value = 30; document.getElementById('c_genre').value = 'Masculin';
    COMBOS.presc_mol_1.setValue('PARACETAMOL — 500 mg — cpr'); document.getElementById('presc_qty_1').value = 10;
    await new Promise(r => setTimeout(r, 400)); await enregistrerConsultation(); await new Promise(r => setTimeout(r, 400));
  }, nom);
  await consult('ALPHA');
  await p.waitForTimeout(22000);
  console.log('Écritures auto :', JSON.stringify(await p.evaluate(() => window.__ecrits)), '| connu :', await p.evaluate(() => localStorage.getItem('nbConsultationsConnu')));
  await p.evaluate(() => goScreen('parametres')); await p.waitForTimeout(300);
  console.log('Paramètres :', (await p.textContent('#etatProtection')).replace(/\s+/g, ' ').slice(0, 220));
  await p.evaluate(() => { _dossierAutorise = false; majRappelExport(); });
  console.log('Rappel pause :', await p.textContent('#exportReminderSub'), '|', await p.textContent('.export-reminder-btn'));
  // Import ancien : sauvegarde avec ALPHA, puis BETA ajouté et ALPHA annulé
  const vieux = await p.evaluate(async () => await (await genererBlobJSON()).text());
  require('fs').writeFileSync(require('os').tmpdir() + '/vieux.json', vieux);
  await p.waitForTimeout(1100);
  await consult('BETA');
  await p.evaluate(async () => { const a = (await dbGetAll('consultations')).find(c => c.nom === 'ALPHA'); await annulerConsultation(a.id, ''); });
  await p.evaluate(() => { window.__autoValider = false; });
  await (await p.$('#importJSONFile')).setInputFiles(require('os').tmpdir() + '/vieux.json'); await p.waitForTimeout(800);
  console.log('Avertissement :', (await p.textContent('#dlgMsg')).slice(0, 140).replace(/\n/g, ' '));
  await p.click('#dlgOk'); await p.waitForTimeout(2500);
  console.log('Après import :', JSON.stringify(await p.evaluate(async () => (await dbGetAll('consultations')).map(c => c.nom))), '|', await p.textContent('#toast'));
  // Perte : base vidée mais compteur connu
  await p.evaluate(async () => { for (const c of await dbGetAll('consultations')) await dbDelete('consultations', c.id); });
  await p.reload(); await p.waitForTimeout(3500);
  console.log('Perte détectée :', await p.isVisible('#dlg.ouvert'), '|', await p.textContent('#dlgTitre'), '|', (await p.textContent('#dlgMsg')).slice(0, 80).replace(/\n/g, ' '));
  await p.click('#dlgAnnuler'); await p.waitForTimeout(500);
  console.log('Ensuite :', await p.isVisible('#dlg.ouvert'), '|', await p.textContent('#dlgTitre'), '|', (await p.textContent('#dlgMsg')).slice(0, 90).replace(/\n/g, ' '));
  await b.close();
})();
