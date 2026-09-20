import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { withPermission, handleApiError, jsonError } from "@/lib/apiHelpers";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await withPermission("gerer_catalogue");
    const ref = adminDb().collection("catalog").doc(params.id);
    const snap = await ref.get();
    if (!snap.exists) return jsonError("Élément introuvable.", 404);

    const { name, category, order, active } = await req.json();
    const update: any = {};
    if (typeof name === "string" && name.trim()) update.name = name.trim();
    if (typeof category === "string") update.category = category;
    if (typeof order === "number") update.order = order;
    if (typeof active === "boolean") update.active = active;

    await ref.update(update);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await withPermission("gerer_catalogue");
    await adminDb().collection("catalog").doc(params.id).delete();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
