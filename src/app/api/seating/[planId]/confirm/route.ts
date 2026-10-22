import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { withPermission, handleApiError, jsonError } from "@/lib/apiHelpers";
import { sendSeatConfirmationEmail } from "@/lib/email";
import { remainingOf, round2 } from "@/lib/format";
import { payUrl } from "@/lib/payments";
import { seatLabel, type SeatingPlanDoc } from "@/lib/seating";

// Envoie à chaque famille la liste de ses places (et le reste à régler).
// { onlyNew: true } : seulement les familles pas encore confirmées.
export async function POST(req: NextRequest, { params }: { params: { planId: string } }) {
  try {
    await withPermission("gerer_paiements");
    const { onlyNew } = await req.json().catch(() => ({}));
    const db = adminDb();
    const planSnap = await db.collection("seatingPlans").doc(params.planId).get();
    if (!planSnap.exists) return jsonError("Plan introuvable.", 404);
    const plan = planSnap.data() as SeatingPlanDoc;
    const seats = (await db.collection("seats").where("planId", "==", params.planId).get()).docs.map((d) => d.data() as any);

    const byDonor = new Map<string, any[]>();
    for (const s of seats) byDonor.set(s.donorId, [...(byDonor.get(s.donorId) || []), s]);

    let sent = 0;
    const skipped: string[] = [];
    for (const [donorId, list] of byDonor) {
      if (onlyNew && list.every((s) => s.confirmedAt)) continue;
      const donor = (await db.collection("donors").doc(donorId).get()).data() as any;
      if (!donor?.email) {
        skipped.push(list[0].donorName);
        continue;
      }
      const pledgeIds = list.map((s) => s.pledgeId).filter(Boolean);
      const pledges = pledgeIds.length ? await db.getAll(...pledgeIds.map((id: string) => db.collection("pledges").doc(id))) : [];
      const due = round2(pledges.reduce((sum, p) => sum + (p.exists ? remainingOf(p.data() as any) : 0), 0));
      let url: string | null = null;
      try {
        url = due > 0 ? payUrl({ kind: "donor", id: donorId }) : null;
      } catch {}
      const labels = list
        .sort((a, b) => a.sectionId.localeCompare(b.sectionId) || a.row - b.row || a.seat - b.seat)
        .map((s) => seatLabel(plan.sections.find((x) => x.id === s.sectionId)?.name || "", s.row, s.seat));
      const r = await sendSeatConfirmationEmail({ to: donor.email, donorName: list[0].donorName, planName: plan.name, seats: labels, due, payUrl: url });
      if (!r.sent) return jsonError(`Envoi impossible : ${r.reason}.`, 400);
      const now = new Date().toISOString();
      const batch = db.batch();
      for (const s of list) batch.update(db.collection("seats").doc(s.id), { confirmedAt: now });
      await batch.commit();
      sent++;
    }
    return NextResponse.json({ sent, skipped });
  } catch (err) {
    return handleApiError(err);
  }
}
