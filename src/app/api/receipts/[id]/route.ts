import { NextRequest, NextResponse } from "next/server";
import { withAdmin, handleApiError } from "@/lib/apiHelpers";
import { deleteDraftReceipt, updateDraftReceipt } from "@/lib/receipts";

// Modification d'un brouillon (numéro, fidèle, montant, date). Réservé au
// poste Administrateur ; refusé dès que le reçu a été remis au fidèle.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await withAdmin();
    const { number, donorId, amount, issuedAt, reason } = await req.json();
    const receipt = await updateDraftReceipt(
      params.id,
      {
        number: typeof number === "string" ? number : undefined,
        donorId: typeof donorId === "string" && donorId ? donorId : undefined,
        amount: amount === undefined || amount === null || amount === "" ? undefined : Number(amount),
        issuedAt: typeof issuedAt === "string" && issuedAt ? issuedAt : undefined,
        reason: typeof reason === "string" ? reason : "",
      },
      { uid: user.uid, name: user.name }
    );
    return NextResponse.json({ receipt });
  } catch (err) {
    return handleApiError(err);
  }
}

// Suppression définitive d'un brouillon (motif + numéro recopié).
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await withAdmin();
    const { confirmNumber, reason } = await req.json().catch(() => ({}));
    await deleteDraftReceipt(params.id, confirmNumber, reason, { uid: user.uid, name: user.name });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
