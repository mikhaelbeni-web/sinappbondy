import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { withPermission, handleApiError } from "@/lib/apiHelpers";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await withPermission("gerer_fideles");
    await adminDb().collection("hazkarot").doc(params.id).delete();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
