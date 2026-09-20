import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { withPermission, handleApiError, jsonError } from "@/lib/apiHelpers";

export async function GET() {
  try {
    await withPermission();
    const snap = await adminDb().collection("team").orderBy("createdAt", "asc").get();
    const team = snap.docs.map((d) => d.data());
    return NextResponse.json({ team });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    await withPermission("gerer_equipe");
    const { name, email, password, roleId } = await req.json();
    if (!name || !email || !password || !roleId) {
      return jsonError("Nom, e-mail, mot de passe et poste sont requis.", 400);
    }
    if (password.length < 8) return jsonError("Le mot de passe doit contenir au moins 8 caractères.", 400);

    const roleSnap = await adminDb().collection("roles").doc(roleId).get();
    if (!roleSnap.exists) return jsonError("Poste introuvable.", 400);

    const userRecord = await adminAuth().createUser({ email, password, displayName: name });

    const now = new Date().toISOString();
    const doc = { id: userRecord.uid, email, name, roleId, active: true, createdAt: now };
    await adminDb().collection("team").doc(userRecord.uid).set(doc);

    return NextResponse.json({ member: doc });
  } catch (err: any) {
    if (err?.code === "auth/email-already-exists") {
      return jsonError("Un compte existe déjà avec cet e-mail.", 409);
    }
    return handleApiError(err);
  }
}
