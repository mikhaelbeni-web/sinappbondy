// Contenu du portail public des fidèles (accueil, communauté, galerie,
// à propos). Saisi par l'équipe dans Administration > Portail des fidèles ;
// les valeurs par défaut ci-dessous servent tant que rien n'est saisi.
// Fichier sans Admin SDK : importable côté client.

export const PHOTO_CATEGORIES = [
  { key: "synagogue", label: "La synagogue" },
  { key: "salons", label: "Les salons" },
  { key: "evenements", label: "Événements" },
  { key: "travaux", label: "Travaux" },
] as const;

export type PhotoCategory = (typeof PHOTO_CATEGORIES)[number]["key"];

export interface PortalPhoto {
  src: string; // chemin dans /public (ex : /portail/interieur.jpg) ou URL https
  alt: string; // description lue par les lecteurs d'écran
  category: PhotoCategory;
  width?: number; // dimensions d'origine : évitent les sauts de mise en page
  height?: number;
}

export interface PortalService {
  title: string;
  text: string;
}

export interface PortalSettings {
  displayName: string; // nom affiché aux fidèles
  tagline: string; // ex : Synagogue de Bondy
  intro: string; // phrase d'accueil
  phone: string;
  email: string;
  address: string;
  postalCode: string;
  city: string;
  history: string; // paragraphes séparés par une ligne vide
  services: PortalService[];
  heroPhoto: string; // photo du bandeau d'accueil (vide = dégradé)
  photos: PortalPhoto[];
  updatedAt: string;
}

export const DEFAULT_PORTAL: PortalSettings = {
  displayName: "Hehal Ha'Hida Hakadosh",
  tagline: "Synagogue de Bondy",
  intro: "Horaires des offices, fêtes, dons, places et vie de la communauté : tout ce qu'un fidèle ou un invité a besoin de savoir.",
  phone: "01 48 47 50 79",
  email: "contact@hhh-bondy.com",
  address: "28 avenue de la Villageoise",
  postalCode: "93140",
  city: "Bondy",
  history: [
    "Au lendemain de la Seconde Guerre mondiale, des familles juives venues de l'ancien Empire ottoman et d'Europe de l'Est se retrouvaient pour prier dans un simple local de Bondy.",
    "Avec l'arrivée des familles séfarades, la communauté s'est agrandie jusqu'à compter plus de 450 familles. En 1965, le Consistoire de Paris a acquis un pavillon pouvant accueillir plus de 300 personnes, et le centre communautaire a été inauguré en 1978.",
    "La synagogue a été entièrement rénovée en 2019. Elle accueille aujourd'hui les offices de toute l'année, les cours, le Talmud Torah et les événements des familles.",
  ].join("\n\n"),
  services: [
    { title: "Offices quotidiens", text: "Cha'harit, Min'ha et Arvit chaque jour de l'année, en semaine comme le Chabbat." },
    { title: "Cours de Torah", text: "Des cours réguliers donnés par le Rav et des intervenants, ouverts à tous les niveaux." },
    { title: "Talmud Torah", text: "L'enseignement religieux des enfants, le mercredi et le dimanche." },
    { title: "Bar Mitsva", text: "Un accompagnement personnalisé pour préparer la lecture, les tefilines et la fête." },
    { title: "Ezrat Nachim", text: "Un espace réservé aux femmes, avec vue sur la salle de prière." },
    { title: "Bibliothèque", text: "Sifré Torah, Guemarot et ouvrages de référence à disposition des fidèles." },
    { title: "Salons Ha'Hyda", text: "Une salle de réception de 150 à 200 personnes pour mariages, Brit Mila, Bar Mitsva et hazkarot." },
    { title: "Entraide", text: "Aide sociale et accompagnement des familles de la communauté, en toute discrétion." },
  ],
  heroPhoto: "/portail/salle-priere.jpg",
  photos: [
    { src: "/portail/salle-priere.jpg", alt: "La salle de prière rénovée, vue vers l'Aron Hakodech doré entre deux colonnes", category: "synagogue", width: 1600, height: 1200 },
    { src: "/portail/aron-hakodech.jpg", alt: "L'Aron Hakodech aux portes dorées et la bima", category: "synagogue", width: 1600, height: 1200 },
    { src: "/portail/places.jpg", alt: "Les rangées de places en bois et velours rouge", category: "synagogue", width: 1600, height: 1200 },
    { src: "/portail/menorah.jpg", alt: "La grande menorah dorée devant l'Aron Hakodech", category: "synagogue", width: 1600, height: 1200 },
    { src: "/portail/menorah-2.jpg", alt: "La menorah et les vitraux de la façade de l'Aron", category: "synagogue", width: 1600, height: 1200 },
    { src: "/portail/sifre-torah.jpg", alt: "Les Sifré Torah dans l'Aron Hakodech ouvert", category: "synagogue", width: 1200, height: 1600 },
    { src: "/portail/siege-elie.jpg", alt: "Le siège d'Élie, en bois doré et velours rouge", category: "synagogue", width: 1066, height: 1600 },
    { src: "/portail/bibliotheque.jpg", alt: "La bibliothèque et sa table d'étude", category: "synagogue", width: 1200, height: 1600 },
    { src: "/portail/salons-table.jpg", alt: "Les salons dressés pour une réception, tables rondes et fleurs blanches", category: "salons", width: 1200, height: 630 },
    { src: "/portail/salons-fruits.jpg", alt: "Une corbeille de fruits au centre des salons", category: "salons", width: 1600, height: 1200 },
    { src: "/portail/salons-deco-orientale.jpg", alt: "Un décor oriental avec fauteuils et poufs dorés", category: "salons", width: 1600, height: 1200 },
    { src: "/portail/salons-buffet.jpg", alt: "Le buffet dressé le long des salons", category: "salons", width: 768, height: 1024 },
    { src: "/portail/travaux-1.jpg", alt: "La salle de prière pendant la rénovation de 2019", category: "travaux", width: 768, height: 1024 },
    { src: "/portail/travaux-2.jpg", alt: "Les travaux de rénovation de la synagogue", category: "travaux", width: 768, height: 1024 },
  ],
  updatedAt: "",
};

export function fullAddress(p: Pick<PortalSettings, "address" | "postalCode" | "city">): string {
  return [p.address, [p.postalCode, p.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
}

// Lien d'itinéraire OpenStreetMap (pas de carte intégrée : aucun traceur tiers).
export function mapUrl(p: Pick<PortalSettings, "address" | "postalCode" | "city">): string {
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(fullAddress(p))}`;
}

export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

// « vendredi 4 décembre » à partir d'une date yyyy-mm-dd (sans décalage horaire).
export function frDay(isoDate: string, withYear = false): string {
  return new Date(`${isoDate.slice(0, 10)}T12:00:00Z`).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(withYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });
}

export function frRange(start: string, end: string): string {
  if (start === end) return frDay(start);
  return `du ${frDay(start)} au ${frDay(end)}`;
}

// Liens de navigation du portail.
export const PORTAL_LINKS = [
  { href: "/", label: "Accueil" },
  { href: "/horaires", label: "Horaires" },
  { href: "/communaute", label: "Communauté" },
  { href: "/galerie", label: "Galerie" },
  { href: "/a-propos", label: "À propos" },
];
