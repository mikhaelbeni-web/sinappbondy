import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { SESSION_COOKIE } from "@/lib/serverAuth";
import { handleApiError, jsonError } from "@/lib/apiHelpers";

// Connexion : reçoit un idToken Firebase (obtenu côté client via
// signInWithEmailAndPassword) et pose un cookie de session httpOnly.
export async function POST(req: NextRequest) {
  try {
    const { idToken } = await req.json();
    if (!idToken) return jsonError("idToken manquant", 400);

    const decoded = await adminAuth().verifyIdToken(idToken);

    const memberSnap = await adminDb().collection("team").doc(decoded.uid).get();
    if (!memberSnap.exists) {
      return jsonError("Ce compte n'est pas encore rattaché à un poste. Contactez un administrateur.", 403);
    }
    const member = memberSnap.data() as any;
    if (!member.active) {
      return jsonError("Ce compte a été désactivé.", 403);
    }

    const expiresIn = 14 * 24 * 60 * 60 * 1000; // 14 jours
    const sessionCookie = await adminAuth().createSessionCookie(idToken, { expiresIn });

    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: expiresIn / 1000,
    });
    return res;
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
