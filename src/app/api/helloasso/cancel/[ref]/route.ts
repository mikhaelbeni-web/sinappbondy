import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { confirmCheckout } from "@/lib/helloasso";
import { settleBooking } from "@/lib/seatingServer";

// Le payeur a quitté HelloAsso sans payer une réservation de places : les
// places gardées sont remises en vente tout de suite (sauf si HelloAsso
// indique que le paiement a finalement abouti).
export async function GET(req: NextRequest, { params }: { params: { ref: string } }) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
  try {
    if (!/^[A-Za-z0-9]{1,40}$/.test(params.ref)) return NextResponse.redirect(`${appUrl}/merci?annule=1`, 303);
    const ref = adminDb().collection("checkouts").doc(params.ref);
    const checkout = (await ref.get()).data() as any;
    const bookingId = checkout?.metadata?.kind === "booking" ? checkout.metadata.bookingId : null;
    if (!bookingId) return NextResponse.redirect(`${appUrl}/merci?annule=1`, 303);
    if (await confirmCheckout(params.ref)) return NextResponse.redirect(`${appUrl}/merci?places=1`, 303);
    await ref.update({ status: "abandonne" });
    await settleBooking(bookingId, true);
  } catch (err) {
    console.error("[helloasso/cancel]", err);
  }
  return NextResponse.redirect(`${appUrl}/places?annule=1`, 303);
}
