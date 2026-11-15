import { HebrewCalendar, flags } from "@hebcal/core";
import { adminDb } from "./firebaseAdmin";
import { DEFAULT_KIDDUSH, sponsorId, type KiddushSettings, type KiddushSlot } from "./kiddush";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function fail(message: string, status: number) {
  const err: any = new Error(message);
  err.status = status;
  return err;
}

export async function getKiddushSettings(): Promise<KiddushSettings> {
  let data: Partial<KiddushSettings> = {};
  try {
    const snap = await adminDb().collection("settings").doc("kiddush").get();
    if (snap.exists) data = snap.data() as Partial<KiddushSettings>;
  } catch (err) {
    console.error("[kiddush]", err);
  }
  const merged = { ...DEFAULT_KIDDUSH, ...data };
  if (!merged.options?.length) merged.options = DEFAULT_KIDDUSH.options;
  if (!merged.salonEventTypes?.length) merged.salonEventTypes = DEFAULT_KIDDUSH.salonEventTypes;
  return merged;
}

// Chabbatot à venir avec leur paracha (dates calculées, régime diaspora).
// Un Chabbat de fête n'a pas de paracha : on affiche le nom de la fête.
export function upcomingShabbatot(weeks: number, now = new Date()): Omit<KiddushSlot, "taken">[] {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + Math.min(60, Math.max(1, weeks)) * 7);
  const events = HebrewCalendar.calendar({ start, end, il: false, sedrot: true });
  const out: Omit<KiddushSlot, "taken">[] = [];
  const d = new Date(start);
  d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7));
  for (; d <= end; d.setDate(d.getDate() + 7)) {
    const day = iso(d);
    const same = events.filter((e) => iso(e.getDate().greg()) === day);
    const parsha = same.find((e) => e.getFlags() & flags.PARSHA_HASHAVUA);
    const holiday = same.find((e) => e.getFlags() & (flags.CHAG | flags.CHOL_HAMOED));
    const ev = parsha || holiday;
    out.push({
      date: day,
      parasha: ev ? ev.render("en").replace(/^Parashat /, "").replace(/ \(CH[’']+M\)/, " (Hol Hamoed)") : "Chabbat",
      parashaHe: ev ? ev.render("he").replace(/^פָּרָשַׁת /, "") : "",
    });
  }
  return out;
}

export async function kiddushSlots(settings: KiddushSettings): Promise<KiddushSlot[]> {
  const base = upcomingShabbatot(settings.weeksAhead);
  const taken = new Map<string, string[]>();
  try {
    const snap = await adminDb().collection("kiddushSponsors").where("date", ">=", iso(new Date())).get();
    for (const doc of snap.docs) {
      const s = doc.data() as any;
      taken.set(s.date, [...(taken.get(s.date) || []), s.option]);
    }
  } catch (err) {
    console.error("[kiddush] créneaux", err);
  }
  return base.map((b) => ({ ...b, taken: taken.get(b.date) || [] }));
}

// Parrainage : un seul parrain par Chabbat et par formule (transaction).
// Crée une promesse ordinaire (règlement, relances, reçu, espace fidèle).
export async function sponsorKiddush(params: { donorId: string; date: string; option: string; occasion: string; dedication: string }) {
  const settings = await getKiddushSettings();
  if (!settings.enabled) throw fail("Le parrainage en ligne est fermé pour le moment.", 403);
  const opt = settings.options.find((o) => o.key === params.option);
  const slot = upcomingShabbatot(settings.weeksAhead).find((s) => s.date === params.date);
  if (!opt || !slot) throw fail("Chabbat ou formule indisponible.", 400);
  const db = adminDb();
  const ref = db.collection("kiddushSponsors").doc(sponsorId(params.date, opt.key));
  const dayLabel = new Date(`${slot.date}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const serviceLabel = `Chabbat ${slot.parasha} - ${dayLabel}`;

  return db.runTransaction(async (tx) => {
    const [existing, donorSnap] = await Promise.all([tx.get(ref), tx.get(db.collection("donors").doc(params.donorId))]);
    if (existing.exists) throw fail("Ce Chabbat vient d'être parrainé pour cette formule. Choisissez-en un autre.", 409);
    if (!donorSnap.exists) throw fail("Fiche introuvable.", 404);
    const donor = donorSnap.data() as any;
    const donorName = `${donor.firstName} ${donor.lastName}`.trim();
    const now = new Date().toISOString();
    const dedication = [params.occasion, params.dedication].filter(Boolean).join(" ").trim();
    let pledgeId: string | null = null;
    if (opt.price > 0) {
      const pref = db.collection("pledges").doc();
      pledgeId = pref.id;
      tx.set(pref, {
        id: pref.id,
        donorId: params.donorId,
        donorName,
        donorEmail: donor.email || "",
        serviceId: "",
        serviceLabel,
        catalogItemId: null,
        catalogItemName: opt.label,
        amount: opt.price,
        amountPaid: 0,
        currency: "eur",
        status: "en_attente",
        notes: `Parrainage en ligne${dedication ? ` · ${dedication}` : ""}`,
        createdBy: "kiddouch-en-ligne",
        createdByName: `${donorName} (parrainage en ligne)`,
        createdAt: now,
        updatedAt: now,
        onlineCheckoutId: null,
        remindersSentCount: 0,
        lastReminderAt: null,
        paidAt: null,
      });
    }
    tx.set(ref, { id: ref.id, date: slot.date, parasha: slot.parasha, option: opt.key, optionLabel: opt.label, price: opt.price, donorId: params.donorId, donorName, dedication, pledgeId, createdAt: now });
    return { pledgeId, price: opt.price, label: opt.label, serviceLabel, donorName, donorEmail: String(donor.email || ""), dedication };
  });
}
