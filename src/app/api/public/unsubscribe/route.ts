import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { safeEqual, signValue } from "@/lib/payments";

// Lien « ne plus recevoir ces messages » en pied des messages groupés.
// Les relances de dons et les reçus fiscaux restent envoyés.
export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
  const { searchParams } = new URL(req.url);
  const donorId = searchParams.get("d") || "";
  const token = searchParams.get("t") || "";
  try {
    if (!donorId || !safeEqual(signValue(`optout:${donorId}`), token)) {
      return NextResponse.redirect(`${appUrl}/merci?erreur=lien`, 303);
    }
    const ref = adminDb().collection("donors").doc(donorId);
    if ((await ref.get()).exists) await ref.update({ emailOptOut: true, updatedAt: new Date().toISOString() });
    return NextResponse.redirect(`${appUrl}/merci?desinscrit=1`, 303);
  } catch (err) {
    console.error("[unsubscribe]", err);
    return NextResponse.redirect(`${appUrl}/merci?erreur=lien`, 303);
  }
}
