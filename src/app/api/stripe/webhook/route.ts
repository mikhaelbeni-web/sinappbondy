import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { getStripe } from "@/lib/stripe";

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
    const pledgeId = session.metadata?.pledgeId;

    if (pledgeId) {
      const ref = adminDb().collection("pledges").doc(pledgeId);
      const snap = await ref.get();
      if (snap.exists) {
        await ref.update({
          status: "paye",
          paidAt: new Date().toISOString(),
          stripeCheckoutSessionId: session.id,
          updatedAt: new Date().toISOString(),
        });
      }
    }
  }

  return NextResponse.json({ received: true });
}
