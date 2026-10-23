// Recherche tolérante pour les listes : insensible à la casse et aux accents,
// chaque mot tapé doit se retrouver quelque part dans le texte.

export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\u2019'`]/g, "") // Noa'h = Noah
    .replace(/[-_.,/()]+/g, " ")
    .trim();
}

// 0 : aucun mot ne manque et chacun commence un mot du texte (meilleur),
// 1 : tous les mots sont présents, mais au moins un au milieu d'un mot,
// -1 : pas de correspondance.
export function matchScore(text: string, query: string): number {
  const q = normalize(query);
  if (!q) return 0;
  const t = normalize(text);
  const words = t.split(/\s+/);
  let score = 0;
  for (const token of q.split(/\s+/)) {
    if (words.some((w) => w.startsWith(token))) continue;
    if (t.includes(token)) score = 1;
    else return -1;
  }
  return score;
}

export function matches(text: string, query: string): boolean {
  return matchScore(text, query) >= 0;
}

// Filtre en gardant l'ordre d'origine, les débuts de mot passant devant.
export function filterByQuery<T>(items: T[], query: string, textOf: (item: T) => string): T[] {
  if (!normalize(query)) return items;
  const best: T[] = [];
  const rest: T[] = [];
  for (const item of items) {
    const s = matchScore(textOf(item), query);
    if (s === 0) best.push(item);
    else if (s === 1) rest.push(item);
  }
  return [...best, ...rest];
}
