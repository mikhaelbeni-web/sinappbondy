import { adminDb } from "./firebaseAdmin";
import { paidOf, remainingOf, round2 } from "./format";
import { findPlanSeat, planSeatLabel, seatId, selfBookingMax, type SeatingPlanDoc } from "./seating";

// Réservation des places par les fidèles (page publique /places et espace
// fidèle) : lecture des plans publiés, réservation, libération des places
// réservées en ligne et restées impayées au-delà du délai du plan.

const fail = (message: string, status: number) => Object.assign(new Error(message), { status });
const CART_MS = 45 * 60_000; // durée de vie d'un panier HelloAsso

export const holdHoursOf = (plan: Pick<SeatingPlanDoc, "holdHours">) => Math.min(720, Math.max(0, Math.round(Number(plan.holdHours) || 0)));

export async function publishedPlans(): Promise<SeatingPlanDoc[]> {
  const snap = await adminDb().collection("seatingPlans").where("published", "==", true).get();
  return snap.docs
    .map((d) => d.data() as SeatingPlanDoc)
    .filter((p) => p.active !== false && p.layout)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

// Libère les places réservées en ligne, payantes, sans aucun versement et
// plus anciennes que le délai du plan (0 = jamais). Les places attribuées
// par l'équipe ne sont jamais concernées. Renvoie le nombre de places libérées.
export async function releaseExpiredHolds(plan: SeatingPlanDoc): Promise<number> {
  const hours = holdHoursOf(plan);
  if (!hours) return 0;
  const db = adminDb();
  const limit = Date.now() - hours * 3_600_000;
  const seats = (await db.collection("seats").where("planId", "==", plan.id).get()).docs
    .map((d) => d.data() as any)
    .filter((s) => s.selfBooked && s.pledgeId && Date.parse(s.createdAt) < limit);
  let released = 0;
  const cartsByDonor = new Map<string, boolean>();
  for (const s of seats) {
    if (!cartsByDonor.has(s.donorId)) {
      const carts = await db.collection("checkouts").where("metadata.donorId", "==", s.donorId).get();
      cartsByDonor.set(s.donorId, carts.docs.some((d) => (d.data() as any).status === "en_attente" && Date.parse((d.data() as any).createdAt) > Date.now() - CART_MS));
    }
    if (cartsByDonor.get(s.donorId)) continue; // paiement en cours : on attend
    const done = await db.runTransaction(async (tx) => {
      const sref = db.collection("seats").doc(s.id);
      const pref = db.collection("pledges").doc(s.pledgeId);
      const [ss, ps] = await Promise.all([tx.get(sref), tx.get(pref)]);
      if (!ss.exists) return false;
      if (ps.exists) {
        if (paidOf(ps.data() as any) > 0) return false;
        tx.update(pref, { status: "annule", notes: `Place libérée automatiquement (impayée après ${hours} h)`, updatedAt: new Date().toISOString() });
      }
      tx.delete(sref);
      return true;
    });
    if (done) released++;
  }
  return released;
}

// Vue d'un plan pour un visiteur : places prises (sans nom) et, s'il est
// identifié, ses propres places.
export async function planView(plan: SeatingPlanDoc, donorId: string | null) {
  const db = adminDb();
  const seats = (await db.collection("seats").where("planId", "==", plan.id).get()).docs.map((d) => d.data() as any);
  const mine = donorId ? seats.filter((s) => s.donorId === donorId) : [];
  const pledgeIds = mine.map((s) => s.pledgeId).filter(Boolean);
  const pledges = new Map<string, any>();
  for (let i = 0; i < pledgeIds.length; i += 100) {
    for (const p of await db.getAll(...pledgeIds.slice(i, i + 100).map((id: string) => db.collection("pledges").doc(id)))) if (p.exists) pledges.set(p.id, p.data());
  }
  let due = 0;
  const mineOut = mine.map((s) => {
    const p = s.pledgeId ? pledges.get(s.pledgeId) : null;
    const remaining = p ? remainingOf(p) : 0;
    due += remaining;
    return { id: s.id, row: s.row, seat: s.seat, label: planSeatLabel(plan, s.sectionId, s.row, s.seat), remaining, selfBooked: !!s.selfBooked, canRelease: !!s.selfBooked && (!p || paidOf(p) === 0) };
  });
  return {
    view: {
      id: plan.id,
      name: plan.name,
      salesOpen: !!plan.salesOpen,
      max: selfBookingMax(plan),
      holdHours: holdHoursOf(plan),
      sections: plan.sections.map((s) => ({ id: s.id, name: s.name, price: s.price })),
      layout: plan.layout,
      taken: seats.filter((s) => s.donorId !== donorId).map((s) => `${s.row}:${s.seat}`),
      mine: mineOut,
    },
    due: round2(due),
  };
}

// Réserve des places pour un fidèle, en transaction : plan publié et ventes
// ouvertes, places existantes et libres, plafond par famille. Une somme due
// est créée par place payante, rattachée à la réservation (bookingId).
export async function bookSeats(params: { planId: string; donorId: string; seats: any; source: string }) {
  const { planId, donorId, seats, source } = params;
  if (!Array.isArray(seats) || !seats.length || seats.length > 50) throw fail("Choisissez au moins une place.", 400);
  const db = adminDb();
  const bookingId = db.collection("pledges").doc().id;

  return db.runTransaction(async (tx) => {
    const planSnap = await tx.get(db.collection("seatingPlans").doc(planId));
    const plan = planSnap.data() as SeatingPlanDoc | undefined;
    if (!plan || !plan.published || plan.active === false || !plan.layout) throw fail("Ce plan n'est pas disponible.", 404);
    if (!plan.salesOpen) throw fail("Les réservations ne sont pas ouvertes pour ce plan.", 403);
    const donorSnap = await tx.get(db.collection("donors").doc(donorId));
    if (!donorSnap.exists) throw fail("Fiche introuvable.", 404);
    const donor = donorSnap.data() as any;

    const keys = new Set<string>();
    const wanted = seats.map((s: any) => {
      const row = Number(s.row);
      const seat = Number(s.seat);
      const lr = plan.layout!.rows.find((r) => r.num === row);
      const found = lr ? findPlanSeat(plan, lr.sectionId, row, seat) : null;
      if (!found || keys.has(`${row}:${seat}`)) throw fail("Place hors du plan.", 400);
      keys.add(`${row}:${seat}`);
      return { sec: found.section, row, seat, label: found.label, ref: db.collection("seats").doc(seatId(plan.id, found.section.id, row, seat)) };
    });

    // Un seul filtre (pas d'index composé) ; le tri par fidèle se fait ici.
    const planSeats = await tx.get(db.collection("seats").where("planId", "==", plan.id));
    const have = planSeats.docs.filter((d) => (d.data() as any).donorId === donorId).length;
    const max = selfBookingMax(plan);
    if (have + wanted.length > max) {
      throw fail(`Une famille peut réserver ${max} place(s) au plus sur ce plan${have ? ` (${have} déjà réservée(s) avec cet e-mail)` : ""}. Contactez la synagogue pour davantage.`, 400);
    }
    const existing = await tx.getAll(...wanted.map((w) => w.ref));
    const taken = wanted.filter((_, i) => existing[i].exists);
    if (taken.length) throw fail(`${taken.map((t) => t.label).join(", ")} : place(s) qui viennent d'être prises. Choisissez-en d'autres.`, 409);

    const now = new Date().toISOString();
    const donorName = `${donor.firstName} ${donor.lastName}`.trim();
    let total = 0;
    for (const w of wanted) {
      let pledgeId: string | null = null;
      if (w.sec.price > 0) {
        const pref = db.collection("pledges").doc();
        pledgeId = pref.id;
        total += w.sec.price;
        tx.set(pref, {
          id: pref.id,
          kind: "place",
          bookingId,
          donorId,
          donorName,
          donorEmail: donor.email || "",
          serviceId: "",
          serviceLabel: plan.name,
          catalogItemId: null,
          catalogItemName: `Place ${w.label}`,
          amount: w.sec.price,
          amountPaid: 0,
          currency: "eur",
          status: "en_attente",
          notes: `Réservée en ligne (${source})`,
          createdBy: "reservation-en-ligne",
          createdByName: `${donorName} (réservation en ligne)`,
          createdAt: now,
          updatedAt: now,
          onlineCheckoutId: null,
          remindersSentCount: 0,
          lastReminderAt: null,
          paidAt: null,
        });
      }
      tx.set(w.ref, { id: w.ref.id, planId: plan.id, sectionId: w.sec.id, row: w.row, seat: w.seat, donorId, donorName, pledgeId, bookingId, selfBooked: true, confirmedAt: null, createdAt: now });
    }
    return { bookingId, booked: wanted.map((w) => w.label), total: round2(total), planName: plan.name, holdHours: holdHoursOf(plan), donorName, donorEmail: String(donor.email || "") };
  });
}
