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

// Suppression définitive du plan : ses places sont supprimées et les sommes
// dues non réglées sont annulées (comme « Libérer »). Refusée si une place a
// déjà été (en partie) réglée, pour ne pas toucher à la comptabilité.
// { confirmName } doit reprendre le nom exact du plan (seconde validation).
export async function DELETE(req: NextRequest, { params }: { params: { planId: string } }) {
  try {
    await withPermission("gerer_paiements");
    const db = adminDb();
    const ref = db.collection("seatingPlans").doc(params.planId);
    const planSnap = await ref.get();
    if (!planSnap.exists) return jsonError("Plan introuvable.", 404);
    const plan = planSnap.data() as any;
    const { confirmName } = await req.json().catch(() => ({}));
    if (String(confirmName || "").trim() !== plan.name) return jsonError("Le nom saisi ne correspond pas au plan.", 400);

    const seats = (await db.collection("seats").where("planId", "==", params.planId).get()).docs;
    const pledgeIds = seats.map((d) => (d.data() as any).pledgeId).filter(Boolean) as string[];
    const pledges: FirebaseFirestore.DocumentSnapshot[] = [];
    for (let i = 0; i < pledgeIds.length; i += 100) {
      pledges.push(...(await db.getAll(...pledgeIds.slice(i, i + 100).map((id) => db.collection("pledges").doc(id)))));
    }
    const paid = pledges.filter((p) => p.exists && paidOf(p.data() as any) > 0).map((p) => (p.data() as any).donorName);
    if (paid.length) {
      const names = Array.from(new Set(paid));
      return jsonError(
        `Suppression impossible : ${paid.length} place(s) déjà (en partie) réglée(s) (${names.slice(0, 5).join(", ")}${names.length > 5 ? "…" : ""}). Supprimez d'abord ces paiements, ou désactivez le plan.`,
        409
      );
    }

    // Par lots (limite Firestore de 500 écritures) ; le plan est supprimé en
    // dernier pour qu'une nouvelle tentative termine le travail en cas d'échec.
    const now = new Date().toISOString();
    const toCancel = pledges.filter((p) => p.exists && (p.data() as any).status !== "annule");
    const writes: ((b: FirebaseFirestore.WriteBatch) => void)[] = [
      ...toCancel.map((p) => (b: FirebaseFirestore.WriteBatch) => b.update(p.ref, { status: "annule", updatedAt: now })),
      ...seats.map((d) => (b: FirebaseFirestore.WriteBatch) => b.delete(d.ref)),
    ];
    for (let i = 0; i < writes.length; i += 400) {
      const batch = db.batch();
      writes.slice(i, i + 400).forEach((w) => w(batch));
      await batch.commit();
    }
    await ref.delete();
    return NextResponse.json({ ok: true, seats: seats.length, cancelled: toCancel.length });
  } catch (err) {
    return handleApiError(err);
  }
}
