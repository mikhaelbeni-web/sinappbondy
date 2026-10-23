import { NextRequest } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { handleApiError, jsonError } from "@/lib/apiHelpers";
import { getAssociation } from "@/lib/associationServer";
import { requireDonorId } from "@/lib/donorSession";
import { renderReceiptPdf } from "@/lib/receiptPdf";
import type { ReceiptDoc } from "@/lib/types";

export const runtime = "nodejs";

// Téléchargement d'un reçu par le fidèle lui-même.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const donorId = requireDonorId();
    const snap = await adminDb().collection("receipts").doc(params.id).get();
    const receipt = snap.data() as ReceiptDoc | undefined;
    if (!receipt || receipt.donorId !== donorId || receipt.cancelled) return jsonError("Reçu introuvable.", 404);
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
