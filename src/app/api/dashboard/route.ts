import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { withPermission, handleApiError } from "@/lib/apiHelpers";
import { hasPermission } from "@/lib/permissions";
import { paidOf, remainingOf, round2 } from "@/lib/format";
import { confirmPendingCheckouts } from "@/lib/helloasso";

export async function GET() {
  try {
    const user = await withPermission();
    const seeAll = hasPermission(user.role, "voir_tout");
    // Paiements HelloAsso dont la notification n'est pas arrivée.
    await confirmPendingCheckouts().catch((err) => console.error("[dashboard] helloasso", err));

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
    let payments: any[] = [];
    let cash: null | {
      months: { month: string; amount: number; promised: number }[];
      unallocated: number;
      byMethod: Record<string, number>;
      thisMonth: number;
      thisYear: number;
    } = null;
    if (seeAll && hasPermission(user.role, "gerer_paiements")) {
      const paySnap = await adminDb().collection("payments").get();
      const now = new Date();
      const months: { month: string; amount: number; promised: number }[] = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({ month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, amount: 0, promised: 0 });
      }
      const year = String(now.getFullYear());
      const thisMonthKey = months[months.length - 1].month;
      const byMethod: Record<string, number> = {};
      let thisMonth = 0;
      let thisYear = 0;
      let unallocated = 0;
      for (const p of pledges) {
        if (p.status === "annule") continue;
        const m = months.find((x) => x.month === (p.createdAt || "").slice(0, 7));
        if (m) m.promised = round2(m.promised + (p.amount || 0));
      }
      for (const d of paySnap.docs) {
        const pay = d.data() as any;
        // Reliquat d'un paiement affecté aux promesses (hors don libre, billet).
        if (!pay.campaignId && !pay.eventId && pay.allocations?.length) unallocated += pay.unallocated || 0;
        const m = months.find((x) => x.month === pay.date.slice(0, 7));
        if (m) m.amount = round2(m.amount + pay.amount);
        if (pay.date.startsWith(year)) {
          thisYear += pay.amount;
          byMethod[pay.method] = round2((byMethod[pay.method] || 0) + pay.amount);
        }
        if (pay.date.startsWith(thisMonthKey)) thisMonth += pay.amount;
      }
      cash = { months, byMethod, thisMonth: round2(thisMonth), thisYear: round2(thisYear), unallocated: round2(unallocated) };
      payments = paySnap.docs
        .map((d) => d.data() as any)
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        .slice(0, 8);
    }

    // Derniers mouvements : promesses et encaissements mêlés.
    const movements = [
      ...recent.slice(0, 8).map((p) => ({
        kind: "promesse",
        date: p.createdAt,
        name: p.donorName,
        donorId: p.donorId,
        detail: `Promesse de ${p.amount} € · ${p.catalogItemName || p.serviceLabel || ""}`.trim(),
      })),
      ...payments.map((p) => ({
        kind: "paiement",
        date: p.createdAt,
        name: p.donorName,
        donorId: p.donorId,
        detail: `Encaissement de ${p.amount} €`,
        method: p.method,
      })),
    ]
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, 8);

    let registrations: number | null = null;
    if (hasPermission(user.role, "gerer_paiements")) {
      const today = new Date().toISOString().slice(0, 10);
      const evSnap = await adminDb().collection("events").get();
      const upcoming = new Set(evSnap.docs.map((d) => d.data() as any).filter((e) => e.date.slice(0, 10) >= today).map((e) => e.id));
      if (upcoming.size) {
        const regSnap = await adminDb().collection("registrations").get();
        registrations = regSnap.docs.map((d) => d.data() as any).filter((r) => upcoming.has(r.eventId)).reduce((n, r) => n + (r.qty || 0), 0);
      } else registrations = 0;
    }

    return NextResponse.json({
      movements,
      registrations,
      donorsToRemind: Object.keys(dueByDonor).length,
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
