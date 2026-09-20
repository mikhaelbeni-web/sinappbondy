import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { withPermission, handleApiError, jsonError } from "@/lib/apiHelpers";
import { PERMISSION_KEYS, type PermissionKey } from "@/lib/permissions";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await withPermission("gerer_postes");
    const ref = adminDb().collection("roles").doc(params.id);
    const snap = await ref.get();
    if (!snap.exists) return jsonError("Poste introuvable.", 404);
    const existing = snap.data() as any;
    if (existing.isAdmin) return jsonError("Le poste Administrateur ne peut pas être modifié.", 400);

    const { name, permissions } = await req.json();
    const update: any = {};
    if (typeof name === "string" && name.trim()) update.name = name.trim();
    if (Array.isArray(permissions)) {
      update.permissions = permissions.filter((p: string) => PERMISSION_KEYS.includes(p as PermissionKey));
    }
    await ref.update(update);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await withPermission("gerer_postes");
    const ref = adminDb().collection("roles").doc(params.id);
    const snap = await ref.get();
    if (!snap.exists) return jsonError("Poste introuvable.", 404);
    const existing = snap.data() as any;
    if (existing.isAdmin) return jsonError("Le poste Administrateur ne peut pas être supprimé.", 400);

    const membersUsing = await adminDb().collection("team").where("roleId", "==", params.id).limit(1).get();
    if (!membersUsing.empty) {
      return jsonError("Ce poste est encore attribué à un membre de l'équipe.", 400);
    }

    await ref.delete();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
