// Places des fêtes : un plan (ex. « Roch Hachana et Kippour 5787 ») est
// soit découpé en sections (Hommes, Femmes, Tribune…) de N rangs × M places,
// soit dessiné (layout : murs, téva, rangées libres) ; ses sections servent
// alors de tarifs, et une place est repérée par row = numéro stable de la
// rangée, seat = position dans la rangée + 1.
// Attribuer une place crée une promesse de type « place » au tarif de la
// section : paiement, relances, espace fidèle et reçus suivent.

import { findLayoutSeat, layoutSeats, type RoomLayout } from "./roomLayout";

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
  layout?: RoomLayout | null; // plan dessiné (sinon grille de sections)
  drawn?: boolean; // plan créé en mode dessiné (layout peut être encore vide)
  published?: boolean; // visible dans l'espace fidèle
  salesOpen?: boolean; // les fidèles peuvent réserver eux-mêmes
  maxPerDonor?: number; // places qu'une famille peut réserver elle-même
  holdHours?: number; // délai (h) avant libération d'une place réservée en ligne et impayée ; 0 = jamais
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

export function cleanSections(raw: any, drawn = false): SeatSection[] | null {
  if (!Array.isArray(raw) || !raw.length) return null;
  const sections = raw.slice(0, 12).map((s: any, i: number) => ({
    id: String(s.id || `s${i + 1}`).replace(/[^a-zA-Z0-9]/g, "").slice(0, 12) || `s${i + 1}`,
    name: String(s.name || `Section ${i + 1}`).trim().slice(0, 40),
    rows: drawn ? 0 : Math.min(60, Math.max(1, Math.round(Number(s.rows) || 1))),
    seatsPerRow: drawn ? 0 : Math.min(60, Math.max(1, Math.round(Number(s.seatsPerRow) || 1))),
    price: Math.max(0, Number(s.price) || 0),
  }));
  const ids = new Set(sections.map((s) => s.id));
  return ids.size === sections.length ? sections : null;
}

type PlanLike = Pick<SeatingPlanDoc, "sections" | "layout" | "drawn">;
export const isDrawn = (plan: PlanLike) => !!(plan.drawn || plan.layout);

export function planCapacity(plan: PlanLike): number {
  if (isDrawn(plan)) return plan.layout ? layoutSeats(plan.layout).length : 0;
  return plan.sections.reduce((s, x) => s + x.rows * x.seatsPerRow, 0);
}

// Place d'un plan (grille ou dessiné) : section (tarif) et libellé, ou null
// si elle n'existe pas (ou plus).
export function findPlanSeat(plan: PlanLike, sectionId: string, row: number, seat: number): { section: SeatSection; label: string } | null {
  if (isDrawn(plan)) {
    if (!plan.layout) return null;
    const s = findLayoutSeat(plan.layout, row, seat - 1);
    const section = s && plan.sections.find((x) => x.id === s.sectionId);
    if (!s || !section || s.sectionId !== sectionId) return null;
    return { section, label: `${s.letter}${s.number}` };
  }
  const section = plan.sections.find((x) => x.id === sectionId);
  if (!section || row < 1 || row > section.rows || seat < 1 || seat > section.seatsPerRow) return null;
  return { section, label: seatLabel(section.name, row, seat) };
}

// Libellé tolérant (place supprimée du plan depuis : on garde un repère).
export function planSeatLabel(plan: PlanLike, sectionId: string, row: number, seat: number): string {
  return findPlanSeat(plan, sectionId, row, seat)?.label || (isDrawn(plan) ? `rangée ${row} place ${seat}` : seatLabel(plan.sections.find((x) => x.id === sectionId)?.name || "", row, seat));
}

export const selfBookingMax = (plan: Pick<SeatingPlanDoc, "maxPerDonor">) => Math.min(50, Math.max(1, Math.round(Number(plan.maxPerDonor) || 6)));
