import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { confirmCheckout } from "@/lib/helloasso";

// Retour du payeur après le paiement HelloAsso (?code=succeeded|refused…).
// On confirme tout de suite auprès de l'API pour ne pas attendre le webhook.
export async function GET(req: NextRequest, { params }: { params: { ref: string } }) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
  const code = new URL(req.url).searchParams.get("code");
  if (code && code !== "succeeded") return NextResponse.redirect(`${appUrl}/merci?erreur=refus`, 303);
  try {
    if (/^[A-Za-z0-9]{1,40}$/.test(params.ref)) {
      const paid = await confirmCheckout(params.ref);
      const checkout = (await adminDb().collection("checkouts").doc(params.ref).get()).data() as any;
      if (checkout?.metadata?.kind === "booking") return NextResponse.redirect(`${appUrl}/merci?places=${paid ? 1 : "attente"}`, 303);
    }
  } catch (err) {
    // Le webhook prendra le relais.
    console.error("[helloasso/return]", err);
  }
  return NextResponse.redirect(`${appUrl}/merci`, 303);
}
