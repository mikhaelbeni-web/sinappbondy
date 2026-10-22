import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { withPermission, handleApiError, jsonError } from "@/lib/apiHelpers";

// Contrôle à l'entrée : { code }. Tout membre de l'équipe connecté peut
// valider. Un billet déjà utilisé est signalé avec l'heure et le contrôleur.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await withPermission();
    const { code } = await req.json();
    const c = String(code || "").trim().toUpperCase();
    const db = adminDb();
    const snap = await db.collection("registrations").where("code", "==", c).limit(1).get();
    if (snap.empty) return jsonError("Billet inconnu.", 404);
    const ref = snap.docs[0].ref;
    const result = await db.runTransaction(async (tx) => {
      const r = (await tx.get(ref)).data() as any;
      if (params.id !== "any" && r.eventId !== params.id) return { status: "autre_evenement", registration: r };
      if (r.checkedInAt) return { status: "deja_utilise", registration: r };
      const now = new Date().toISOString();
      tx.update(ref, { checkedInAt: now, checkedInBy: user.name });
      return { status: "ok", registration: { ...r, checkedInAt: now, checkedInBy: user.name } };
    });
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err);
  }
}
