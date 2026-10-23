import { HDate, HebrewCalendar } from "@hebcal/core";
import { adminDb } from "./firebaseAdmin";
import { sendHazkaraEmail } from "./email";

// Hazkarot (anniversaires de décès au calendrier hébraïque). La date
// hébraïque est calculée à partir de la date civile du décès ; un décès
// après le coucher du soleil compte pour le lendemain.

export interface HazkaraDoc {
  id: string;
  donorId: string;
  donorName: string;
  deceasedName: string;
  relation: string; // ex. père, mère
  deathDate: string; // yyyy-mm-dd (civil)
  afterSunset: boolean;
  hebrewDate: string; // ex. « 7 Adar II 5779 »
  lastNotifiedFor: string | null; // date civile de la dernière hazkara annoncée
  createdAt: string;
}

function toLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d, 12); // midi : à l'abri des décalages de fuseau
}

function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function hebrewLabel(h: HDate): string {
  return `${h.getDate()} ${h.getMonthName()} ${h.getFullYear()}`;
}

function effectiveDeath(deathDate: string, afterSunset: boolean): Date {
  const d = toLocalDate(deathDate);
  if (afterSunset) d.setDate(d.getDate() + 1);
  return d;
}

export function hebrewDeathDate(deathDate: string, afterSunset: boolean): string {
  return hebrewLabel(new HDate(effectiveDeath(deathDate, afterSunset)));
}

// Prochaine hazkara à partir de `from` (incluse) : date civile du jour
// (la veille au soir commence l'anniversaire) et date hébraïque.
export function nextYahrzeit(deathDate: string, afterSunset: boolean, from = new Date()): { date: string; hebrew: string } | null {
  const death = effectiveDeath(deathDate, afterSunset);
  const todayIso = isoOf(from);
  const startYear = new HDate(from).getFullYear();
  for (let y = startYear; y <= startYear + 2; y++) {
    const h = HebrewCalendar.getYahrzeit(y, death);
    if (!h) continue;
    const g = h.greg();
    if (isoOf(g) >= todayIso && isoOf(g) > isoOf(death)) return { date: isoOf(g), hebrew: hebrewLabel(h) };
  }
  return null;
}

export interface HazkaraSettings {
  enabled: boolean;
  daysBefore: number;
}

export async function getHazkaraSettings(): Promise<HazkaraSettings> {
  const snap = await adminDb().collection("settings").doc("hazkarot").get();
  return { enabled: false, daysBefore: 7, ...(snap.exists ? (snap.data() as any) : {}) };
}

export async function upcomingHazkarot(days: number, donorId?: string) {
  let q: FirebaseFirestore.Query = adminDb().collection("hazkarot");
  if (donorId) q = q.where("donorId", "==", donorId);
  const snap = await q.get();
  const now = new Date();
  const limit = isoOf(new Date(now.getTime() + days * 86400_000));
  return snap.docs
    .map((d) => {
      const h = d.data() as HazkaraDoc;
      return { ...h, next: nextYahrzeit(h.deathDate, h.afterSunset, now) };
    })
    .filter((h) => donorId || (h.next && h.next.date <= limit))
    .sort((a, b) => ((a.next?.date || "9") < (b.next?.date || "9") ? -1 : 1));
}

// Rappel envoyé à la famille N jours avant la hazkara (une fois par an).
export async function runHazkaraReminders() {
  const s = await getHazkaraSettings();
  if (!s.enabled) return { sent: 0, skipped: "rappels de hazkara désactivés" };
  const db = adminDb();
  const list = await upcomingHazkarot(s.daysBefore);
  let sent = 0;
  for (const h of list) {
    if (!h.next || h.lastNotifiedFor === h.next.date) continue;
    const donor = (await db.collection("donors").doc(h.donorId).get()).data() as any;
    if (!donor?.email) continue;
    try {
      const r = await sendHazkaraEmail({
        to: donor.email,
        donorName: `${donor.firstName} ${donor.lastName}`,
        deceasedName: h.deceasedName,
        relation: h.relation,
        date: h.next.date,
        hebrew: h.next.hebrew,
      });
      if (!r.sent) continue;
      await db.collection("hazkarot").doc(h.id).update({ lastNotifiedFor: h.next.date });
      sent++;
    } catch (e) {
      console.warn("[hazkarot] rappel non envoyé:", e);
    }
  }
  return { sent, skipped: null as string | null };
}
