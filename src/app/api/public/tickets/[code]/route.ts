import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";

// Billet (page ouverte en scannant le QR code) : infos minimales.
export async function GET(_req: NextRequest, { params }: { params: { code: string } }) {
  try {
    const db = adminDb();
    const snap = await db.collection("registrations").where("code", "==", params.code.toUpperCase()).limit(1).get();
    if (snap.empty) return NextResponse.json({ error: "Billet inconnu." }, { status: 404 });
    const r = snap.docs[0].data() as any;
    const e = (await db.collection("events").doc(r.eventId).get()).data() as any;
    return NextResponse.json({
      ticket: { code: r.code, name: r.name, qty: r.qty, checkedInAt: r.checkedInAt, eventId: r.eventId },
      event: e ? { title: e.title, date: e.date, location: e.location } : null,
    });
  } catch (err) {
    console.error("[public/tickets]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
