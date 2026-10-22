import { NextResponse } from "next/server";
import { DONOR_COOKIE } from "@/lib/donorSession";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(DONOR_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
