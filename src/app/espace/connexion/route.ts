import { NextRequest, NextResponse } from "next/server";
import { DONOR_COOKIE, DONOR_COOKIE_OPTIONS, verifyDonorToken } from "@/lib/donorSession";

// Lien reçu par e-mail : pose le cookie de session puis ouvre l'espace.
export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
  const token = new URL(req.url).searchParams.get("t");
  if (!verifyDonorToken(token)) return NextResponse.redirect(`${appUrl}/espace?expire=1`, 303);
  const res = NextResponse.redirect(`${appUrl}/espace`, 303);
  res.cookies.set(DONOR_COOKIE, token!, DONOR_COOKIE_OPTIONS);
  return res;
}
