import { NextRequest, NextResponse } from "next/server";
import { withAdmin, handleApiError } from "@/lib/apiHelpers";
import { replaceReceipt } from "@/lib/receipts";

// Annule le reçu et émet son remplaçant au numéro suivant.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await withAdmin();
    const { donorId, amount, confirmNumber, reason } = await req.json();
    const receipt = await replaceReceipt(
      params.id,
      {
        donorId: typeof donorId === "string" && donorId ? donorId : undefined,
        amount: amount === undefined || amount === null || amount === "" ? undefined : Number(amount),
        confirmNumber,
        reason,
      },
      { uid: user.uid, name: user.name }
    );
    return NextResponse.json({ receipt });
  } catch (err) {
    return handleApiError(err);
  }
}
