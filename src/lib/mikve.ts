import { adminDb } from "./firebaseAdmin";
import { signValue } from "./payments";

// Réservation de créneaux au mikvé. Un créneau = une personne ; l'id du
// document (date_heure) empêche la double réservation. Données minimales
// (prénom, téléphone, e-mail), supprimées à l'annulation.

export interface MikveRange {
  start: string; // "hh:mm"
  end: string;
}

export interface MikveSettings {
  enabled: boolean;
  slotMinutes: number;
  daysAhead: number;
  // 0 = dimanche … 6 = samedi
  schedule: Record<string, MikveRange[]>;
  price: number; // réglé sur place, indicatif
  instructions: string;
}

export const DEFAULT_MIKVE: MikveSettings = {
  enabled: false,
  slotMinutes: 30,
  daysAhead: 14,
  schedule: { "0": [], "1": [], "2": [], "3": [], "4": [], "5": [], "6": [] },
  price: 0,
  instructions: "",
};

export interface MikveBooking {
  id: string;
  date: string; // yyyy-mm-dd
  time: string; // hh:mm
  name: string;
  phone: string;
  email: string;
  createdAt: string;
}

export async function getMikveSettings(): Promise<MikveSettings> {
  const snap = await adminDb().collection("settings").doc("mikve").get();
  const d = (snap.data() || {}) as Partial<MikveSettings>;
  return { ...DEFAULT_MIKVE, ...d, schedule: { ...DEFAULT_MIKVE.schedule, ...(d.schedule || {}) } };
}

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const toTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export function slotsFor(settings: MikveSettings, date: string): string[] {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  const out: string[] = [];
  for (const r of settings.schedule[String(day)] || []) {
    for (let m = toMin(r.start); m + settings.slotMinutes <= toMin(r.end); m += settings.slotMinutes) out.push(toTime(m));
  }
  return out;
}

// Date et heure courantes à Paris, "yyyy-mm-ddThh:mm".
export function parisNow(): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date())
      .map((x) => [x.type, x.value])
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

export function bookableDates(settings: MikveSettings): string[] {
  const today = parisNow().slice(0, 10);
  const base = new Date(`${today}T12:00:00Z`);
  const out: string[] = [];
  for (let i = 0; i < settings.daysAhead; i++) {
    const d = new Date(base.getTime() + i * 86400000).toISOString().slice(0, 10);
    if (slotsFor(settings, d).length) out.push(d);
  }
  return out;
}

export function bookingId(date: string, time: string) {
  return `${date}_${time.replace(":", "")}`;
}

export function mikveCancelUrl(id: string) {
  return `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/public/mikve/cancel?id=${id}&t=${signValue(`mikve:${id}`)}`;
}

export function formatSlot(date: string, time: string) {
  const d = new Date(`${date}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  return `${d} à ${time.replace(":", "h")}`;
}
