import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { handleApiError, jsonError } from "@/lib/apiHelpers";
import { requireDonorId } from "@/lib/donorSession";
import { paidOf } from "@/lib/format";
import { payUrl } from "@/lib/payments";
import { findPlanSeat, seatId, selfBookingMax, type SeatingPlanDoc } from "@/lib/seating";

const fail = (message: string, status: number) => Object.assign(new Error(message), { status });

// Un fidèle réserve lui-même des places : { seats: [{ row, seat }] }.
// Possible seulement si le plan est publié et les ventes ouvertes. Le tarif
// vient de la rangée ; une somme due est créée par place payante.
export async function POST(req: NextRequest, { params }: { params: { planId: string } }) {
  try {
    const donorId = requireDonorId();
    const { seats } = await req.json();
    if (!Array.isArray(seats) || !seats.length || seats.length > 50) return jsonError("Choisissez au moins une place.", 400);
    const db = adminDb();

    const result = await db.runTransaction(async (tx) => {
      const planSnap = await tx.get(db.collection("seatingPlans").doc(params.planId));
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
        throw fail(`Vous pouvez réserver ${max} place(s) au plus sur ce plan (vous en avez déjà ${have}). Contactez la synagogue pour davantage.`, 400);
      }
      const existing = await tx.getAll(...wanted.map((w) => w.ref));
      const taken = wanted.filter((_, i) => existing[i].exists);
      if (taken.length) throw fail(`${taken.map((t) => t.label).join(", ")} : place(s) qui viennent d'être prises. Choisissez-en d'autres.`, 409);

      const now = new Date().toISOString();
      const donorName = `${donor.firstName} ${donor.lastName}`;
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
            notes: "Réservée par le fidèle depuis son espace",
            createdBy: "espace-fidele",
            createdByName: `${donorName} (espace fidèle)`,
            createdAt: now,
            updatedAt: now,
            onlineCheckoutId: null,
            remindersSentCount: 0,
            lastReminderAt: null,
            paidAt: null,
          });
        }
        tx.set(w.ref, { id: w.ref.id, planId: plan.id, sectionId: w.sec.id, row: w.row, seat: w.seat, donorId, donorName, pledgeId, selfBooked: true, confirmedAt: null, createdAt: now });
      }
      return { booked: wanted.map((w) => w.label), total };
    });

    let url: string | null = null;
    try {
      if (result.total > 0) url = payUrl({ kind: "donor", id: donorId });
    } catch {}
    return NextResponse.json({ ...result, payUrl: url });
  } catch (err) {
    return handleApiError(err);
  }
}

// Le fidèle rend une place qu'il a réservée lui-même : { seatId }. Refusé si
// elle est (en partie) réglée, si un paiement en ligne est en cours ou si
// les ventes sont fermées (la synagogue s'en charge alors).
export async function DELETE(req: NextRequest, { params }: { params: { planId: string } }) {
  try {
    const donorId = requireDonorId();
    const { seatId: id } = await req.json();
    const db = adminDb();
    // Un panier HelloAsso ouvert il y a moins de 45 minutes peut encore aboutir.
    const limit = Date.now() - 45 * 60_000;
    const carts = await db.collection("checkouts").where("metadata.donorId", "==", donorId).get();
    if (carts.docs.some((d) => (d.data() as any).status === "en_attente" && Date.parse((d.data() as any).createdAt) > limit)) {
      return jsonError("Un paiement en ligne est en cours. Réessayez dans 45 minutes.", 409);
    }
    await db.runTransaction(async (tx) => {
      const planSnap = await tx.get(db.collection("seatingPlans").doc(params.planId));
      const plan = planSnap.data() as SeatingPlanDoc | undefined;
      if (!plan?.published || !plan.salesOpen) throw fail("Les réservations sont fermées : contactez la synagogue pour rendre une place.", 403);
      const ref = db.collection("seats").doc(String(id));
      const snap = await tx.get(ref);
      const seat = snap.data() as any;
      if (!snap.exists || seat.planId !== params.planId || seat.donorId !== donorId) throw fail("Place introuvable.", 404);
      if (!seat.selfBooked) throw fail("Cette place a été attribuée par la synagogue : contactez-la pour la rendre.", 403);
      if (seat.pledgeId) {
        const pref = db.collection("pledges").doc(seat.pledgeId);
        const p = await tx.get(pref);
        if (p.exists) {
          const pl = p.data() as any;
          if (paidOf(pl) > 0) throw fail("Cette place est déjà (en partie) réglée : contactez la synagogue.", 409);
          tx.update(pref, { status: "annule", updatedAt: new Date().toISOString() });
        }
      }
      tx.delete(ref);
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
