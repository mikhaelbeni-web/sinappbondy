import { NextRequest, NextResponse } from "next/server";
import { withPermission, handleApiError } from "@/lib/apiHelpers";
import { cancelReceipt } from "@/lib/receipts";

// Annulation d'un reçu émis par erreur (le numéro n'est pas réattribué).
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await withPermission("gerer_paiements");
    await cancelReceipt(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
