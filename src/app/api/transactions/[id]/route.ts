import { NextRequest, NextResponse } from "next/server";
import { withPermission, handleApiError } from "@/lib/apiHelpers";
import { deletePayment } from "@/lib/payments";

// Annulation d'un encaissement saisi par erreur : les promesses concernées
// retrouvent leur reste dû.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await withPermission("gerer_paiements");
    await deletePayment(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
