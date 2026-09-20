import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { withPermission, handleApiError, jsonError } from "@/lib/apiHelpers";
import { hasPermission } from "@/lib/permissions";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await withPermission();
    const snap = await adminDb().collection("pledges").doc(params.id).get();
    if (!snap.exists) return jsonError("Promesse introuvable.", 404);
    const pledge = snap.data() as any;

    if (!hasPermission(user.role, "voir_tout") && pledge.createdBy !== user.uid) {
      return jsonError("Accès refusé.", 403);
    }
    return NextResponse.json({ pledge });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await withPermission("saisir_promesses");
    const ref = adminDb().collection("pledges").doc(params.id);
    const snap = await ref.get();
    if (!snap.exists) return jsonError("Promesse introuvable.", 404);
    const pledge = snap.data() as any;

    if (!hasPermission(user.role, "voir_tout") && pledge.createdBy !== user.uid) {
      return jsonError("Accès refusé.", 403);
    }

    const { notes, status } = await req.json();
    const update: any = { updatedAt: new Date().toISOString() };
    if (typeof notes === "string") update.notes = notes;
    if (typeof status === "string" && ["en_attente", "annule"].includes(status)) {
      // Le passage à "payé" ne se fait que via le webhook Stripe.
      update.status = status;
    }

    await ref.update(update);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
