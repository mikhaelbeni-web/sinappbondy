import { NextRequest } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { withPermission, handleApiError, jsonError } from "@/lib/apiHelpers";
import { getAssociation } from "@/lib/associationServer";
import { renderReceiptPdf } from "@/lib/receiptPdf";
import type { ReceiptDoc } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await withPermission("gerer_paiements");
    const snap = await adminDb().collection("receipts").doc(params.id).get();
    if (!snap.exists) return jsonError("Reçu introuvable.", 404);
    const receipt = snap.data() as ReceiptDoc;
    const association = await getAssociation();
    const pdf = await renderReceiptPdf(receipt, association.signatureImage, association.logoImage);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="recu-fiscal-${receipt.number.replace("/", "-")}.pdf"`,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
