import { NextRequest, NextResponse } from "next/server";
import { withPermission, handleApiError } from "@/lib/apiHelpers";
import { markReceiptDelivered } from "@/lib/receipts";

// Reçu imprimé et remis en main propre : il n'est plus un brouillon.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await withPermission("gerer_paiements");
    await markReceiptDelivered(params.id, "main_propre", { uid: user.uid, name: user.name });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
