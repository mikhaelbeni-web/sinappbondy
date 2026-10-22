import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { withPermission, handleApiError } from "@/lib/apiHelpers";
import { round2 } from "@/lib/format";

// Bilan de l'année : recettes (encaissements) et dépenses, par mois.
export async function GET(req: NextRequest) {
  try {
    await withPermission("gerer_paiements");
    const year = req.nextUrl.searchParams.get("year") || String(new Date().getFullYear());
    const range = (q: FirebaseFirestore.Query) => q.where("date", ">=", `${year}-01-01`).where("date", "<=", `${year}-12-31`).get();
    const db = adminDb();
    const [paySnap, expSnap] = await Promise.all([range(db.collection("payments")), range(db.collection("expenses"))]);

    const months = Array.from({ length: 12 }, () => ({ income: 0, expenses: 0 }));
    const byMethod: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    let income = 0;
    let nonDeductible = 0;
    let expenses = 0;
    for (const d of paySnap.docs) {
      const p = d.data() as any;
      income += p.amount;
      nonDeductible += p.nonDeductible || 0;
      byMethod[p.method] = (byMethod[p.method] || 0) + p.amount;
      months[Number(p.date.slice(5, 7)) - 1].income += p.amount;
    }
    for (const d of expSnap.docs) {
      const e = d.data() as any;
      expenses += e.amount;
      byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
      months[Number(e.date.slice(5, 7)) - 1].expenses += e.amount;
    }
    const r = (o: Record<string, number>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, round2(v)]));
    return NextResponse.json({
      income: round2(income),
      deductible: round2(income - nonDeductible),
      nonDeductible: round2(nonDeductible),
      expenses: round2(expenses),
      net: round2(income - expenses),
      byMethod: r(byMethod),
      byCategory: r(byCategory),
      months: months.map((m) => ({ income: round2(m.income), expenses: round2(m.expenses) })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
