# Pages auditées

Données : `qa-mobile/fixtures.cjs` (aucun appel réel à Firebase, HelloAsso ou Resend).
Compte : administrateur fictif (toutes permissions), servi par `/api/me` simulé.

| État audité | URL | Rôle | Action avant mesure |
|---|---|---|---|
| login | /login | visiteur | |
| setup | /setup | visiteur | |
| dashboard | /dashboard | admin | |
| menu-mobile | /dashboard | admin | ouverture du tiroir (téléphones seulement) |
| donors | /donors | admin | |
| donors-form | /donors | admin | « + Nouveau fidèle » |
| donor-detail | /donors/d1 | admin | |
| donor-edit | /donors/d1 | admin | « Modifier » puis « Enregistrer un paiement » |
| donor-hazkara-form | /donors/d1 | admin | « + Ajouter » (hazkara) |
| pledges | /pledges | admin | |
| pledges-search | /pledges | admin | saisie dans la recherche de fidèle (liste ouverte) |
| payments | /payments | admin | |
| payments-form | /payments | admin | « Enregistrer un paiement » |
| treasury | /treasury | admin | onglet Bilan |
| treasury-depenses | /treasury | admin | onglet Dépenses + formulaire |
| treasury-remises | /treasury | admin | onglet Remises, tout sélectionner, détail d'une remise |
| receipts | /receipts | admin | |
| memberships | /memberships | admin | |
| campaigns | /campaigns | admin | « + Nouvelle campagne » |
| messages | /messages | admin | destinataires « Groupes » |
| services | /services | admin | « Liste complète » dépliée |
| services-day | /services | admin | « + Nouvel office » et clic sur un jour |
| service-detail | /services/s2 | admin | |
| seating | /seating | admin | « + Nouveau plan » |
| seating-plan | /seating/pl1 | admin | sélection d'une place libre |
| events | /events | admin | « + Nouvel événement » |
| event-detail | /events/ev1 | admin | |
| hazkarot | /hazkarot | admin | |
| mikve-admin | /mikve-reservations | admin | |
| catalog | /catalog | admin | |
| admin-postes | /admin | admin | « + Nouveau poste » |
| admin-equipe | /admin | admin | onglet Équipe + « + Nouveau membre » |
| admin-association | /admin | admin | onglet Association |
| admin-relances | /admin | admin | onglet Relances automatiques |
| admin-paiements | /admin | admin | onglet Paiements |
| admin-louah | /admin | admin | onglet Écran louah |
| don | /don | visiteur | |
| don-campagne | /don/renovation-du-heikhal | visiteur | |
| espace-connexion | /espace | visiteur | |
| espace-fidele | /espace | fidèle connecté | |
| evenement | /evenement/diner-de-gala-annuel | visiteur | |
| billet | /billet/K7Q2-MX9P | visiteur | |
| mikve | /mikve | visiteur | choix d'un créneau |
| louah | /louah | visiteur | |
| merci | /merci | visiteur | |
| portail-accueil | / | visiteur | |
| portail-menu | / | visiteur | ouverture du menu (écrans < 1024 px) |
| portail-horaires | /horaires | visiteur | |
| portail-places | /places | visiteur | sélection d'une place libre |
| portail-places-formulaire | /places | visiteur | sélection d'une place, « Continuer » |
| portail-kiddouch | /kiddouch | visiteur | choix d'un Chabbat et d'une formule |
| portail-salons | /salons | visiteur | |
| portail-galerie | /galerie | visiteur | |
| portail-a-propos | /a-propos | visiteur | |
| portail-communaute | /communaute | visiteur | |
| portail-mentions | /mentions-legales | visiteur | |
| portail-confidentialite | /confidentialite | visiteur | |
| seating-dessine | /seating/pl2 | admin | plan dessiné, clic sur une place |
| plan-editeur | /seating/pl2 | admin | « Modifier le plan de salle » (éditeur en iframe, mesuré à l'intérieur) |
| kiddouch-salons | /kiddouch-salons | admin | |
| admin-journal | /admin?onglet=journal | admin | |
| admin-portail | /admin?onglet=portail | admin | |

Appareils : Galaxy S9+ (320 px), Galaxy S8 (360 px), iPhone SE (375 px), iPhone 13 (390 px), Pixel 7 (412 px),
iPhone 14 Pro Max (430 px), iPhone 13 en paysage, iPad Mini (768 px), iPad Mini en paysage (1024 px),
ordinateur à la souris (1366 px : débordement, recouvrement et console seulement).

Les onglets d'Administration s'ouvrent par l'adresse (`/admin?onglet=…`) : sur téléphone ils sont dans une liste déroulante.
