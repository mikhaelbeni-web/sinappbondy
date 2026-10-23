import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { withPermission, handleApiError, jsonError } from "@/lib/apiHelpers";
import { round2 } from "@/lib/format";
import { EXPENSE_CATEGORIES, EXPENSE_METHODS } from "@/lib/treasury";

export async function GET(req: NextRequest) {
  try {
    await withPermission("gerer_paiements");
    const year = req.nextUrl.searchParams.get("year") || String(new Date().getFullYear());
    const snap = await adminDb().collection("expenses").where("date", ">=", `${year}-01-01`).where("date", "<=", `${year}-12-31`).get();
    const expenses = snap.docs.map((d) => d.data()).sort((a: any, b: any) => (a.date < b.date ? 1 : -1));
    return NextResponse.json({ expenses });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await withPermission("gerer_paiements");
    const b = await req.json();
    const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
    const amount = round2(Number(b.amount));
    const date = str(b.date, 10);
    if (!(amount > 0)) return jsonError("Montant invalide.", 400);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return jsonError("Date invalide.", 400);
    if (!str(b.label)) return jsonError("Libellé requis.", 400);
    const ref = adminDb().collection("expenses").doc();
    const doc = {
      id: ref.id,
      date,
      amount,
      category: b.category in EXPENSE_CATEGORIES ? b.category : "autre",
      label: str(b.label),
      supplier: str(b.supplier),
      method: b.method in EXPENSE_METHODS ? b.method : "",
      reference: str(b.reference, 80),
      createdBy: user.uid,
      createdByName: user.name,
      createdAt: new Date().toISOString(),
    };
    await ref.set(doc);
    return NextResponse.json({ expense: doc });
  } catch (err) {
    return handleApiError(err);
  }
}
