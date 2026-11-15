import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { handleApiError, jsonError } from "@/lib/apiHelpers";
import { requireDonorId } from "@/lib/donorSession";
import { paidOf } from "@/lib/format";
import { type SeatingPlanDoc } from "@/lib/seating";

const fail = (message: string, status: number) => Object.assign(new Error(message), { status });

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
