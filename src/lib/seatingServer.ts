import { adminDb } from "./firebaseAdmin";
import { paidOf, remainingOf, round2 } from "./format";
import { createDonorToken } from "./donorSession";
import { sendSeatConfirmationEmail } from "./email";
import { findPlanSeat, planSeatLabel, seatId, selfBookingMax, type SeatingPlanDoc } from "./seating";

// Réservation des places par les fidèles (page publique /places).
// Règle : une place payante n'est réservée qu'une fois payée. Entre le choix
// et le paiement elle est seulement gardée (pending, holdUntil) ; sans
// paiement elle est remise en vente. Une place gratuite est réservée aussitôt.

const fail = (message: string, status: number) => Object.assign(new Error(message), { status });
const CART_MS = 45 * 60_000; // durée de vie d'un panier HelloAsso
export const HOLD_MINUTES = 20; // durée de garde d'une place payante en attente de paiement
export const ONLINE_DONOR_NOTE = "Créé par une réservation de places en ligne";

export async function publishedPlans(): Promise<SeatingPlanDoc[]> {
  const snap = await adminDb().collection("seatingPlans").where("published", "==", true).get();
  return snap.docs
    .map((d) => d.data() as SeatingPlanDoc)
    .filter((p) => p.active !== false && p.layout)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

// Paniers HelloAsso d'un fidèle qui peuvent concerner une réservation :
// celui de la réservation, ou un règlement de tout son solde.
async function bookingCarts(donorId: string, bookingId: string) {
  const snap = await adminDb().collection("checkouts").where("metadata.donorId", "==", donorId).get();
  return snap.docs
    .map((d) => d.data() as any)
    .filter((c) => c.status === "en_attente" && (c.metadata?.bookingId === bookingId || c.metadata?.kind === "donor"));
}
const isLive = (c: any) => Date.parse(c.createdAt) > Date.now() - CART_MS;

// Retire une place en attente restée impayée, avec sa somme due (jamais
// réglée, donc supprimée et non annulée). Renvoie true si la place est retirée.
async function dropPendingSeat(seat: any): Promise<boolean> {
  const db = adminDb();
  return db.runTransaction(async (tx) => {
    const sref = db.collection("seats").doc(seat.id);
    const pref = seat.pledgeId ? db.collection("pledges").doc(seat.pledgeId) : null;
    const [ss, ps] = await Promise.all([tx.get(sref), pref ? tx.get(pref) : Promise.resolve(null)]);
    if (!ss.exists || !(ss.data() as any).pending) return false;
    if (ps?.exists && paidOf(ps.data() as any) > 0) return false;
    if (pref && ps?.exists) tx.delete(pref);
    tx.delete(sref);
    return true;
  });
}

// Fiche créée par une réservation jamais payée et sans rien d'autre : on la retire.
async function dropEmptyOnlineDonor(donorId: string) {
  const db = adminDb();
  const ref = db.collection("donors").doc(donorId);
  const donor = (await ref.get()).data() as any;
  if (!donor || donor.notes !== ONLINE_DONOR_NOTE) return;
  for (const col of ["seats", "pledges", "payments", "receipts"]) {
    if (!(await db.collection(col).where("donorId", "==", donorId).limit(1).get()).empty) return;
  }
  await ref.delete();
}

// Règle le sort des places en attente de paiement :
// - payée : la place devient réservée et la confirmation part par e-mail ;
// - impayée après le délai de garde, sans paiement HelloAsso encore possible :
//   la place est remise en vente (force = tout de suite, paiement abandonné).
async function settleSeats(plan: SeatingPlanDoc, seats: any[], force = false): Promise<{ confirmed: number; released: number }> {
  const out = { confirmed: 0, released: 0 };
  const groups = new Map<string, any[]>();
  for (const s of seats) if (s.pending) groups.set(s.bookingId || s.id, [...(groups.get(s.bookingId || s.id) || []), s]);
  if (!groups.size) return out;
  const db = adminDb();
  const { confirmCheckout } = await import("./helloasso");

  for (const [bookingId, group] of groups) {
    const donorId = group[0].donorId;
    const readPledges = async () => {
      const snaps = await db.getAll(...group.map((s) => db.collection("pledges").doc(s.pledgeId)));
      return new Map(snaps.filter((x) => x.exists).map((x) => [x.id, x.data() as any]));
    };
    let pledges = await readPledges();
    const isPaid = (s: any) => paidOf(pledges.get(s.pledgeId) || {}) > 0;
    const expired = (s: any) => force || !s.holdUntil || Date.parse(s.holdUntil) < Date.now();

    if (group.some((s) => !isPaid(s) && expired(s))) {
      // Un paiement a pu aboutir sans que le payeur revienne sur le site.
      let live = false;
      for (const c of await bookingCarts(donorId, bookingId)) {
        try {
          if (await confirmCheckout(c.id)) continue;
          if (!force && isLive(c)) live = true;
        } catch (err) {
          console.error("[seating] vérification du panier", c.id, err);
          live = true; // dans le doute, on garde la place
        }
      }
      pledges = await readPledges();
      if (!live) {
        for (const s of group) if (!isPaid(s) && expired(s) && (await dropPendingSeat(s))) out.released++;
        if (out.released) await dropEmptyOnlineDonor(donorId).catch((e) => console.error("[seating] fiche", e));
      }
    }

    const now = new Date().toISOString();
    const flipped: any[] = [];
    for (const s of group.filter(isPaid)) {
      const ok = await db.runTransaction(async (tx) => {
        const ref = db.collection("seats").doc(s.id);
        const cur = (await tx.get(ref)).data() as any;
        if (!cur?.pending) return false;
        tx.update(ref, { pending: false, holdUntil: null, confirmedAt: now });
        return true;
      });
      if (ok) flipped.push(s);
    }
    if (flipped.length) {
      out.confirmed += flipped.length;
      const first = pledges.get(flipped[0].pledgeId);
      if (first?.donorEmail) {
        const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/+$/, "");
        await sendSeatConfirmationEmail({
          to: first.donorEmail,
          donorName: first.donorName,
          planName: plan.name,
          seats: flipped.map((s) => planSeatLabel(plan, s.sectionId, s.row, s.seat)),
          due: 0,
          payUrl: null,
          paid: round2(flipped.reduce((sum, s) => sum + paidOf(pledges.get(s.pledgeId) || {}), 0)),
          espaceUrl: appUrl ? `${appUrl}/espace/connexion?t=${encodeURIComponent(createDonorToken(donorId))}` : null,
        }).catch((e) => console.error("[seating] e-mail de confirmation", e));
      }
    }
  }
  return out;
}

