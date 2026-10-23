import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { withPermission, handleApiError, jsonError } from "@/lib/apiHelpers";
import { createDeposit, DEPOSIT_METHODS } from "@/lib/treasury";

// Remises en banque : chèques et espèces encaissés pas encore déposés,
// et historique des bordereaux.
export async function GET() {
  try {
    await withPermission("gerer_paiements");
    const db = adminDb();
    const [paySnap, depSnap] = await Promise.all([
      db.collection("payments").where("method", "in", [...DEPOSIT_METHODS]).get(),
      db.collection("deposits").get(),
    ]);
    const pending = paySnap.docs
      .map((d) => d.data() as any)
      .filter((p) => !p.depositId)
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .map((p) => ({ id: p.id, date: p.date, donorName: p.donorName, amount: p.amount, method: p.method, reference: p.reference }));
    const byId = Object.fromEntries(paySnap.docs.map((d) => [d.id, d.data() as any]));
    const deposits = depSnap.docs
      .map((d) => d.data() as any)
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .map((d) => ({
        ...d,
        payments: d.paymentIds.map((id: string) => byId[id]).filter(Boolean).map((p: any) => ({ date: p.date, donorName: p.donorName, amount: p.amount, reference: p.reference })),
      }));
    return NextResponse.json({ pending, deposits });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await withPermission("gerer_paiements");
    const { paymentIds, date, reference } = await req.json();
    if (!Array.isArray(paymentIds) || !paymentIds.length || paymentIds.length > 300) return jsonError("Sélectionnez les encaissements à remettre.", 400);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) return jsonError("Date invalide.", 400);
    const deposit = await createDeposit({
      paymentIds: [...new Set(paymentIds.map(String))],
      date,
      reference: typeof reference === "string" ? reference.trim().slice(0, 80) : "",
      user,
    });
    return NextResponse.json({ deposit });
  } catch (err) {
    return handleApiError(err);
  }
}
