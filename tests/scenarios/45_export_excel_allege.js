// Export Excel allégé : mêmes feuilles, mêmes colonnes, mêmes valeurs ; cases vides non écrites, fichier compressé
const { chromium } = require('playwright');
const XLSX = require('xlsx');
const R = require('./_relais');
(async () => {
  const b = await chromium.launch(R.cr({}));
  const p = await R.appareil(b, 'tablette', true);
  await p.evaluate(async () => { await dbAdd('consultations', { date: '2026-11-03', nom: 'SEULE', age: 0, createdAt: 'z' }); });   // presque tout vide, âge 0
  const r = await p.evaluate(async () => {
    const wb = await genererWorkbook();
    // Référence : l'ancienne écriture (toutes les cases, y compris vides, sans compression), reconstruite à partir des mêmes lignes
    const lignes = n => XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '' });
    const ancien = XLSX.utils.book_new(); wb.SheetNames.forEach(n => XLSX.utils.book_append_sheet(ancien, XLSX.utils.aoa_to_sheet(lignes(n)), n));
    const octets = XLSX.write(wb, { bookType: 'xlsx', type: 'array', ...OPT_XLSX });
    return { nouveau: Array.from(new Uint8Array(octets)), tailleAncien: XLSX.write(ancien, { bookType: 'xlsx', type: 'array' }).byteLength,
      attendu: Object.fromEntries(wb.SheetNames.map(n => [n, lignes(n)])), base: [(await dbGetAll('consultations')).length, (await dbGetAll('receptions')).length, (await dbGetAll('sorties')).length] };
  });
  // Le fichier est relu comme le ferait un tableur
  const relu = XLSX.read(Buffer.from(r.nouveau), { type: 'buffer' });
  const feuilles = Object.fromEntries(relu.SheetNames.map(n => [n, XLSX.utils.sheet_to_json(relu.Sheets[n], { header: 1, defval: '' })]));
  console.log('Feuilles :', relu.SheetNames.join(', '), '| lignes :', relu.SheetNames.map(n => feuilles[n].length - 1).join('/'), '| base :', r.base.join('/'));
  console.log('Colonnes : consultations', feuilles.Consultations[0].length, '| réceptions', feuilles.Receptions[0].join(', '));
  console.log('Valeurs identiques, case par case :', relu.SheetNames.every(n => JSON.stringify(feuilles[n]) === JSON.stringify(r.attendu[n])));
  const seule = XLSX.utils.sheet_to_json(relu.Sheets.Consultations, { defval: '' }).find(l => l.Nom === 'SEULE');
  console.log('Consultation presque vide : âge', JSON.stringify(seule['Âge']), '| prénom', JSON.stringify(seule['Prénom']), '| mission', JSON.stringify(seule['Mission']));
  console.log('Fichier au moins trois fois plus léger :', r.nouveau.length * 3 < r.tailleAncien, process.env.DETAIL ? `(${r.tailleAncien} → ${r.nouveau.length} octets)` : '');
  // Base vide : l'export reste possible
  const vide = await R.appareil(b, 'tablette');
  console.log('Base sans consultation :', await vide.evaluate(async () => { const wb = await genererWorkbook(); XLSX.write(wb, { bookType: 'xlsx', type: 'array', ...OPT_XLSX }); return wb.SheetNames.join(', '); }));
  await b.close();
})().catch(e => { console.error('ECHEC', e); process.exit(1); });