// À appeler avant de lire les places d'un plan (page publique, page de
// l'équipe, cron) : confirme les places payées, libère les gardes expirées.
export async function settlePendingSeats(plan: SeatingPlanDoc) {
  const snap = await adminDb().collection("seats").where("planId", "==", plan.id).get();
  return settleSeats(plan, snap.docs.map((d) => d.data() as any));
}

// Après un paiement (ou son abandon, release = true) : traite tout de suite
// les places d'une réservation.
export async function settleBooking(bookingId: string, release = false) {
  const db = adminDb();
  const seats = (await db.collection("seats").where("bookingId", "==", bookingId).get()).docs.map((d) => d.data() as any);
  if (!seats.length) return { confirmed: 0, released: 0 };
  const plan = (await db.collection("seatingPlans").doc(seats[0].planId).get()).data() as SeatingPlanDoc | undefined;
  if (!plan) return { confirmed: 0, released: 0 };
  return settleSeats(plan, seats, release);
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
    return { id: s.id, row: s.row, seat: s.seat, label: planSeatLabel(plan, s.sectionId, s.row, s.seat), remaining, pending: !!s.pending, holdUntil: s.pending ? s.holdUntil || null : null, selfBooked: !!s.selfBooked, canRelease: !!s.selfBooked && (!p || paidOf(p) === 0) };
  });
  return {
    view: {
      id: plan.id,
      name: plan.name,
      salesOpen: !!plan.salesOpen,
      max: selfBookingMax(plan),
      sections: plan.sections.map((s) => ({ id: s.id, name: s.name, price: s.price })),
      layout: plan.layout,
      taken: seats.filter((s) => s.donorId !== donorId).map((s) => `${s.row}:${s.seat}`),
      mine: mineOut,
    },
    due: round2(due),
  };
}

