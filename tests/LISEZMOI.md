# Tests automatiques — Médecins de Pakbeng

Ces tests vérifient en quelques minutes que l'application fonctionne toujours après une modification.
Ils utilisent uniquement des **patients fictifs**, dans un navigateur à part : ils ne touchent jamais
aux données de la tablette et ne modifient pas le fichier de l'application.

## Ce qu'il faut

- Un ordinateur (Windows, Mac ou Linux) avec **Node.js** version 18 ou plus récente (https://nodejs.org).
- Une connexion Internet la première fois, pour installer les outils.
- Le dépôt GitHub `jmr-30/medecins-pakbeng`, dont les fichiers sont rangés ainsi :

```
index.html           ← l'application (celle publiée sur GitHub Pages)
manifest.webmanifest, sw.js, icons/, lib/   ← le reste du site (scénario 14)
demo/demo_data.json  ← les données fictives
tests/               ← ce dossier
```

## Installer (une seule fois)

Ouvrir un terminal dans le dossier `tests`, puis :

```
npm install
npx playwright install chromium
```

## Lancer les tests

```
npm test
```

Chaque scénario affiche ✓ (réussi) ou ✗ (échec) avec la raison. Compter environ 3 minutes.

- Lancer seulement certains scénarios : `node lancer-tout.js 07 09`
- Voir tout le détail d'un échec : `DETAIL=1 node lancer-tout.js 09` (sous Windows : `set DETAIL=1` puis la commande)
- Tester une autre copie de l'application : `APP=/chemin/vers/MedecinsPakbeng.html npm test` (par défaut : `index.html` du dépôt)

## Ce que vérifie chaque scénario

| N° | Scénario | Ce qui est vérifié |
|---|---|---|
| 01 | Saisie d'une consultation | lieu d'habitation, ajout d'un village, protection des textes saisis, recherche, modification, journal, renommage |
| 02 | Identifiant patient | même patient reconnu d'une visite à l'autre, homonymes distingués |
| 03 | Stock, fiches, inventaire | fiche médicament, plaquettes, médicaments non suivis, commande, inventaire lot par lot |
| 04 | Consommables | inventaire, ajout, modification d'un article |
| 05 | Rapport de fin de mission | chiffres de la synthèse, consommation, commande, cohérence avec le stock |
| 06 | Navigation | boutons « Autres fonctions » et « Accueil » sur chaque écran |
| 07 | Fiche patient et constantes | IMC, contrôles de valeurs, allergies, reprise de la fiche, évolution des constantes |
| 08 | Suivi, grossesse, fiche patient | patients à revoir, orientation, alertes grossesse, médicaments habituels, rapport, recherche par patient, fiche complète |
| 09 | Posologie et consigne | calcul des quantités, fractions, reprise de prescription, consigne et « Montrer au patient » |
| 10 | Fenêtres de dialogue | fenêtres intégrées, Échap, motif d'annulation, brouillon (aucune boîte du navigateur) |
| 11 | Dates, sauvegarde, restauration | heure du Laos et d'ailleurs, import Excel, sauvegarde automatique, sauvegarde ancienne, détection de perte |
| 12 | Données de démonstration | import complet du fichier de démo |
| 14 | Application installable | (dossier `site/`) installation, fonctionnement hors ligne, Excel hors ligne, partage de la sauvegarde, arrivée d'une nouvelle version |
| 15 | Passage de relais | rôle de l'appareil demandé au premier lancement, noms de fichiers `Pakbeng_tablette_…` / `Pakbeng_pharmacie_…`, reprise tablette → pharmacienne → tablette : annulation et correction de la pharmacienne reportées, consultation saisie entre-temps conservée, copie de sécurité |
| 16 | Suggestions de patients | liste des patients déjà vus dès 2 lettres, variantes de transcription (« Kampou » → KHAMPHOUI), prénom tapé dans le champ nom, choix et annulation, recherche tolérante |
| 13 | Réinitialisation | sauvegarde préalable, mot de confirmation, effacement, restauration enchaînée, stock initial non doublé |

Les scénarios 01 à 09 tournent dans un navigateur simulé ; 10 à 16 dans un vrai navigateur (Chromium).

## Contrôle visuel (facultatif, pour les retouches d'apparence)

Il compare l'apparence de 24 écrans, en hauteur et en largeur, avant et après une modification.
Il demande en plus Python et la bibliothèque Pillow (`pip install pillow`).

```
node visuel/captures.js avant        ← AVANT la modification
node visuel/captures.js apres        ← APRÈS la modification
python visuel/compare.py avant apres
```

Le résultat est « IDENTIQUE », ou la liste des écrans qui ont changé et la zone concernée.

## Si un test échoue

1. Lire la raison affichée : elle indique la phrase attendue qui n'a pas été trouvée.
2. Si la modification de l'application **ne devait pas** changer ce comportement : c'est une régression à corriger.
3. Si le changement **est voulu** (un libellé renommé, un calcul modifié volontairement) : mettre à jour la phrase
   attendue dans `lancer-tout.js` (tableau `ATTENDUS` en tête de fichier), puis relancer.
