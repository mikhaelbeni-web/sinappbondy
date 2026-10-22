import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { withPermission, handleApiError, jsonError } from "@/lib/apiHelpers";
import { paidOf, remainingOf } from "@/lib/format";
import { getTiers, membershipPledges } from "@/lib/memberships";

// État des cotisations d'une année : qui est à jour, partiel, en retard.
export async function GET(req: NextRequest) {
  try {
    await withPermission("gerer_paiements");
    const year = Number(new URL(req.url).searchParams.get("year")) || new Date().getFullYear();
    const [pledges, tiers, donorsSnap] = await Promise.all([membershipPledges(year), getTiers(), adminDb().collection("donors").get()]);
    const groups = new Set<string>();
    for (const d of donorsSnap.docs) for (const g of (d.data() as any).groups || []) groups.add(g);
    const rows = pledges
      .map((p) => ({
        pledgeId: p.id,
        donorId: p.donorId,
        donorName: p.donorName,
        tier: p.catalogItemName,
        amount: p.amount,
        paid: paidOf(p),
        remaining: remainingOf(p),
        status: p.status,
      }))
      .sort((a, b) => a.donorName.localeCompare(b.donorName, "fr"));
    return NextResponse.json({ year, tiers, rows, groups: Array.from(groups).sort(), donorCount: donorsSnap.size });
  } catch (err) {
    return handleApiError(err);
  }
}

// Formules : { tiers: [{ name, amount }] }.
export async function PUT(req: NextRequest) {
  try {
    await withPermission("gerer_paiements");
    const { tiers } = await req.json();
    if (!Array.isArray(tiers)) return jsonError("Formules invalides.", 400);
    const clean = tiers
      .map((t: any) => ({ name: String(t.name || "").trim(), amount: Math.max(0, Number(t.amount) || 0) }))
      .filter((t) => t.name && t.amount > 0)
      .slice(0, 10);
    if (!clean.length) return jsonError("Au moins une formule avec un montant.", 400);
    await adminDb().collection("settings").doc("memberships").set({ tiers: clean });
    return NextResponse.json({ tiers: clean });
  } catch (err) {
    return handleApiError(err);
  }
}
