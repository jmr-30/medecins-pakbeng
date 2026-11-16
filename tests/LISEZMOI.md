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
| 11 | Dates, sauvegarde, restauration | heure du Laos et d'ailleurs, sauvegarde automatique, sauvegarde ancienne, détection de perte |
| 12 | Données de démonstration | import complet du fichier de démo |
| 14 | Application installable | (dossier `site/`) installation, fonctionnement hors ligne, Excel hors ligne, partage de la sauvegarde, arrivée d'une nouvelle version |
| 15 | Passage de relais | rôle de l'appareil demandé au premier lancement, noms de fichiers `Pakbeng_tablette_…` / `Pakbeng_pharmacie_…`, reprise tablette → pharmacienne → tablette : annulation et correction de la pharmacienne reportées, consultation saisie entre-temps conservée, copie de sécurité |
| 16 | Suggestions de patients | liste des patients déjà vus dès 2 lettres, variantes de transcription (« Kampou » → KHAMPHOUI), prénom tapé dans le champ nom, choix et annulation, recherche tolérante |
| 13 | Réinitialisation | sauvegarde préalable, mot de confirmation, effacement, restauration enchaînée, stock initial non doublé |
| 18 | Reprise d'un fichier invalide | fichier tronqué, mal formé ou d'une ancienne version refusé avant toute écriture ; panne en cours d'écriture : rien n'est modifié (tout ou rien) |
| 19 | Reprise : contrôle de la date | fichier plus ancien que celui déjà repris refusé, fichier déjà repris signalé, fichier sans date refusé, fichier plus récent accepté, retour en arrière avec la copie « avant_reprise » |
| 20 | Annuler la dernière reprise | copie interne des données d'avant la reprise, jamais exportée ; annulation : données d'avant retrouvées, saisies faites depuis conservées, nouvelle reprise possible |
| 21 | Reprise : annulations locales | une consultation et une réception annulées sur la tablette après l'envoi du fichier ne reviennent pas avec le fichier de la pharmacienne ; stock inchangé |
| 22 | Reprise : noms corrigés | médicament renommé par la pharmacienne reporté sur la consultation saisie entre-temps (stock sous un seul nom) ; médecin renommé sur la tablette reporté sur les données reprises ; journal au format actuel et ancien |
| 23 | Reprise : listes | village, médecin, hôpital et fournisseur utilisés par une saisie faite entre-temps gardés dans les listes ; mission créée sur la tablette gardée ; nom retiré par la pharmacienne non réintroduit |
| 24 | Restaurer .json réservé à un appareil vide | appareil neuf : restauration directe ; appareil en service : renvoi vers la reprise, stock initial réimporté par la pharmacienne non compté deux fois |
| 25 | Plus d'import Excel des données | bouton, fenêtre et code d'import retirés ; export Excel et import du stock initial conservés |
| 26 | Stock initial chargé une seule fois | premier lancement interrompu : rien d'enregistré, puis chargement complet ; repère gardé dans la base : pas de second chargement si les préférences du navigateur sont perdues |
| 27 | Écriture confirmée après validation | ajout, modification, réglage et suppression confirmés seulement une fois la transaction validée, en durabilité stricte ; transaction annulée signalée en erreur |
| 28 | Base incomplète jamais effacée | une partie de la base manque : rien n'est supprimé, message clair au démarrage, sauvegarde de secours de ce qui est lisible |
| 29 | Inventaire : solde des « à régulariser » | quantités délivrées au-delà du stock connu soldées quand tous les lots du médicament sont comptés, pas avant ; entrée « Inventaire » traçable ; stock juste après une réception |
| 30 | Sortie sur un lot existant | le lot se choisit dans la liste des lots du médicament ; quantité supérieure au lot refusée ; médicament sans stock refusé ; aucun lot fantôme, la délivrance suivante voit le vrai stock |
| 31 | Prescription sans quantité | le médicament prescrit sans quantité est enregistré au dossier, annoncé à la confirmation, sans effet sur le stock ; conservé après modification |
| 32 | Modification : lots conservés | corriger le nom d'un patient ne redistribue pas la délivrance (lot périmé depuis conservé) ; une quantité modifiée est resservie en FEFO |
| 33 | Import du stock initial et renommage : tout ou rien | import interrompu : l'ancien stock initial reste entier ; renommage interrompu : aucun enregistrement renommé ; puis opérations complètes |
| 34 | Anomalies de stock | l'écran Stock liste les quantités à régulariser, lots jamais reçus ou négatifs, dates illisibles et noms hors liste ; rien d'affiché sur un stock sain ; l'inventaire fait disparaître l'anomalie |
| 35 | Points mineurs | périmés annoncés dans le stock et couleur selon le stock utilisable ; plaquettes dans les libellés ; historique des inventaires par sorte ; consultation de plus de 5 médicaments jamais tronquée |
| 36 | **Mission fictive complète** | paramétrage par la pharmacienne, deux semaines de saisies à cheval sur deux mois, FEFO, réception, casse, corrections, annulations, relais vendredi/lundi, inventaire, export Excel, rapport de fin de mission, restauration sur un appareil neuf ; le stock de l'application est comparé à chaque étape à un registre tenu par le test |

Les scénarios 01 à 09 tournent dans un navigateur simulé ; 10 à 36 dans un vrai navigateur (Chromium).
Les scénarios 18 à 35 vérifient les corrections de l'audit de novembre 2026 ; ceux du passage de relais partagent les outils de `scenarios/_relais.js`.

Le scénario 36 joue une mission entière. Pour le lancer seul : `node lancer-tout.js 36` (une minute environ). Il tient sa propre comptabilité du stock et s'arrête en échec au moindre écart.

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
