# Audit responsive — 20 novembre 2026

Deuxième passage, après le premier audit du 23 octobre (PR #8). Il couvre toutes les pages ajoutées depuis :
portail public des fidèles (accueil, horaires, places, kiddouch, salons, galerie, à propos, communauté, mentions,
confidentialité), plan de salle dessiné, éditeur de plan (iframe), Kiddouch & salons, onglets Journal et Portail
de l'Administration. Données fictives (`qa-mobile/fixtures.cjs`), aucun appel à Firebase, HelloAsso ni aux e-mails.

Périmètre : 62 états de pages (`pages.md`) × 10 appareils = 615 combinaisons. Appareils : Galaxy S9+ (320 px),
Galaxy S8 (360), iPhone SE (375), iPhone 13 (390), Pixel 7 (412), iPhone 14 Pro Max (430), iPhone 13 en paysage,
iPad Mini (768), iPad Mini en paysage (1024), ordinateur (1366 px, souris).

## Résultat

| Mesure | Avant | Après |
|---|---|---|
| Débordement horizontal de la page | 0 | 0 |
| Champs sous 16 px sur écran tactile | 1 état (éditeur de plan) | 0 |
| Élément recouvert | 0 | 0 |
| Erreurs JavaScript / requêtes en échec | 0 | 0 |
| Cibles tactiles < 24 px | 108 états | 0 |
| Cibles tactiles 24 à 43 px | 21 états | 30 états, tous acceptés (voir plus bas) |
| États en défaut | 129 / 615 | 30 / 615 (acceptés) |

Ordinateur (1366 px) : OK sur les 60 états (les deux menus de téléphone ne s'y affichent pas).

## Défauts trouvés et corrections

| # | Page(s) | Appareils | Élément | Mesure avant | Correction |
|---|---|---|---|---|---|
| 1 | tout le portail public (12 pages) | tactiles | bandeau du haut : téléphone et adresse | 16 px de haut | classe `tap` (44 px), marge du bandeau retirée sur écran tactile pour garder sa hauteur |
| 2 | /places (public), plan de salle dessiné (back-office) | tactiles | places du plan | 15 à 23 px | le plan s'ouvre agrandi sur écran tactile (places de 36 × 28 px), centré sur la téva, et défile dans son cadre ; boutons − / + (jusqu'à 48 px par place) / vue d'ensemble, en 44 px. Ordinateur inchangé (plan ajusté à la largeur). `RoomPlanView.tsx` |
| 3 | éditeur de plan (iframe) | tactiles | boutons (34 à 40 px), champs (14 px, 36 px de haut) | | `@media (pointer:coarse)` dans `public/plan-editor.html` : boutons et champs 44 px, champs 16 px |
| 4 | espace fidèle, « Mes coordonnées » | ≤ 430 px | texte coincé à côté de « Modifier » | colonne de 140 px, e-mail coupé en 4 lignes | bouton sous le texte sur téléphone (`flex-col sm:flex-row`) |
| 5 | /confidentialite | ≤ 639 px | tableau des traitements (560 px) | défilement horizontal, 2 colonnes sur 4 visibles | une fiche par traitement sur téléphone, tableau à partir de 640 px |

Vérifié sans défaut : tableau de bord, fidèles, promesses, encaissements, trésorerie, reçus, cotisations, campagnes,
messages, offices, événements, hazkarot, mikvé, catalogue, Administration (8 onglets), Kiddouch & salons, menu du
portail, espace fidèle, pages publiques de don, billet, louah.

## Défauts non corrigés (acceptés)

- **Places du plan dessiné sur tactile** : 36 × 28 px par défaut (plus de 24 px, minimum WCAG 2.2 AA). À 44 px, le plan
  ferait 1 500 px de large sur un téléphone de 375 px ; le bouton + y mène pour qui le souhaite.
- **Plan en grille (ancien format)** : places de 36 × 36 px sur téléphone (déjà accepté le 23 octobre).
- **Calendrier des offices** : cases de 41 px de large de 320 à 375 px (sept colonnes ; déjà accepté).

## Boutons non cliqués

Paiement (Continuer vers le paiement, Régler, Payer), envoi de formulaires (parrainage, demande de salon, réservation,
coordonnées, réglages du portail et du kiddouch), Confirmer / Refuser / Libérer, Supprimer le plan, Enregistrer de
l'éditeur : effets réels. Leur taille et leur position sont mesurées, ils ne sont pas cliqués. Le formulaire /salons
n'a pas pu être affiché (réglages lus côté serveur, base absente en local) : il utilise les mêmes champs `.input`.

## Limites

Émulation Chromium : ni vrai iPhone, ni barres réelles du navigateur, ni clavier virtuel.

## Relancer

```
npm run build && npm run start
NODE_PATH=$(npm root -g) node qa-mobile/audit.cjs
# options : ONLY=portail-places,seating-dessine  DEVICES=iphone-se,ordinateur  NO_SHOTS=1  RESULTS=fichier.json
```
