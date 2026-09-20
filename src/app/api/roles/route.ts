import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { withPermission, handleApiError, jsonError } from "@/lib/apiHelpers";
import { PERMISSION_KEYS, type PermissionKey } from "@/lib/permissions";

export async function GET() {
  try {
    await withPermission(); // toute personne connectée peut lister les postes
    const snap = await adminDb().collection("roles").orderBy("createdAt", "asc").get();
    const roles = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return NextResponse.json({ roles });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    await withPermission("gerer_postes");
    const { name, permissions } = await req.json();
    if (!name || typeof name !== "string") return jsonError("Nom du poste requis.", 400);

    const cleanPerms: PermissionKey[] = Array.isArray(permissions)
      ? permissions.filter((p: string) => PERMISSION_KEYS.includes(p as PermissionKey))
      : [];

    const now = new Date().toISOString();
    const ref = adminDb().collection("roles").doc();
    const doc = { id: ref.id, name, isAdmin: false, permissions: cleanPerms, createdAt: now };
    await ref.set(doc);
    return NextResponse.json({ role: doc });
  } catch (err) {
    return handleApiError(err);
  }
}
