import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { withPermission, handleApiError } from "@/lib/apiHelpers";
import { hasPermission } from "@/lib/permissions";
import { paidOf, remainingOf, round2 } from "@/lib/format";

export async function GET() {
  try {
    const user = await withPermission();
    const seeAll = hasPermission(user.role, "voir_tout");

    let query: FirebaseFirestore.Query = adminDb().collection("pledges");
    if (!seeAll) {
      query = query.where("createdBy", "==", user.uid);
    }
    const snap = await query.get();
    const pledges = snap.docs.map((d) => d.data() as any);

    const totals = { enAttente: 0, relanceEnvoyee: 0, partiel: 0, paye: 0, annule: 0 };
    const amounts = { total: 0, paye: 0, du: 0 };
    const dueByDonor: Record<string, { donorId: string; donorName: string; due: number }> = {};

    for (const p of pledges) {
      if (p.status !== "annule") amounts.total += p.amount || 0;
      if (p.status === "en_attente") totals.enAttente++;
      if (p.status === "relance_envoyee") totals.relanceEnvoyee++;
      if (p.status === "partiel") totals.partiel++;
      if (p.status === "paye") totals.paye++;
      if (p.status === "annule") totals.annule++;
      amounts.paye += paidOf(p);
      const due = remainingOf(p);
      amounts.du += due;
      if (due > 0) {
        const entry = (dueByDonor[p.donorId] ||= { donorId: p.donorId, donorName: p.donorName, due: 0 });
        entry.due = round2(entry.due + due);
      }
    }

    const recent = [...pledges]
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, 15);

    const topDebtors = Object.values(dueByDonor)
      .sort((a, b) => b.due - a.due)
      .slice(0, 10);

    // Encaissements : 12 derniers mois et répartition par mode (année en cours).
    let cash: null | {
      months: { month: string; amount: number }[];
      byMethod: Record<string, number>;
      thisMonth: number;
      thisYear: number;
    } = null;
    if (seeAll && hasPermission(user.role, "gerer_paiements")) {
      const paySnap = await adminDb().collection("payments").get();
      const now = new Date();
      const months: { month: string; amount: number }[] = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({ month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, amount: 0 });
      }
      const year = String(now.getFullYear());
      const thisMonthKey = months[months.length - 1].month;
      const byMethod: Record<string, number> = {};
      let thisMonth = 0;
      let thisYear = 0;
      for (const d of paySnap.docs) {
        const pay = d.data() as any;
        const m = months.find((x) => x.month === pay.date.slice(0, 7));
        if (m) m.amount = round2(m.amount + pay.amount);
        if (pay.date.startsWith(year)) {
          thisYear += pay.amount;
          byMethod[pay.method] = round2((byMethod[pay.method] || 0) + pay.amount);
        }
        if (pay.date.startsWith(thisMonthKey)) thisMonth += pay.amount;
      }
      cash = { months, byMethod, thisMonth: round2(thisMonth), thisYear: round2(thisYear) };
    }

    return NextResponse.json({
      counts: totals,
      amounts: { total: round2(amounts.total), paye: round2(amounts.paye), du: round2(amounts.du) },
      recent,
      topDebtors,
      cash,
      total: pledges.length,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
