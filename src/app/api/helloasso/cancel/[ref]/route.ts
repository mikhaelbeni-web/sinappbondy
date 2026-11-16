import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { confirmCheckout } from "@/lib/helloasso";
import { settleBooking } from "@/lib/seatingServer";
import { settleKiddushPledge } from "@/lib/kiddushServer";

// Le payeur a quitté HelloAsso sans payer une réservation (places des fêtes
// ou kiddouch) : ce qui était gardé est remis à disposition tout de suite (sauf si HelloAsso
// indique que le paiement a finalement abouti).
export async function GET(req: NextRequest, { params }: { params: { ref: string } }) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
  try {
    if (!/^[A-Za-z0-9]{1,40}$/.test(params.ref)) return NextResponse.redirect(`${appUrl}/merci?annule=1`, 303);
    const ref = adminDb().collection("checkouts").doc(params.ref);
    const checkout = (await ref.get()).data() as any;
    // Parrainage de kiddouch abandonné : le Chabbat gardé est libéré tout de suite.
    if (checkout?.metadata?.kind === "pledge" && checkout.metadata.kiddouch && checkout.metadata.pledgeId) {
      if (await confirmCheckout(params.ref)) return NextResponse.redirect(`${appUrl}/merci`, 303);
      await ref.update({ status: "abandonne" });
      await settleKiddushPledge(checkout.metadata.pledgeId, true);
      return NextResponse.redirect(`${appUrl}/kiddouch?annule=1`, 303);
    }
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
