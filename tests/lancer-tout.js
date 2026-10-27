// Lance tous les scénarios de test et vérifie leurs résultats.
// Usage : node lancer-tout.js            (tous les scénarios)
//         node lancer-tout.js 07 09      (seulement les scénarios dont le nom commence par 07 ou 09)
// Variables facultatives : APP (chemin de l'app, par défaut index.html du dépôt), DEMO (par défaut demo/demo_data.json), SITE, CHROMIUM (navigateur).
const { spawnSync } = require('child_process');
const path = require('path'), fs = require('fs');

// Pour chaque scénario : les phrases qui DOIVENT apparaître dans le résultat.
const ATTENDUS = {
  '01_consultation_saisie': ['Village ajouté : true', 'Modif pré-remplie : Ban Nouveau', 'Après modif : TA 13/8 | journal : Examen clinique', 'Renommage répercuté : Ban Nouveau Renommé', '1 patient trouvé'],
  '02_identifiant_patient': ['Même patient 1 et 2 : true | homonyme différent : true', 'Patient déjà connu'],
  '03_stock_fiches_inventaire': ['Non suivi absent de la commande : true', 'Placeholder qté : Plaq. | option lot : Exp. 05/2027 · 12 plaq.', 'Après inventaire : Exp. 02/2028 1200 | Exp. 10/2028 2015 | Exp. 05/2029 30', 'Sorties « Inventaire » : 1 | brouillon vidé : true'],
  '04_consommables': ['Articles : 70 | ajouté : true', 'Modifié : Abaisse langue'],
  '05_rapport_fin_mission': ['Unités délivrées au dispensaire : 100', 'Unités délivrées dans les villages : 40', 'Moteur (contrôle) : Exp. 02/2028 1090 | Exp. 10/2028 2000', '"Qté à commander":4910'],
  '06_navigation': ['reception     → Autres fonctions / Accueil : oui / oui', 'Clic « Autres fonctions » → screen-plus'],
  '07_fiche_constantes_allergies': ['IMC : 23,7', 'Confirmation — allergie : true | constantes : true', 'Reprise fiche : Pénicilline | HTA depuis 2019', 'Tension : 165/95 (07/2025) → 142/88 (07/2026)', '« aucune connue » ne déclenche rien : true'],
  '08_suivi_grossesse_fiche_patient': ['Confirmation grossesse : true', 'AINS / aspirine', 'Accueil : 2 patients · 1 en retard', 'Après revisite, reste : 1', 'Écran fiche active : true', 'Tous : 6 patients trouvés (7 consultations) | cartes : 6', 'Après modif, écran fiche : true | note visible : true', 'Alerte allergie : true'],
  '09_posologie_consigne': ['Qté auto 1-0-1 × 10 j : 20', 'Avec ½ au coucher : 25', 'Qté manuelle conservée : 25', 'Repris : AMOXICILLINE — 500 mg — gélule 20 1 1 10 au repas', 'Modale consigne cachée : none', 'Bandeau après enregistrement : block KEO Lan | formulaire vidé : true'],
  '10_fenetres_dialogue': ['Dialogue import visible : true | Restaurer cette sauvegarde ? | Fusionner', 'Échap → fermé : true | toujours là : true', 'Annulée : true | motif journal : doublon de saisie', 'boîtes natives : 0'],
  '11_dates_sauvegarde_restauration': ['Asia/Vientiane {"auj":"2026-10-15","finMission":false,"imp":"2026-10-15","impSerial":"2026-10-15","aff":"X  — 15/10/2026"', 'America/Los_Angeles {"auj":"2026-10-15","finMission":false,"imp":"2026-10-15"', 'Écritures auto : [{"nom":"Pakbeng_tablette_auto_', 'Rappel pause : ⏸ Sauvegarde automatique en pause', '1 saisie(s) annulée(s) ignorée(s)', 'Après import : ["BETA"]', 'Les données semblent avoir disparu'],
  '12_import_demo': ['{"c":32,', '"m":"Mission 9","arv":12,"fiche":"plaquette"}'],
  '14_app_installable_hors_ligne': ['Contrôlée par le service worker : true', 'standalone / 3 icônes', 'Hors ligne : {"consultations":32,"excel":true}', 'Partage : ["Pakbeng_tablette.json","Pakbeng_tablette_export.xlsx"]', 'Nouvelle version téléchargée', '2e démarrage : Les Médecins de Pakbeng v2'],
  '13_reinitialisation': ['Mot faux → intact : {"c":32', 'Contenu sauvegarde : 32 consultations', 'Après redémarrage : {"c":0,"r":319,"m":""', '✅ Application réinitialisée', 'Après restauration : {"c":32,"r":323,"m":"Mission 9"', 'Stock pré-chargé Mission 8 avant/après : 319 → 0 | nouveau stock initial : 1 | boîtes natives : 0'],
  '15_reprise_relais': ['Question rôle : true | Quel est cet appareil ? | tablette/pharmacie/autre', 'Rôle choisi : pharmacie | Pakbeng_pharmacie_DATE.json', 'Fichier vendredi : Pakbeng_tablette_DATE.json | provenance : Tablette du dispensaire', 'Pharmacie après reprise : {"c":32,"r":323,"s":2,"m":"Mission 9","role":"pharmacie"}', 'Fichier dimanche : provenance Appareil de la pharmacienne | base tablette', 'Tablette lundi : {"c":33,"r":323,"s":2,"m":"Mission 9","role":"tablette"}', 'Relais : {"annuleAbsente":true,"corrige":777,"lyon":1,"lundi":1,"reprise":true,"annulJournal":true}', 'Copie de sécurité : Pakbeng_tablette_avant_reprise_DATE.json', 'Message provenance : true | base : true | conservée : true', 'Après « Retour » : {"c":34,'],
  '16_suggestions_patients': ['1 lettre : false', '« Kampou » → ["KHAMPHOUI Vanh"]', '« Noy » (prénom) → ["NOY Phet","KHAM Noy","LATH Noy"]', 'Après choix : {"nom":"KHAMPHOUI","prenom":"Vanh","genre":"Masculin"', '"liste":"none","bandeau":"✅ Patient déjà vu — 2 consultations', 'Patient déjà connu', 'Même identifiant : true', 'Liste fermée après choix : true', 'Annulation : {"nom":"","prenom":"","age":"","village":"","bandeau":"none","focus":"c_nom"}', 'après « Aucun de ces patients » : false | saisie gardée : Kh', 'Recherche « kampoui » : true'],
};

