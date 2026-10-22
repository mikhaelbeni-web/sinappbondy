import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { withPermission, handleApiError, jsonError } from "@/lib/apiHelpers";
import { hasPermission } from "@/lib/permissions";

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
      amountPaid: 0,
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

    // Plus de Payment Link Stripe à montant fixe : les relances envoient un
    // lien signé (/api/pay) qui calcule le reste dû au moment du clic.
    await ref.set(doc);
    return NextResponse.json({ pledge: doc });
  } catch (err) {
    return handleApiError(err);
  }
}
