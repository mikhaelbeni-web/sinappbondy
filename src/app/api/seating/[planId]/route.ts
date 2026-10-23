import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { withPermission, handleApiError, jsonError } from "@/lib/apiHelpers";
import { paidOf, remainingOf } from "@/lib/format";
import { cleanSections } from "@/lib/seating";

// Plan + places attribuées (avec état de paiement de la promesse liée).
export async function GET(_req: NextRequest, { params }: { params: { planId: string } }) {
  try {
    await withPermission("gerer_paiements");
    const db = adminDb();
    const planSnap = await db.collection("seatingPlans").doc(params.planId).get();
    if (!planSnap.exists) return jsonError("Plan introuvable.", 404);
    const seatsSnap = await db.collection("seats").where("planId", "==", params.planId).get();
    const seats = seatsSnap.docs.map((d) => d.data() as any);
    const pledgeIds = seats.map((s) => s.pledgeId).filter(Boolean);
    const pledges = new Map<string, any>();
    for (let i = 0; i < pledgeIds.length; i += 100) {
      const snaps = await db.getAll(...pledgeIds.slice(i, i + 100).map((id) => db.collection("pledges").doc(id)));
      for (const s of snaps) if (s.exists) pledges.set(s.id, s.data());
    }
    return NextResponse.json({
      plan: planSnap.data(),
      seats: seats.map((s) => {
        const p = s.pledgeId ? pledges.get(s.pledgeId) : null;
        return { ...s, paid: p ? paidOf(p) : 0, remaining: p ? remainingOf(p) : 0 };
      }),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

// Modification du plan (nom, sections, actif). Une section qui porte des
// places attribuées ne peut pas être supprimée ni réduite sous ses places.
export async function PATCH(req: NextRequest, { params }: { params: { planId: string } }) {
  try {
    await withPermission("gerer_paiements");
    const db = adminDb();
    const ref = db.collection("seatingPlans").doc(params.planId);
    if (!(await ref.get()).exists) return jsonError("Plan introuvable.", 404);
    const { name, sections, active } = await req.json();
    const update: any = { updatedAt: new Date().toISOString() };
    if (typeof name === "string" && name.trim()) update.name = name.trim();
    if (typeof active === "boolean") update.active = active;
    if (sections !== undefined) {
      const clean = cleanSections(sections);
      if (!clean) return jsonError("Sections invalides.", 400);
      const seats = (await db.collection("seats").where("planId", "==", params.planId).get()).docs.map((d) => d.data() as any);
      for (const s of seats) {
        const sec = clean.find((c) => c.id === s.sectionId);
        if (!sec || s.row > sec.rows || s.seat > sec.seatsPerRow) {
          return jsonError(`Impossible : la place de ${s.donorName} sortirait du plan. Libérez-la d'abord.`, 400);
        }
      }
      update.sections = clean;
    }
    await ref.update(update);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
