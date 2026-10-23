// Places des fêtes : un plan (ex. « Roch Hachana et Kippour 5787 ») est
// découpé en sections (Hommes, Femmes, Tribune…) de N rangs × M places.
// Attribuer une place crée une promesse de type « place » au tarif de la
// section : paiement, relances, espace fidèle et reçus suivent.

export interface SeatSection {
  id: string;
  name: string;
  rows: number;
  seatsPerRow: number;
  price: number; // € par place, 0 = gratuit
}

export interface SeatingPlanDoc {
  id: string;
  name: string;
  year: number; // année hébraïque ou civile, libre
  sections: SeatSection[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SeatDoc {
  id: string; // planId_sectionId_rang_place (unicité)
  planId: string;
  sectionId: string;
  row: number; // 1 = rang A
  seat: number;
  donorId: string;
  donorName: string;
  pledgeId: string | null;
  createdAt: string;
}

export function rowLetter(row: number): string {
  let s = "";
  let n = row;
  while (n > 0) {
    s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export function seatLabel(sectionName: string, row: number, seat: number): string {
  return `${sectionName} ${rowLetter(row)}${seat}`;
}

export function seatId(planId: string, sectionId: string, row: number, seat: number): string {
  return `${planId}_${sectionId}_${row}_${seat}`;
}

export function cleanSections(raw: any): SeatSection[] | null {
  if (!Array.isArray(raw) || !raw.length) return null;
  const sections = raw.slice(0, 12).map((s: any, i: number) => ({
    id: String(s.id || `s${i + 1}`).replace(/[^a-zA-Z0-9]/g, "").slice(0, 12) || `s${i + 1}`,
    name: String(s.name || `Section ${i + 1}`).trim().slice(0, 40),
    rows: Math.min(60, Math.max(1, Math.round(Number(s.rows) || 1))),
    seatsPerRow: Math.min(60, Math.max(1, Math.round(Number(s.seatsPerRow) || 1))),
    price: Math.max(0, Number(s.price) || 0),
  }));
  const ids = new Set(sections.map((s) => s.id));
  return ids.size === sections.length ? sections : null;
}
