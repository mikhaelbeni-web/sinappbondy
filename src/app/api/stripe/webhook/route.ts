import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { getStripe } from "@/lib/stripe";
import { recordPayment } from "@/lib/payments";
import { autoReceiptForPayment } from "@/lib/receipts";
import { findOrCreateDonor } from "@/lib/donors";

// Stripe a besoin du corps brut de la requête pour vérifier la signature.
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Webhook non configuré." }, { status: 400 });
  }

  const rawBody = await req.text();
  const stripe = getStripe();

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err: any) {
    console.error("Signature Stripe invalide:", err.message);
    return NextResponse.json({ error: "Signature invalide." }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as any;
    if (session.payment_status && session.payment_status !== "paid") {
      return NextResponse.json({ received: true });
    }
    const pledgeId: string | undefined = session.metadata?.pledgeId;
    let donorId: string | undefined = session.metadata?.donorId;
    const amount = (session.amount_total || 0) / 100;

    // Les anciens Payment Links ne portent que pledgeId : on retrouve le fidèle.
    if (pledgeId && !donorId) {
      const snap = await adminDb().collection("pledges").doc(pledgeId).get();
      if (snap.exists) donorId = (snap.data() as any).donorId;
    }

    const isDonation = session.metadata?.kind === "don";
    if (isDonation && amount > 0) {
      const m = session.metadata;
      donorId = await findOrCreateDonor({
        firstName: m.firstName,
        lastName: m.lastName,
        email: m.email,
        address: m.address,
        postalCode: m.postalCode,
        city: m.city,
      });
    }

    if (donorId && amount > 0) {
      // L'id du paiement = id de la session : un webhook rejoué ne compte pas deux fois.
      const payment = await recordPayment({
        id: session.id,
        donorId,
        pledgeId: pledgeId || null,
        // Un don libre ne vient pas solder les promesses du fidèle.
        allocate: !isDonation,
        campaignId: session.metadata?.campaignId || null,
        amount,
        method: "cb_en_ligne",
        reference: session.payment_intent || session.id,
        date: new Date().toISOString().slice(0, 10),
        stripeCheckoutSessionId: session.id,
        createdBy: "stripe",
        createdByName: "Paiement en ligne",
      });
      if (payment) await autoReceiptForPayment(payment, "Paiement en ligne");
    }
  }

  return NextResponse.json({ received: true });
}
