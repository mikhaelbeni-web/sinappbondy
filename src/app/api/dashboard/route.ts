import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { withPermission, handleApiError } from "@/lib/apiHelpers";
import { hasPermission } from "@/lib/permissions";

export async function GET() {
  try {
    const user = await withPermission();

    let query: FirebaseFirestore.Query = adminDb().collection("pledges");
    if (!hasPermission(user.role, "voir_tout")) {
      query = query.where("createdBy", "==", user.uid);
    }
    const snap = await query.get();
    const pledges = snap.docs.map((d) => d.data() as any);

    const totals = { enAttente: 0, relanceEnvoyee: 0, paye: 0, annule: 0 };
    const amounts = { total: 0, paye: 0, du: 0 };

    for (const p of pledges) {
      amounts.total += p.amount || 0;
      if (p.status === "en_attente") totals.enAttente++;
      if (p.status === "relance_envoyee") totals.relanceEnvoyee++;
      if (p.status === "paye") {
        totals.paye++;
        amounts.paye += p.amount || 0;
      }
      if (p.status === "annule") totals.annule++;
      if (p.status !== "paye" && p.status !== "annule") amounts.du += p.amount || 0;
    }

    const recent = [...pledges]
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, 15);

    return NextResponse.json({ counts: totals, amounts, recent, total: pledges.length });
  } catch (err) {
    return handleApiError(err);
  }
}
