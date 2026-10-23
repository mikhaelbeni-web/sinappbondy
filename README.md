# Gestion des dons - Synagogue

Application de suivi des promesses de dons faites par les fidèles pendant les offices (Shabbat, fêtes), avec relance automatique par e-mail et paiement en ligne via HelloAsso.

## Fonctionnalités

- **Postes & autorisations** : l'admin crée des postes (Trésorier, Directeur, etc.) avec des permissions cochées à la carte (saisie des promesses, relances, gestion du catalogue, des offices, des fidèles, vue sur tous les comptes ou seulement les siens...).
- **Équipe** : l'admin ajoute des membres et leur assigne un poste.
- **Fidèles** : fiche par convive (nom, e-mail, téléphone, historique de tous ses dons).
- **Catalogue des honneurs** : liste préremplie (ouverture du Heikal, montées 1 à 7, Maftir, Hagbah, Guelila, Hatan Torah, etc.), modifiable.
- **Offices** : création d'un Shabbat/fête, avec le récapitulatif des promesses saisies dessus.
- **Saisie des promesses** : formulaire rapide pour enchaîner la saisie de plusieurs convives à la fin d'un office.
- **Relances** : chaque e-mail de relance (via Resend) contient un lien de paiement signé ; le reste dû est recalculé au clic et le fidèle paie sur HelloAsso.
- **Paiement automatique** : la notification HelloAsso (revérifiée auprès de l'API HelloAsso) enregistre le paiement et émet le reçu fiscal.

## Mise en route

1. `cp .env.example .env.local` et renseignez :
   - un projet **Firebase** (Auth e-mail/mot de passe + Firestore, clé de service pour `firebase-admin`)
   - un client API **HelloAsso** (`HELLOASSO_CLIENT_ID`, `HELLOASSO_CLIENT_SECRET`, `HELLOASSO_ORGANIZATION_SLUG`) et l'URL de notification `/api/helloasso/webhook` déclarée dans HelloAsso > Mon compte > Intégrations et API
   - une clé **Resend** pour l'envoi des e-mails de relance
2. `npm install`
3. `npm run dev`
4. Ouvrez l'application : le premier écran vous fait créer votre compte administrateur (`/setup`).

## Déploiement

Compatible Vercel (Next.js 14, App Router). Pensez à configurer les variables d'environnement sur la plateforme et à déclarer l'URL de notification HelloAsso une fois l'URL de production connue.

## Notes techniques

- Stack : Next.js 14 (App Router) + Firebase (Auth + Firestore) + HelloAsso + Resend, comme vos autres outils internes.
- Aucune donnée de carte bancaire ne transite par l'application : le paiement se fait entièrement sur les pages hébergées par HelloAsso.
- Idée d'évolution mentionnée : plan 3D de la synagogue pour visualiser les places/honneurs — non inclus dans cette première version, à ajouter ensuite si utile.
