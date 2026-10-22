import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { getStripe } from "@/lib/stripe";
import { recordPayment } from "@/lib/payments";

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

    if (donorId && amount > 0) {
      // L'id du paiement = id de la session : un webhook rejoué ne compte pas deux fois.
      await recordPayment({
        id: session.id,
        donorId,
        pledgeId: pledgeId || null,
        amount,
        method: "cb_en_ligne",
        reference: session.payment_intent || session.id,
        date: new Date().toISOString().slice(0, 10),
        stripeCheckoutSessionId: session.id,
        createdBy: "stripe",
        createdByName: "Paiement en ligne",
      });
    }
  }

  return NextResponse.json({ received: true });
}
