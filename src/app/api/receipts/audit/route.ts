import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { withAdmin, handleApiError } from "@/lib/apiHelpers";

// Journal des actions sur les reçus fiscaux, du plus récent au plus ancien.
export async function GET(req: NextRequest) {
  try {
    await withAdmin();
    const year = Number(new URL(req.url).searchParams.get("year")) || new Date().getFullYear();
    const snap = await adminDb().collection("receiptAudit").where("year", "==", year).get();
    const entries = snap.docs.map((d) => d.data() as any).sort((a, b) => (a.at < b.at ? 1 : -1));
    return NextResponse.json({ entries });
  } catch (err) {
    return handleApiError(err);
  }
}
