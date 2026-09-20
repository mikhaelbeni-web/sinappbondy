import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { withPermission, handleApiError, jsonError } from "@/lib/apiHelpers";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actingUser = await withPermission("gerer_equipe");
    const ref = adminDb().collection("team").doc(params.id);
    const snap = await ref.get();
    if (!snap.exists) return jsonError("Membre introuvable.", 404);

    const { name, roleId, active } = await req.json();
    const update: any = {};
    if (typeof name === "string" && name.trim()) update.name = name.trim();
    if (typeof roleId === "string") update.roleId = roleId;
    if (typeof active === "boolean") {
      if (params.id === actingUser.uid && active === false) {
        return jsonError("Vous ne pouvez pas désactiver votre propre compte.", 400);
      }
      update.active = active;
    }
    await ref.update(update);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const actingUser = await withPermission("gerer_equipe");
    if (params.id === actingUser.uid) {
      return jsonError("Vous ne pouvez pas supprimer votre propre compte.", 400);
    }
    const ref = adminDb().collection("team").doc(params.id);
    const snap = await ref.get();
    if (!snap.exists) return jsonError("Membre introuvable.", 404);

    await ref.delete();
    try {
      await adminAuth().deleteUser(params.id);
    } catch {
      // le compte Auth peut déjà avoir été supprimé
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
