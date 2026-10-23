import { NextRequest, NextResponse } from "next/server";
import { confirmCheckout } from "@/lib/helloasso";

export const runtime = "nodejs";

// Notifications HelloAsso (Order, Payment…). La signature x-ha-signature n'est
// fournie qu'aux comptes partenaires : on ne lit donc dans la notification que
// la référence du panier (metadata.ref), et confirmCheckout revérifie le
// paiement auprès de l'API HelloAsso avec nos propres identifiants. Une
// notification forgée ne peut donc rien enregistrer.
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ received: true });
  }

  const ref = body?.metadata?.ref || body?.data?.metadata?.ref;
  if (typeof ref !== "string" || !/^[A-Za-z0-9]{1,40}$/.test(ref)) {
    // Notification sans panier de l'appli (formulaire HelloAsso, etc.) : ignorée.
    return NextResponse.json({ received: true });
  }

  try {
    await confirmCheckout(ref);
  } catch (err) {
    console.error("[helloasso/webhook]", err);
    // Réponse non 200 : HelloAsso renverra la notification plus tard.
    return NextResponse.json({ error: "Traitement impossible." }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
