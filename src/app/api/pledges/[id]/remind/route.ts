import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { withPermission, handleApiError, jsonError } from "@/lib/apiHelpers";
import { sendReminderEmail } from "@/lib/email";
import { createPledgePaymentLink } from "@/lib/stripeHelpers";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await withPermission("envoyer_relances");
    const ref = adminDb().collection("pledges").doc(params.id);
    const snap = await ref.get();
    if (!snap.exists) return jsonError("Promesse introuvable.", 404);
    const pledge = snap.data() as any;

    if (pledge.status === "paye") return jsonError("Ce don a déjà été payé.", 400);
    if (pledge.status === "annule") return jsonError("Cette promesse a été annulée.", 400);
    if (!pledge.donorEmail) {
      return jsonError("Ce fidèle n'a pas d'adresse e-mail enregistrée.", 400);
    }

    let paymentLinkUrl = pledge.stripePaymentLinkUrl;
    let paymentLinkId = pledge.stripePaymentLinkId;
    if (!paymentLinkUrl) {
      const link = await createPledgePaymentLink({
        pledgeId: pledge.id,
        amount: pledge.amount,
        donorName: pledge.donorName,
        catalogItemName: pledge.catalogItemName,
      });
      paymentLinkUrl = link.url;
      paymentLinkId = link.id;
    }

    await sendReminderEmail({
      to: pledge.donorEmail,
      donorName: pledge.donorName,
      amount: pledge.amount,
      catalogItemName: pledge.catalogItemName,
      serviceLabel: pledge.serviceLabel,
      payUrl: paymentLinkUrl,
    });

    const now = new Date().toISOString();
    await ref.update({
      status: "relance_envoyee",
      stripePaymentLinkUrl: paymentLinkUrl,
      stripePaymentLinkId: paymentLinkId,
      remindersSentCount: (pledge.remindersSentCount || 0) + 1,
      lastReminderAt: now,
      updatedAt: now,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
