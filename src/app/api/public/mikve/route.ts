import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { sendMikveEmail } from "@/lib/email";
import { bookableDates, bookingId, formatSlot, getMikveSettings, mikveCancelUrl, parisNow, slotsFor } from "@/lib/mikve";

// Données lues à chaque requête : pas de pré-rendu au build.
export const dynamic = "force-dynamic";

// Disponibilités publiques : uniquement libre / pris, jamais qui a réservé.
export async function GET() {
  try {
    const s = await getMikveSettings();
    if (!s.enabled) return NextResponse.json({ enabled: false });
    const dates = bookableDates(s);
    const now = parisNow();
    const taken = new Set<string>();
    if (dates.length) {
      const snap = await adminDb().collection("mikveBookings").where("date", ">=", dates[0]).get();
      snap.docs.forEach((d) => taken.add(d.id));
    }
    const days = dates
      .map((date) => ({
        date,
        slots: slotsFor(s, date)
          .filter((t) => `${date}T${t}` > now)
          .map((time) => ({ time, free: !taken.has(bookingId(date, time)) })),
      }))
      .filter((d) => d.slots.length);
    return NextResponse.json({ enabled: true, days, price: s.price, instructions: s.instructions });
  } catch (err) {
    console.error("[public/mikve]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const str = (v: unknown, max = 120) => (typeof v === "string" ? v.trim().slice(0, max) : "");
    const date = str(body.date, 10);
    const time = str(body.time, 5);
    const name = str(body.name, 80);
    const phone = str(body.phone, 30);
    const email = str(body.email);
    if (!name || !email.includes("@")) return NextResponse.json({ error: "Prénom et e-mail sont requis." }, { status: 400 });
    const s = await getMikveSettings();
    if (!s.enabled || !bookableDates(s).includes(date) || !slotsFor(s, date).includes(time) || `${date}T${time}` <= parisNow()) {
      return NextResponse.json({ error: "Ce créneau n'est pas disponible." }, { status: 400 });
    }
    const id = bookingId(date, time);
    try {
      await adminDb().collection("mikveBookings").doc(id).create({ id, date, time, name, phone, email, createdAt: new Date().toISOString() });
    } catch {
      return NextResponse.json({ error: "Ce créneau vient d'être réservé. Choisissez-en un autre." }, { status: 409 });
    }
    try {
      await sendMikveEmail({ to: email, name, when: formatSlot(date, time), instructions: s.instructions, cancelUrl: mikveCancelUrl(id) });
    } catch (e) {
      console.warn("[mikve] confirmation non envoyée:", e);
    }
    return NextResponse.json({ ok: true, when: formatSlot(date, time) });
  } catch (err) {
    console.error("[public/mikve]", err);
    return NextResponse.json({ error: "Réservation impossible pour le moment." }, { status: 500 });
  }
}
