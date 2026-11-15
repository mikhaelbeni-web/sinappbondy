import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { handleApiError } from "@/lib/apiHelpers";
import { requireDonorId } from "@/lib/donorSession";
import { remainingOf, round2 } from "@/lib/format";
import { payUrl } from "@/lib/payments";
import { planSeatLabel, selfBookingMax, type SeatingPlanDoc } from "@/lib/seating";

// Plans publiés, vus par un fidèle connecté. Les places des autres familles
// sont renvoyées sans nom (occupées, rien de plus).
export async function GET() {
  try {
    const donorId = requireDonorId();
    const db = adminDb();
    const plansSnap = await db.collection("seatingPlans").where("published", "==", true).get();
    const plans = plansSnap.docs.map((d) => d.data() as SeatingPlanDoc).filter((p) => p.active !== false && p.layout);
    const out = [];
    let due = 0;
    for (const plan of plans.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))) {
      const seats = (await db.collection("seats").where("planId", "==", plan.id).get()).docs.map((d) => d.data() as any);
      const mine = seats.filter((s) => s.donorId === donorId);
      const pledgeIds = mine.map((s) => s.pledgeId).filter(Boolean);
      const pledges = new Map<string, any>();
      if (pledgeIds.length) for (const p of await db.getAll(...pledgeIds.map((id: string) => db.collection("pledges").doc(id)))) if (p.exists) pledges.set(p.id, p.data());
      const mineOut = mine.map((s) => {
        const p = s.pledgeId ? pledges.get(s.pledgeId) : null;
        const remaining = p ? remainingOf(p) : 0;
        due += remaining;
        return { id: s.id, row: s.row, seat: s.seat, label: planSeatLabel(plan, s.sectionId, s.row, s.seat), remaining, selfBooked: !!s.selfBooked, canRelease: !!s.selfBooked && (!p || (p.amountPaid || 0) === 0) };
      });
      out.push({
        id: plan.id,
        name: plan.name,
        salesOpen: !!plan.salesOpen,
        max: selfBookingMax(plan),
        sections: plan.sections.map((s) => ({ id: s.id, name: s.name, price: s.price })),
        layout: plan.layout,
        taken: seats.filter((s) => s.donorId !== donorId).map((s) => `${s.row}:${s.seat}`),
        mine: mineOut,
      });
    }
    let balanceUrl: string | null = null;
    try {
      if (due > 0) balanceUrl = payUrl({ kind: "donor", id: donorId });
    } catch {}
    return NextResponse.json({ plans: out, due: round2(due), balanceUrl });
  } catch (err) {
    return handleApiError(err);
  }
}
