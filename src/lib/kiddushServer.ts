import { HebrewCalendar, flags } from "@hebcal/core";
import { adminDb } from "./firebaseAdmin";
import { DEFAULT_KIDDUSH, sponsorId, type KiddushSettings, type KiddushSlot } from "./kiddush";
import { paidOf } from "./format";
import { createDonorToken } from "./donorSession";
import { escapeForEmail, sendNoticeEmail } from "./email";

// Règle (comme les places des fêtes) : un Chabbat payant n'est réservé qu'une
// fois payé. Entre le choix et le paiement il est seulement gardé (pending,
// holdUntil) ; sans paiement il est remis à disposition.
export const KIDDUSH_HOLD_MINUTES = 20;
export const KIDDUSH_DONOR_NOTE = "Créé par un parrainage de kiddouch en ligne";
const CART_MS = 45 * 60_000; // durée de vie d'un panier HelloAsso

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
    await settlePendingKiddush().catch((e) => console.error("[kiddush] gardes", e));
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
    if (existing.exists) {
      // Sa propre garde restée impayée est remplacée ; tout le reste bloque.
      const cur = existing.data() as any;
      const oldPledge = cur.pending && cur.donorId === params.donorId && cur.pledgeId ? await tx.get(db.collection("pledges").doc(cur.pledgeId)) : null;
      if (!oldPledge || (oldPledge.exists && paidOf(oldPledge.data() as any) > 0)) {
        throw fail(cur.pending ? "Ce Chabbat est en cours de réservation par une autre personne. Réessayez dans quelques minutes ou choisissez-en un autre." : "Ce Chabbat est déjà parrainé pour cette formule. Choisissez-en un autre.", 409);
      }
      if (oldPledge.exists) tx.delete(oldPledge.ref);
    }
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
        kind: "kiddouch",
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
    tx.set(ref, { id: ref.id, date: slot.date, parasha: slot.parasha, option: opt.key, optionLabel: opt.label, price: opt.price, donorId: params.donorId, donorName, dedication, pledgeId, pending: !!pledgeId, holdUntil: pledgeId ? new Date(Date.now() + KIDDUSH_HOLD_MINUTES * 60_000).toISOString() : null, confirmedAt: pledgeId ? null : now, createdAt: now });
    return { pledgeId, price: opt.price, label: opt.label, serviceLabel, donorName, donorEmail: String(donor.email || ""), dedication };
  });
}

// Fiche créée par un parrainage jamais payé et sans rien d'autre : on la retire.
async function dropEmptyKiddushDonor(donorId: string) {
  const db = adminDb();
  const ref = db.collection("donors").doc(donorId);
  const donor = (await ref.get()).data() as any;
  if (!donor || donor.notes !== KIDDUSH_DONOR_NOTE) return;
  for (const col of ["kiddushSponsors", "seats", "pledges", "payments", "receipts"]) {
    if (!(await db.collection(col).where("donorId", "==", donorId).limit(1).get()).empty) return;
  }
  await ref.delete();
}

// Règle le sort des parrainages en attente de paiement :
// - payé : le Chabbat devient réservé et la confirmation part par e-mail ;
// - impayé après le délai de garde, sans paiement HelloAsso encore possible :
//   le Chabbat est libéré (force = tout de suite, paiement abandonné).
export async function settleKiddush(sponsors: any[], force = false): Promise<{ confirmed: number; released: number }> {
  const out = { confirmed: 0, released: 0 };
  const pending = sponsors.filter((s) => s.pending && s.pledgeId);
  if (!pending.length) return out;
  const db = adminDb();
  const { confirmCheckout } = await import("./helloasso");

  for (const s of pending) {
    const pref = db.collection("pledges").doc(s.pledgeId);
    const sref = db.collection("kiddushSponsors").doc(s.id);
    let pledge = (await pref.get()).data() as any;
    const expired = force || !s.holdUntil || Date.parse(s.holdUntil) < Date.now();

    if (!(pledge && paidOf(pledge) > 0) && expired) {
      // Un paiement a pu aboutir sans que le payeur revienne sur le site.
      let live = false;
      const carts = (await db.collection("checkouts").where("metadata.donorId", "==", s.donorId).get()).docs
        .map((d) => d.data() as any)
        .filter((c) => c.status === "en_attente" && (c.metadata?.pledgeId === s.pledgeId || c.metadata?.kind === "donor"));
      for (const c of carts) {
        try {
          if (await confirmCheckout(c.id)) continue;
          if (!force && Date.parse(c.createdAt) > Date.now() - CART_MS) live = true;
        } catch (err) {
          console.error("[kiddush] vérification du panier", c.id, err);
          live = true; // dans le doute, on garde le Chabbat
        }
      }
      pledge = (await pref.get()).data() as any;
      if (!live && !(pledge && paidOf(pledge) > 0)) {
        const dropped = await db.runTransaction(async (tx) => {
          const [ss, ps] = await Promise.all([tx.get(sref), tx.get(pref)]);
          if (!ss.exists || !(ss.data() as any).pending) return false;
          if (ps.exists && paidOf(ps.data() as any) > 0) return false;
          if (ps.exists) tx.delete(pref); // jamais réglée : supprimée, pas annulée
          tx.delete(sref);
          return true;
        });
        if (dropped) {
          out.released++;
          await dropEmptyKiddushDonor(s.donorId).catch((e) => console.error("[kiddush] fiche", e));
        }
        continue;
      }
    }

    if (pledge && paidOf(pledge) > 0) {
      const now = new Date().toISOString();
      const flipped = await db.runTransaction(async (tx) => {
        const cur = (await tx.get(sref)).data() as any;
        if (!cur?.pending) return false;
        tx.update(sref, { pending: false, holdUntil: null, confirmedAt: now });
        return true;
      });
      if (!flipped) continue;
      out.confirmed++;
      if (pledge.donorEmail) {
        const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/+$/, "");
        const day = new Date(`${s.date}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
        await sendNoticeEmail({
          to: pledge.donorEmail,
          subject: `Parrainage confirmé - Chabbat ${s.parasha}`,
          bodyHtml: `
            <p>Chalom ${escapeForEmail(pledge.donorName || "")},</p>
            <p>Merci ! Votre paiement est bien reçu. Vous parrainez : <strong>${escapeForEmail(s.optionLabel)}</strong>, Chabbat ${escapeForEmail(s.parasha)} (${escapeForEmail(day)}).</p>
            ${s.dedication ? `<p>Dédicace : ${escapeForEmail(s.dedication)}</p>` : ""}
            ${appUrl ? `<p>Votre espace fidèle (règlements, reçus) : <a href="${appUrl}/espace/connexion?t=${encodeURIComponent(createDonorToken(s.donorId))}">ouvrir mon espace</a>. Ce lien est personnel, ne le transférez pas.</p>` : ""}`,
        }).catch((e) => console.error("[kiddush] e-mail de confirmation", e));
      }
    }
  }
  return out;
}

// À appeler avant de lire les parrainages (page publique, administration,
// cron) : confirme ceux qui sont payés, libère les gardes expirées.
export async function settlePendingKiddush() {
  const snap = await adminDb().collection("kiddushSponsors").where("date", ">=", iso(new Date())).get();
  return settleKiddush(snap.docs.map((d) => d.data() as any));
}

// Après un paiement (ou son abandon, release = true) : traite tout de suite
// le parrainage lié à une somme due.
export async function settleKiddushPledge(pledgeId: string, release = false) {
  const snap = await adminDb().collection("kiddushSponsors").where("pledgeId", "==", pledgeId).get();
  return settleKiddush(snap.docs.map((d) => d.data() as any), release);
}
