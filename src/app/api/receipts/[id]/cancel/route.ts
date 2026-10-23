import { NextRequest, NextResponse } from "next/server";
import { withAdmin, handleApiError } from "@/lib/apiHelpers";
import { cancelReceipt } from "@/lib/receipts";

// Annulation : le numéro reste consommé, le reçu est conservé et marqué annulé.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await withAdmin();
    const { confirmNumber, reason } = await req.json();
    await cancelReceipt(params.id, confirmNumber, reason, { uid: user.uid, name: user.name });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
