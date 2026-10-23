import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { withPermission, handleApiError, jsonError } from "@/lib/apiHelpers";
import { getTiers, membershipPledges } from "@/lib/memberships";

// Appel de cotisation : crée la cotisation de l'année pour les fidèles
// choisis (tous ou certains groupes), sans doublon. Chaque fidèle reçoit sa
// formule habituelle (membershipTier) ou, à défaut, la formule par défaut.
export async function POST(req: NextRequest) {
  try {
    const user = await withPermission("gerer_paiements");
    const { year, defaultTier, groups, donorIds } = await req.json();
    const y = Number(year) || new Date().getFullYear();
    const tiers = await getTiers();
    const fallback = tiers.find((t) => t.name === defaultTier) || tiers[0];
    if (!fallback) return jsonError("Aucune formule de cotisation.", 400);

    const db = adminDb();
    const [donorsSnap, existing] = await Promise.all([db.collection("donors").get(), membershipPledges(y)]);
    const already = new Set(existing.filter((p) => p.status !== "annule").map((p) => p.donorId));
    let donors = donorsSnap.docs.map((d) => d.data() as any);
    if (Array.isArray(donorIds) && donorIds.length) donors = donors.filter((d) => donorIds.includes(d.id));
    else if (Array.isArray(groups) && groups.length) donors = donors.filter((d) => (d.groups || []).some((g: string) => groups.includes(g)));

    const now = new Date().toISOString();
    let created = 0;
    let batch = db.batch();
    let ops = 0;
    for (const d of donors) {
      if (already.has(d.id)) continue;
      const tier = tiers.find((t) => t.name === d.membershipTier) || fallback;
      const ref = db.collection("pledges").doc();
      batch.set(ref, {
        id: ref.id,
        kind: "cotisation",
        membershipYear: y,
        donorId: d.id,
        donorName: `${d.firstName} ${d.lastName}`,
        donorEmail: d.email || "",
        serviceId: "",
        serviceLabel: `Cotisation ${y}`,
        catalogItemId: null,
        catalogItemName: `Cotisation ${tier.name}`,
        amount: tier.amount,
        amountPaid: 0,
        currency: "eur",
        status: "en_attente",
        notes: "",
        createdBy: user.uid,
        createdByName: user.name,
        createdAt: now,
        updatedAt: now,
        onlineCheckoutId: null,
        remindersSentCount: 0,
        lastReminderAt: null,
        paidAt: null,
      });
      created++;
      if (++ops === 450) {
        await batch.commit();
        batch = db.batch();
        ops = 0;
      }
    }
    if (ops) await batch.commit();
    return NextResponse.json({ created, skipped: donors.length - created });
  } catch (err) {
    return handleApiError(err);
  }
}
