import { NextRequest, NextResponse } from "next/server";
import { withPermission, handleApiError } from "@/lib/apiHelpers";
import { deleteDeposit } from "@/lib/treasury";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await withPermission("gerer_paiements");
    await deleteDeposit(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
