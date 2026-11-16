import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { withPermission, handleApiError, jsonError } from "@/lib/apiHelpers";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await withPermission("gerer_paiements");
    const ref = adminDb().collection("campaigns").doc(params.id);
    const snap = await ref.get();
    if (!snap.exists) return jsonError("Campagne introuvable.", 404);
    const snapData = snap.data() as any;
    const { title, description, goal, active, suggestedAmounts, featured } = await req.json();
    const update: any = { updatedAt: new Date().toISOString() };
    if (typeof title === "string" && title.trim()) update.title = title.trim();
    if (typeof description === "string") update.description = description.trim();
    if (goal !== undefined) update.goal = Math.max(0, Number(goal) || 0);
    if (typeof active === "boolean") update.active = active;
    if (Array.isArray(suggestedAmounts)) update.suggestedAmounts = suggestedAmounts.map(Number).filter((n) => n > 0).slice(0, 6);
    // Mise en avant sur le portail : une seule campagne à la fois, et jamais
    // une campagne clôturée.
    if (active === false) update.featured = false;
    if (typeof featured === "boolean" && active !== false) {
      if (featured && (snapData.active === false && active !== true)) return jsonError("Rouvrez la campagne avant de la mettre en avant.", 400);
      update.featured = featured;
      if (featured) {
        const others = await adminDb().collection("campaigns").where("featured", "==", true).get();
        await Promise.all(others.docs.filter((d) => d.id !== params.id).map((d) => d.ref.update({ featured: false, updatedAt: update.updatedAt })));
      }
    }
    await ref.update(update);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
