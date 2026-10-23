import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { safeEqual, signValue } from "@/lib/payments";

// Lien d'annulation envoyé dans l'e-mail de confirmation (signé).
export async function GET(req: NextRequest) {
  const base = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
  const id = req.nextUrl.searchParams.get("id") || "";
  const t = req.nextUrl.searchParams.get("t") || "";
  if (!/^\d{4}-\d{2}-\d{2}_\d{4}$/.test(id) || !safeEqual(signValue(`mikve:${id}`), t)) {
    return NextResponse.redirect(`${base}/mikve?annulation=erreur`);
  }
  await adminDb().collection("mikveBookings").doc(id).delete();
  return NextResponse.redirect(`${base}/mikve?annulation=ok`);
}
