import { NextRequest } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { withPermission, handleApiError, jsonError } from "@/lib/apiHelpers";
import { receiptPdf } from "@/lib/receipts";
import type { ReceiptDoc } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await withPermission("gerer_paiements");
    const snap = await adminDb().collection("receipts").doc(params.id).get();
    if (!snap.exists) return jsonError("Reçu introuvable.", 404);
    const receipt = snap.data() as ReceiptDoc;
    const pdf = await receiptPdf(receipt);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        // Regénéré à chaque ouverture : un nouveau logo apparaît aussitôt.
        "Cache-Control": "no-store",
        "Content-Disposition": `inline; filename="recu-fiscal-${receipt.number.replace("/", "-")}.pdf"`,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
