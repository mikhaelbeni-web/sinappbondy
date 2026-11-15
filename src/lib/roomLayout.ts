// Plan de salle dessiné (éditeur public/plan-editor.html).
// Unités libres (≈ 2 cm) : origine en haut à gauche, y vers le bas.
// Une place est identifiée par le numéro stable de sa rangée (`num`) et sa
// position dans la rangée (`k`, à partir de 0) : déplacer, renommer ou
// renuméroter une rangée ne change pas les places déjà attribuées.

export type ElementType = "aron" | "estrade" | "teva" | "porte" | "secours" | "pilier" | "zone" | "autre";

export interface LayoutElement {
  id: string;
  type: ElementType;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LayoutRow {
  id: string;
  num: number; // identifiant stable (jamais réutilisé dans un plan)
  letter: string;
  sectionId: string; // tarif
  n: number; // emplacements dans la rangée
  x: number;
  y: number;
  dir: "h" | "v";
  w?: number; // taille propre à la rangée (sinon celle du plan)
  d?: number;
  gap?: number;
  removed: number[]; // emplacements sans place (k)
  rev: boolean; // numéroter depuis l'autre bout
  lab: "start" | "end"; // côté de la lettre
  start?: number; // premier numéro (1 par défaut)
  labels?: Record<string, string>; // numéro choisi à la main, par k
}

export interface RoomLayout {
  seat: { w: number; d: number; gap: number };
  walls: [number, number][];
  elements: LayoutElement[];
  rows: LayoutRow[];
}

export interface LayoutSeat {
  rowNum: number;
  k: number;
  letter: string;
  number: string;
  sectionId: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const TYPES: ElementType[] = ["aron", "estrade", "teva", "porte", "secours", "pilier", "zone", "autre"];

export function rowSize(layout: RoomLayout, r: LayoutRow) {
  return { w: r.w || layout.seat.w, d: r.d || layout.seat.d, gap: r.gap ?? layout.seat.gap };
}

// Numéros affichés des places présentes d'une rangée (même règle que l'éditeur).
export function rowNumbers(r: LayoutRow): Record<number, string> {
  const rm = new Set(r.removed || []);
  const live: number[] = [];
  for (let k = 0; k < r.n; k++) if (!rm.has(k)) live.push(k);
  const st = (r.start || 1) - 1;
  const out: Record<number, string> = {};
  live.forEach((k, i) => {
    const custom = r.labels?.[k];
    out[k] = custom != null && custom !== "" ? String(custom) : String(st + (r.rev ? live.length - i : i + 1));
  });
  return out;
}

export function layoutSeats(layout: RoomLayout): LayoutSeat[] {
  const out: LayoutSeat[] = [];
  for (const r of layout.rows) {
    const { w, d, gap } = rowSize(layout, r);
    const nums = rowNumbers(r);
    for (let k = 0; k < r.n; k++) {
      if (nums[k] == null) continue;
      const p = k * (w + gap);
      out.push({
        rowNum: r.num,
        k,
        letter: r.letter,
        number: nums[k],
        sectionId: r.sectionId,
        ...(r.dir === "h" ? { x: r.x + p, y: r.y, w, h: d } : { x: r.x, y: r.y + p, w: d, h: w }),
      });
    }
  }
  return out;
}

export function findLayoutSeat(layout: RoomLayout, rowNum: number, k: number): LayoutSeat | null {
  const r = layout.rows.find((x) => x.num === rowNum);
  if (!r || k < 0 || k >= r.n) return null;
  const nums = rowNumbers(r);
  if (nums[k] == null) return null;
  return layoutSeats({ ...layout, rows: [r] }).find((s) => s.k === k) || null;
}

const num = (v: any, min: number, max: number, def = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : def;
};
const str = (v: any, max: number) => String(v ?? "").trim().slice(0, max);
const C = 20000; // borne des coordonnées

// Nettoie un plan reçu du navigateur. Renvoie un message d'erreur en cas de
// plan inutilisable.
export function cleanLayout(raw: any, sectionIds: string[]): { layout: RoomLayout } | { error: string } {
  if (!raw || typeof raw !== "object") return { error: "Plan de salle manquant." };
  const seat = {
    w: num(raw.seat?.w, 8, 200, 28),
    d: num(raw.seat?.d, 8, 200, 22),
    gap: num(raw.seat?.gap, 0, 100, 2),
  };
  if (!Array.isArray(raw.walls) || raw.walls.length < 3 || raw.walls.length > 300) return { error: "Les murs doivent former un contour de 3 à 300 coins." };
  const walls = raw.walls.map((p: any) => [num(p?.[0], -C, C), num(p?.[1], -C, C)] as [number, number]);
  const elements: LayoutElement[] = (Array.isArray(raw.elements) ? raw.elements : []).slice(0, 200).map((e: any, i: number) => ({
    id: str(e?.id, 20) || `e${i}`,
    type: TYPES.includes(e?.type) ? e.type : "autre",
    name: str(e?.name, 60),
    x: num(e?.x, -C, C),
    y: num(e?.y, -C, C),
    w: num(e?.w, 1, C, 10),
    h: num(e?.h, 1, C, 10),
  }));
  if (!Array.isArray(raw.rows) || raw.rows.length > 400) return { error: "Trop de rangées (400 au plus)." };
  const nums = new Set<number>();
  const letters = new Set<string>();
  const rows: LayoutRow[] = [];
  for (const r of raw.rows) {
    const n = num(r?.n, 1, 300, 1);
    const rowNum = num(r?.num, 1, 1_000_000, 0);
    const letter = str(r?.letter, 4) || "?";
    if (!rowNum || nums.has(rowNum)) return { error: "Numéros de rangée invalides : rechargez l'éditeur." };
    if (letters.has(letter)) return { error: `La lettre ${letter} est utilisée par deux rangées.` };
    nums.add(rowNum);
    letters.add(letter);
    const labels: Record<string, string> = {};
    if (r?.labels && typeof r.labels === "object") {
      for (const [k, v] of Object.entries(r.labels)) {
        const kk = num(k, 0, n - 1, -1);
        const vv = str(v, 6);
        if (kk >= 0 && vv) labels[kk] = vv;
      }
    }
    const row: LayoutRow = {
      id: str(r?.id, 20) || `r${rowNum}`,
      num: rowNum,
      letter,
      sectionId: sectionIds.includes(r?.sectionId) ? r.sectionId : sectionIds[0],
      n,
      x: num(r?.x, -C, C),
      y: num(r?.y, -C, C),
      dir: r?.dir === "v" ? "v" : "h",
      removed: Array.from(new Set<number>((Array.isArray(r?.removed) ? r.removed : []).map((k: any) => num(k, 0, n - 1, -1)).filter((k: number) => k >= 0))),
      rev: !!r?.rev,
      lab: r?.lab === "end" ? "end" : "start",
    };
    if (r?.w) row.w = num(r.w, 8, 200, seat.w);
    if (r?.d) row.d = num(r.d, 8, 200, seat.d);
    if (r?.gap != null && r.gap !== "") row.gap = num(r.gap, 0, 100, seat.gap);
    if (r?.start != null && Number(r.start) !== 1) row.start = num(r.start, 0, 100000, 1);
    if (Object.keys(labels).length) row.labels = labels;
    const seen = new Set<string>();
    for (const v of Object.values(rowNumbers(row))) {
      if (seen.has(v)) return { error: `Rangée ${letter} : le numéro ${v} est utilisé deux fois.` };
      seen.add(v);
    }
    rows.push(row);
  }
  if (layoutSeats({ seat, walls, elements, rows }).length > 5000) return { error: "Trop de places (5 000 au plus)." };
  return { layout: { seat, walls, elements, rows } };
}
