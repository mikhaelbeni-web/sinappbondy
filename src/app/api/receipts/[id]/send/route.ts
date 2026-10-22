import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { withPermission, handleApiError, jsonError } from "@/lib/apiHelpers";
import { emailReceipt } from "@/lib/receipts";
import type { ReceiptDoc } from "@/lib/types";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await withPermission("gerer_paiements");
    const snap = await adminDb().collection("receipts").doc(params.id).get();
    if (!snap.exists) return jsonError("Reçu introuvable.", 404);
    const receipt = snap.data() as ReceiptDoc;
    if (receipt.cancelled) return jsonError("Ce reçu est annulé.", 400);
    // L'adresse e-mail a pu être ajoutée après l'émission.
    const donorSnap = await adminDb().collection("donors").doc(receipt.donorId).get();
    const email = (donorSnap.data() as any)?.email || receipt.donor.email;
    if (!email) return jsonError("Ce fidèle n'a pas d'adresse e-mail.", 400);
    const result = await emailReceipt({ ...receipt, donor: { ...receipt.donor, email } });
    if (!result.sent) return jsonError(`E-mail non envoyé : ${result.reason}.`, 400);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