const filtres = process.argv.slice(2);
const dir = path.join(__dirname, 'scenarios');
const fichiers = fs.readdirSync(dir).filter(f => /^\d\d_.*\.js$/.test(f) && (!filtres.length || filtres.some(x => f.startsWith(x)))).sort();
let echecs = 0;
for (const f of fichiers) {
  const nom = f.replace(/\.js$/, ''), t0 = Date.now();
  const r = spawnSync(process.execPath, [path.join(dir, f)], { encoding: 'utf8', timeout: 300000, env: process.env });
  const out = (r.stdout || '') + (r.stderr || '');
  const pbs = [];
  if (r.status !== 0) pbs.push(`code de sortie ${r.status}${r.error ? ' (' + r.error.message + ')' : ''}`);
  if (/^ERR /m.test(out)) pbs.push('erreur JavaScript dans la page : ' + out.match(/^ERR .*/m)[0]);
  const lErr = out.match(/^Erreurs[^:]*: (.*)$/m);
  if (lErr && lErr[1].trim() !== 'aucune') pbs.push('erreurs signalées : ' + lErr[1]);
  for (const a of ATTENDUS[nom] || []) if (!out.includes(a)) pbs.push('attendu non trouvé : « ' + a + ' »');
  const s = ((Date.now() - t0) / 1000).toFixed(0);
  if (pbs.length) { echecs++; console.log(`✗ ${nom} (${s} s)\n    - ${pbs.join('\n    - ')}`); if (process.env.DETAIL) console.log(out); }
  else console.log(`✓ ${nom} (${s} s)`);
}
console.log(echecs ? `\n${echecs} scénario(s) en échec sur ${fichiers.length}.` : `\nTous les scénarios réussissent (${fichiers.length}).`);
process.exit(echecs ? 1 : 0);
