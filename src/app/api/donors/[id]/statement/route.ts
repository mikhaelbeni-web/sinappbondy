import { NextRequest, NextResponse } from "next/server";
import { withPermission, handleApiError } from "@/lib/apiHelpers";
import { sendDonorStatement } from "@/lib/statements";

// Envoie au fidèle son relevé avec un lien unique pour régler tout le solde.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await withPermission("envoyer_relances");
    const { total } = await sendDonorStatement(params.id);
    return NextResponse.json({ ok: true, total });
  } catch (err) {
    return handleApiError(err);
  }
}