// Prend des places pour un fidèle, en transaction : plan publié et ventes
// ouvertes, places existantes et libres, plafond par famille. Une place
// gratuite est réservée ; une place payante est gardée HOLD_MINUTES avec sa
// somme due, rattachée à la réservation (bookingId), en attente de paiement.
// Un nouveau choix remplace le précédent s'il n'a pas été payé.
export async function bookSeats(params: { planId: string; donorId: string; seats: any; source: string }) {
  const { planId, donorId, seats, source } = params;
  if (!Array.isArray(seats) || !seats.length || seats.length > 50) throw fail("Choisissez au moins une place.", 400);
  const db = adminDb();
  const bookingId = db.collection("pledges").doc().id;
  // Réservations de ce fidèle dont un paiement HelloAsso peut encore aboutir.
  const carts = (await db.collection("checkouts").where("metadata.donorId", "==", donorId).get()).docs
    .map((d) => d.data() as any)
    .filter((c) => c.status === "en_attente" && isLive(c));
  const payingAll = carts.some((c) => c.metadata?.kind === "donor");
  const paying = new Set(carts.map((c) => c.metadata?.bookingId).filter(Boolean));

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
    const own = planSeats.docs.map((d) => d.data() as any).filter((x) => x.donorId === donorId);
    const stale = own.filter((x) => x.pending && x.pledgeId && !payingAll && !paying.has(x.bookingId));
    const stalePledges = stale.length ? await tx.getAll(...stale.map((x) => db.collection("pledges").doc(x.pledgeId))) : [];
    const replaced = stale.filter((_, i) => !stalePledges[i].exists || paidOf(stalePledges[i].data() as any) === 0);
    const replacedIds = new Set(replaced.map((x) => x.id));
    const have = own.length - replaced.length;
    const max = selfBookingMax(plan);
    if (have + wanted.length > max) {
      throw fail(`Une famille peut réserver ${max} place(s) au plus sur ce plan${have ? ` (${have} déjà réservée(s) avec cet e-mail)` : ""}. Contactez la synagogue pour davantage.`, 400);
    }
    const existing = await tx.getAll(...wanted.map((w) => w.ref));
    const taken = wanted.filter((w, i) => existing[i].exists && !replacedIds.has(w.ref.id));
    if (taken.length) throw fail(`${taken.map((t) => t.label).join(", ")} : place(s) qui viennent d'être prises. Choisissez-en d'autres.`, 409);

    for (const x of replaced) {
      tx.delete(db.collection("seats").doc(x.id));
      tx.delete(db.collection("pledges").doc(x.pledgeId));
    }
    const now = new Date().toISOString();
    const holdUntil = new Date(Date.now() + HOLD_MINUTES * 60_000).toISOString();
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
      tx.set(w.ref, { id: w.ref.id, planId: plan.id, sectionId: w.sec.id, row: w.row, seat: w.seat, donorId, donorName, pledgeId, bookingId, selfBooked: true, pending: !!pledgeId, holdUntil: pledgeId ? holdUntil : null, confirmedAt: null, createdAt: now });
    }
    return { bookingId, booked: wanted.map((w) => w.label), total: round2(total), planName: plan.name, donorName, donorEmail: String(donor.email || "") };
  });
}
