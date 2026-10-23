# Audit responsive mobile — 23 octobre 2026

Périmètre : 45 états de pages (liste dans `pages.md`) × 8 appareils, soit 359 combinaisons
(le tiroir de menu n'est testé que sur téléphone). Appareils : Galaxy S9+ (320 px), Galaxy S8
(360 px), iPhone SE (375 px), iPhone 13 (390 px), Pixel 7 (412 px), iPhone 14 Pro Max (430 px),
iPhone 13 en paysage (844 px) et iPad Mini (768 px).

## Résultat

| | Avant | Après |
|---|---|---|
| Débordement horizontal de la page | 2 pages | 0 |
| Champs en 14 px (Safari iOS zoome au focus) | 36 états sur 45 | 0 |
| Cibles tactiles < 44 px | 42 états sur 45 | 2 types d'éléments, acceptés (voir plus bas) |
| Panneau qui masque le contenu | 1 (plan de salle en paysage) | 0 |
| Erreurs JavaScript ou requêtes en échec | 0 | 0 |

### Tableau page × appareil (passage final)

OK partout, sauf les 2 cas acceptés plus bas :

| Page | 320 | 360 | 375 | 390 | 412 | 430 | paysage | iPad |
|---|---|---|---|---|---|---|---|---|
| services, services-day (calendrier) | KO* | KO* | KO* | OK | OK | OK | OK | OK |
| seating-plan (plan de salle) | KO* | KO* | KO* | KO* | KO* | KO* | OK | OK |
| les 43 autres états | OK | OK | OK | OK | OK | OK | OK | OK |

\* Seul défaut restant : cible tactile entre 35 et 43 px, accepté (voir plus bas).

## Défauts trouvés et corrections

| # | Page(s) | Appareils | Élément | Mesure avant | Correction |
|---|---|---|---|---|---|
| 1 | mikve-admin | 320 à 390 px | horaires d'ouverture (`input[type=time]` + « Retirer ») | page large de 434 px sur 320 px | ligne qui passe à la ligne : les deux heures sur une ligne, « Retirer » en dessous (`flex-wrap`, champs `flex-1`) |
| 2 | admin, onglet Paiements | 320 px | statut « Configuré / Manquant » | page large de 347 px | `gap-3`, libellé `min-w-0 break-words`, statut `shrink-0` |
| 3 | tous les formulaires | tous les écrans tactiles | `.input` (input, select, textarea) | police de 14 px | 16 px sur écran tactile (`@media (pointer: coarse)` dans `globals.css`), 14 px inchangé à la souris |
| 4 | toutes les pages | écrans tactiles | `.btn`, `.chip` | 36 px de haut | `min-height: 44px` sur écran tactile |
| 5 | 20 pages | écrans tactiles | liens et boutons d'action en texte (Copier le lien, QR code, Voir, PDF, Supprimer, Retirer, Annuler, Envoyer, + Plage, + Ajouter, Valider l'entrée, ← Retour…) | 16 à 20 px de haut | classe `tap` (44 × 44 px minimum sur écran tactile) |
| 6 | admin, trésorerie, messages | écrans tactiles | onglets et pastilles de filtre | 30 à 38 px | classe `tap` |
| 7 | 10 pages | écrans tactiles | cases à cocher (le libellé est la cible) | 20 px | classe `tap` sur le `label` |
| 8 | menu mobile | téléphones | bouton ☰ (38 px), croix de fermeture (28 px), liens du tiroir (40 px), Déconnexion (36 px) | | 44 px |
| 9 | tableau de bord | tous | actions des cartes (Traiter, Relancer, Gérer, Consulter : 16 px), « Voir tout l'historique » (29 px) | | `tap` et hauteur 44 px |
| 10 | promesses, encaissements, plan de salle | tous | suggestions de la recherche de fidèle | 36 px | `py-3` |
| 11 | mikve (public) | tous | créneaux horaires | 38 px | `py-3` |
| 12 | offices | tous | offices du jour sélectionné | 36 px | `py-3` |
| 13 | plan de salle | paysage | panneau d'attribution collant | recouvrait les places quand l'écran fait moins de 560 px de haut | collant seulement sur les écrans d'au moins 560 px de haut ; places en 44 × 44 px à partir de 640 px de large |
| 14 | espace fidèle, fiche fidèle | ≤ 390 px | n° de reçu fiscal | coupé (« N° 2026/00… ») | la ligne passe à la ligne au lieu de tronquer |
| 15 | toutes les pages pleine hauteur | téléphones | `min-h-screen` (100vh) | trop haut quand la barre d'adresse est visible | `100dvh`, avec 100vh en repli |

À la demande de mikhael, aussi dans cette PR : sur ordinateur, la barre de défilement du rail d'icônes est masquée
(le défilement reste possible) et le rail s'élargit au survol pour afficher le nom des menus, par-dessus le
contenu, sans décaler la page.

## Défauts non corrigés (acceptés)

- **Calendrier des offices, cases des jours** : 35 à 43 px de large sur les écrans de 320 à 375 px (56 px de haut).
  Sept colonnes de 44 px ne tiennent pas dans la largeur. Les cases dépassent le minimum WCAG 2.2 AA (24 px).
- **Plan de salle, places** : 36 × 36 px sur téléphone en portrait. Le plan défile déjà horizontalement
  dans sa carte (12 places par rang) ; passer à 44 px allongerait ce défilement de 20 %. Les places restent
  au-dessus du minimum WCAG 2.2 AA (24 px). En paysage et sur tablette, elles font 44 px.

## Boutons non cliqués

Toutes les routes `/api` sont simulées (`fixtures.cjs`) et toute requête autre que GET est refusée : aucune
action ne peut avoir d'effet. Ces boutons ont été mesurés (taille, position, recouvrement), mais pas cliqués,
parce qu'ils suppriment des données, envoient un e-mail ou lancent un paiement : Supprimer, Annuler (reçu,
réservation), Libérer, Relancer, Envoyer (message, relevé, reçu), Émettre, Appeler les cotisations, Donner,
Payer, Réserver, Recevoir mon lien, Se connecter, Déconnexion, tous les « Enregistrer » et « Créer ».

## Limites

- Chromium seulement : WebKit n'est pas installé dans l'environnement d'audit. Le Safari iOS réel n'est donc
  pas couvert (rendu des champs date et heure, barre d'adresse dynamique).
- Les vraies barres du navigateur, le clavier virtuel et les encoches (safe areas) ne sont pas simulés.
- Données fictives : des listes réelles plus longues ne changent pas la mise en page (une ligne par élément),
  mais des textes inattendus pourraient.
- Les champs d'heure s'affichent en AM/PM dans le Chromium de l'audit (paramètres régionaux du système). Sur un
  téléphone réglé en français, ils sont en 24 h, donc plus étroits.

## Relancer l'audit

```bash
npm run build && npm run start   # dans un premier terminal
NODE_PATH=$(npm root -g) node qa-mobile/audit.cjs   # dans un second, playwright installé globalement
# ou : npm i -g playwright && npx playwright install chromium
```

Options : `ONLY=dashboard,don` pour quelques pages, `NO_SHOTS=1` sans captures, `BASE_URL=…` pour une autre adresse.
Les résultats bruts sont dans `qa-mobile/results.json` et les captures dans `qa-mobile/screenshots/<appareil>/<page>.png`
(les deux sont ignorés par git).
