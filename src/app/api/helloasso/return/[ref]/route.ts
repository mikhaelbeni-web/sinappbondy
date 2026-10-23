import { NextRequest, NextResponse } from "next/server";
import { confirmCheckout } from "@/lib/helloasso";

// Retour du payeur après le paiement HelloAsso (?code=succeeded|refused…).
// On confirme tout de suite auprès de l'API pour ne pas attendre le webhook.
export async function GET(req: NextRequest, { params }: { params: { ref: string } }) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
  const code = new URL(req.url).searchParams.get("code");
  if (code && code !== "succeeded") return NextResponse.redirect(`${appUrl}/merci?erreur=refus`, 303);
  try {
    if (/^[A-Za-z0-9]{1,40}$/.test(params.ref)) await confirmCheckout(params.ref);
  } catch (err) {
    // Le webhook prendra le relais.
    console.error("[helloasso/return]", err);
  }
  return NextResponse.redirect(`${appUrl}/merci`, 303);
}
