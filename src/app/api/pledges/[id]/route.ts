import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { withPermission, handleApiError, jsonError } from "@/lib/apiHelpers";
import { hasPermission } from "@/lib/permissions";
import { deletePledge, updatePledge } from "@/lib/pledgeEdit";

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

// { amount?, catalogItemName?, notes?, status?: "annule" | "en_attente" }
// Le statut payé / partiel est recalculé d'après ce qui est déjà réglé.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await withPermission("saisir_promesses");
    const body = await req.json().catch(() => ({}));
    const pledge = await updatePledge(user, hasPermission(user.role, "voir_tout"), params.id, {
      amount: body.amount,
      catalogItemName: body.catalogItemName,
      notes: body.notes,
      status: body.status,
    });
    return NextResponse.json({ ok: true, pledge });
  } catch (err) {
    return handleApiError(err);
  }
}

// Suppression définitive : { confirm: true } exigé (seconde validation).
// Refusée dès qu'un paiement a été affecté à la promesse.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await withPermission("saisir_promesses");
    const { confirm } = await req.json().catch(() => ({}));
    if (confirm !== true) return jsonError("Confirmation manquante.", 400);
    await deletePledge(user, hasPermission(user.role, "voir_tout"), params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
