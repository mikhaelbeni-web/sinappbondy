import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { withPermission, handleApiError, jsonError } from "@/lib/apiHelpers";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await withPermission("gerer_paiements");
    const ref = adminDb().collection("campaigns").doc(params.id);
    if (!(await ref.get()).exists) return jsonError("Campagne introuvable.", 404);
    const { title, description, goal, active, suggestedAmounts } = await req.json();
    const update: any = { updatedAt: new Date().toISOString() };
    if (typeof title === "string" && title.trim()) update.title = title.trim();
    if (typeof description === "string") update.description = description.trim();
    if (goal !== undefined) update.goal = Math.max(0, Number(goal) || 0);
    if (typeof active === "boolean") update.active = active;
    if (Array.isArray(suggestedAmounts)) update.suggestedAmounts = suggestedAmounts.map(Number).filter((n) => n > 0).slice(0, 6);
    await ref.update(update);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
