# Gestion des dons - Synagogue

Application de suivi des promesses de dons faites par les fidèles pendant les offices (Shabbat, fêtes), avec relance automatique par e-mail et paiement en ligne via Stripe.

## Fonctionnalités

- **Postes & autorisations** : l'admin crée des postes (Trésorier, Directeur, etc.) avec des permissions cochées à la carte (saisie des promesses, relances, gestion du catalogue, des offices, des fidèles, vue sur tous les comptes ou seulement les siens...).
- **Équipe** : l'admin ajoute des membres et leur assigne un poste.
- **Fidèles** : fiche par convive (nom, e-mail, téléphone, historique de tous ses dons).
- **Catalogue des honneurs** : liste préremplie (ouverture du Heikal, montées 1 à 7, Maftir, Hagbah, Guelila, Hatan Torah, etc.), modifiable.
- **Offices** : création d'un Shabbat/fête, avec le récapitulatif des promesses saisies dessus.
- **Saisie des promesses** : formulaire rapide pour enchaîner la saisie de plusieurs convives à la fin d'un office.
- **Relances Stripe** : chaque promesse génère un lien de paiement Stripe stable ; un e-mail de relance (via Resend) l'envoie au fidèle, individuellement ou en masse depuis le tableau de bord.
- **Paiement automatique** : un webhook Stripe marque la promesse comme payée dès le règlement.

## Mise en route

1. `cp .env.example .env.local` et renseignez :
   - un projet **Firebase** (Auth e-mail/mot de passe + Firestore, clé de service pour `firebase-admin`)
   - une clé secrète **Stripe** + le secret de webhook (à créer après déploiement, en pointant vers `/api/stripe/webhook`, événement `checkout.session.completed`)
   - une clé **Resend** pour l'envoi des e-mails de relance
2. `npm install`
3. `npm run dev`
4. Ouvrez l'application : le premier écran vous fait créer votre compte administrateur (`/setup`).

## Déploiement

Compatible Vercel (Next.js 14, App Router). Pensez à configurer les variables d'environnement sur la plateforme et à créer le webhook Stripe une fois l'URL de production connue.

## Notes techniques

- Stack : Next.js 14 (App Router) + Firebase (Auth + Firestore) + Stripe + Resend, comme vos autres outils internes.
- Aucune donnée de carte bancaire ne transite par l'application : le paiement se fait entièrement sur les pages hébergées par Stripe.
- Idée d'évolution mentionnée : plan 3D de la synagogue pour visualiser les places/honneurs — non inclus dans cette première version, à ajouter ensuite si utile.
