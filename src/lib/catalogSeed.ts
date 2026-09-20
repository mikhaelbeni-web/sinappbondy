import type { CatalogCategory } from "./types";

// Catalogue par défaut des "honneurs" / postes vendus pendant les offices,
// pour amorcer l'application. Modifiable ensuite depuis Admin > Catalogue.
export const CATALOG_SEED: { name: string; category: CatalogCategory; order: number }[] = [
  // Shabbat / semaine
  { name: "Ouverture du Heikal (Petiha)", category: "shabbat", order: 1 },
  { name: "Sortie du Sefer Torah", category: "shabbat", order: 2 },
  { name: "Premier appel - Cohen", category: "shabbat", order: 3 },
  { name: "Deuxième appel - Lévi", category: "shabbat", order: 4 },
  { name: "Troisième montée", category: "shabbat", order: 5 },
  { name: "Quatrième montée", category: "shabbat", order: 6 },
  { name: "Cinquième montée", category: "shabbat", order: 7 },
  { name: "Sixième montée", category: "shabbat", order: 8 },
  { name: "Septième montée", category: "shabbat", order: 9 },
  { name: "Maftir", category: "shabbat", order: 10 },
  { name: "Hagbah (lever le Sefer Torah)", category: "shabbat", order: 11 },
  { name: "Guelila (habiller le Sefer Torah)", category: "shabbat", order: 12 },
  { name: "Retour du Sefer Torah au Heikal", category: "shabbat", order: 13 },
  { name: "Mi Shéberakh", category: "shabbat", order: 14 },
  { name: "Don général / Tsedaka", category: "shabbat", order: 15 },

  // Fêtes
  { name: "Hatan Torah (Simhat Torah)", category: "fete", order: 20 },
  { name: "Hatan Bereshit (Simhat Torah)", category: "fete", order: 21 },
  { name: "Arba Minim (Souccot)", category: "fete", order: 22 },
  { name: "Ouverture du Heikal - fête", category: "fete", order: 23 },
  { name: "Montée - fête", category: "fete", order: 24 },
  { name: "Kol Nidré", category: "fete", order: 25 },
  { name: "Neila", category: "fete", order: 26 },

  // Spéciaux
  { name: "Bar/Bat Mitsva", category: "special", order: 30 },
  { name: "Yahrzeit / Hazkara", category: "special", order: 31 },
  { name: "Don libre", category: "special", order: 32 },
];
