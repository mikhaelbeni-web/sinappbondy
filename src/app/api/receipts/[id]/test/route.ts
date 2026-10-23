import { NextRequest, NextResponse } from "next/server";
import { withAdmin, handleApiError } from "@/lib/apiHelpers";
import { markReceiptTest } from "@/lib/receipts";

// Marque (ou démarque) un reçu comme reçu de test. Réservé à l'Administrateur.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await withAdmin();
    const { test } = await req.json();
    await markReceiptTest(params.id, !!test, { uid: user.uid, name: user.name });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
