import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { withPermission, handleApiError, jsonError } from "@/lib/apiHelpers";
import { hasPermission } from "@/lib/permissions";
import { createPledgePaymentLink } from "@/lib/stripeHelpers";

export async function GET(req: NextRequest) {
  try {
    const user = await withPermission();
    const { searchParams } = new URL(req.url);
    const donorId = searchParams.get("donorId");
    const serviceId = searchParams.get("serviceId");
    const status = searchParams.get("status");

    let query: FirebaseFirestore.Query = adminDb().collection("pledges");

    if (donorId) query = query.where("donorId", "==", donorId);
    if (serviceId) query = query.where("serviceId", "==", serviceId);
    if (status) query = query.where("status", "==", status);
    if (!hasPermission(user.role, "voir_tout")) {
      query = query.where("createdBy", "==", user.uid);
    }

    // Pas de orderBy() Firestore ici : combiné aux where() ci-dessus sur
    // d'autres champs, ça exigerait un index composite. Tri en mémoire.
    const snap = await query.get();
    const pledges = snap.docs
      .map((d) => d.data() as any)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return NextResponse.json({ pledges });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await withPermission("saisir_promesses");
    const { donorId, serviceId, catalogItemId, catalogItemName, amount, notes } = await req.json();

    if (!donorId || !serviceId || !amount || Number(amount) <= 0) {
      return jsonError("Fidèle, office et montant (positif) sont requis.", 400);
    }

    const [donorSnap, serviceSnap] = await Promise.all([
      adminDb().collection("donors").doc(donorId).get(),
      adminDb().collection("services").doc(serviceId).get(),
    ]);
    if (!donorSnap.exists) return jsonError("Fidèle introuvable.", 400);
    if (!serviceSnap.exists) return jsonError("Office introuvable.", 400);

    const donor = donorSnap.data() as any;
    const service = serviceSnap.data() as any;

    let resolvedCatalogItemName = catalogItemName || "Don";
    if (catalogItemId) {
      const catalogSnap = await adminDb().collection("catalog").doc(catalogItemId).get();
      if (catalogSnap.exists) resolvedCatalogItemName = (catalogSnap.data() as any).name;
    }

    const now = new Date().toISOString();
    const ref = adminDb().collection("pledges").doc();

    const doc: any = {
      id: ref.id,
      donorId,
      donorName: `${donor.firstName} ${donor.lastName}`,
      donorEmail: donor.email || "",
      serviceId,
      serviceLabel: service.label,
      catalogItemId: catalogItemId || null,
      catalogItemName: resolvedCatalogItemName,
      amount: Number(amount),
      currency: "eur",
      status: "en_attente",
      notes: notes || "",
      createdBy: user.uid,
      createdByName: user.name,
      createdAt: now,
      updatedAt: now,
      stripePaymentLinkUrl: null,
      stripePaymentLinkId: null,
      stripeCheckoutSessionId: null,
      remindersSentCount: 0,
      lastReminderAt: null,
      paidAt: null,
    };

    // Le lien de paiement Stripe est créé tout de suite pour être prêt
    // dès la première relance. Si Stripe n'est pas configuré, la
    // promesse est quand même enregistrée (le lien pourra être généré
    // plus tard, lors de la relance).
    try {
      const link = await createPledgePaymentLink({
        pledgeId: ref.id,
        amount: Number(amount),
        donorName: doc.donorName,
        catalogItemName: resolvedCatalogItemName,
      });
      doc.stripePaymentLinkUrl = link.url;
      doc.stripePaymentLinkId = link.id;
    } catch (stripeErr) {
      console.warn("[pledges] création du lien Stripe impossible:", stripeErr);
    }

    await ref.set(doc);
    return NextResponse.json({ pledge: doc });
  } catch (err) {
    return handleApiError(err);
  }
}
