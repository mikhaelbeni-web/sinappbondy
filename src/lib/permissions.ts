// Catalogue des permissions disponibles. L'admin coche celles qu'il veut
// donner à chaque poste qu'il crée. Le poste "Administrateur" est
// implicite (isAdmin=true) et possède toujours toutes les permissions.

export type PermissionKey =
  | "gerer_postes"
  | "gerer_equipe"
  | "gerer_fideles"
  | "gerer_catalogue"
  | "gerer_offices"
  | "saisir_promesses"
  | "envoyer_relances"
  | "voir_tout"
  | "gerer_paiements";

export const PERMISSIONS: { key: PermissionKey; label: string; description: string }[] = [
  {
    key: "gerer_postes",
    label: "Gérer les postes",
    description: "Créer et modifier les postes et leurs autorisations (réservé en pratique à l'admin).",
  },
  {
    key: "gerer_equipe",
    label: "Gérer l'équipe",
    description: "Ajouter des membres de l'administration et leur assigner un poste.",
  },
  {
    key: "gerer_fideles",
    label: "Gérer les fidèles",
    description: "Créer et modifier la fiche des fidèles (convives).",
  },
  {
    key: "gerer_catalogue",
    label: "Gérer le catalogue des honneurs",
    description: "Ajouter/modifier la liste des postes vendus pendant l'office (Heikal, montées, etc.).",
  },
  {
    key: "gerer_offices",
    label: "Gérer les offices",
    description: "Créer les offices (Shabbat, fêtes) sur lesquels on enregistre les promesses.",
  },
  {
    key: "saisir_promesses",
    label: "Saisir les promesses de dons",
    description: "Enregistrer, à la fin de l'office, ce que chaque convive a promis.",
  },
  {
    key: "envoyer_relances",
    label: "Envoyer les relances",
    description: "Relancer un fidèle par e-mail avec un lien de paiement Stripe.",
  },
  {
    key: "voir_tout",
    label: "Voir tous les comptes",
    description: "Accès à l'ensemble des promesses et fidèles (comme le trésorier), pas seulement ce qu'on a soi-même saisi.",
  },
  {
    key: "gerer_paiements",
    label: "Gérer les paiements",
    description: "Voir la configuration Stripe et l'état des paiements de l'ensemble de la synagogue.",
  },
];

export const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);

export function hasPermission(
  role: { isAdmin?: boolean; permissions?: string[] } | null | undefined,
  key: PermissionKey
): boolean {
  if (!role) return false;
  if (role.isAdmin) return true;
  return !!role.permissions?.includes(key);
}
