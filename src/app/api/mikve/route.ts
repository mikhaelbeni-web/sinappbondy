import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { withPermission, handleApiError, jsonError } from "@/lib/apiHelpers";
import { getMikveSettings, parisNow } from "@/lib/mikve";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

// Réservations à venir + réglages.
export async function GET() {
  try {
    await withPermission("gerer_offices");
    const today = parisNow().slice(0, 10);
    const [settings, snap] = await Promise.all([
      getMikveSettings(),
      adminDb().collection("mikveBookings").where("date", ">=", today).get(),
    ]);
    const bookings = snap.docs.map((d) => d.data()).sort((a: any, b: any) => (a.id < b.id ? -1 : 1));
    return NextResponse.json({ settings, bookings, publicUrl: `${process.env.NEXT_PUBLIC_APP_URL || ""}/mikve` });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    await withPermission("gerer_offices");
    const b = await req.json();
    const slotMinutes = Math.round(Number(b.slotMinutes));
    const daysAhead = Math.round(Number(b.daysAhead));
    if (!(slotMinutes >= 10 && slotMinutes <= 180)) return jsonError("Durée de créneau entre 10 et 180 minutes.", 400);
    if (!(daysAhead >= 1 && daysAhead <= 60)) return jsonError("Réservation possible de 1 à 60 jours à l'avance.", 400);
    const schedule: Record<string, { start: string; end: string }[]> = {};
    for (let d = 0; d < 7; d++) {
      const ranges = Array.isArray(b.schedule?.[d]) ? b.schedule[d] : [];
      schedule[String(d)] = [];
      for (const r of ranges) {
        if (!TIME.test(r?.start) || !TIME.test(r?.end) || r.start >= r.end) return jsonError("Horaires invalides (hh:mm, début avant fin).", 400);
        schedule[String(d)].push({ start: r.start, end: r.end });
      }
    }
    await adminDb().collection("settings").doc("mikve").set({
      enabled: !!b.enabled,
      slotMinutes,
      daysAhead,
      schedule,
      price: Math.max(0, Number(b.price) || 0),
      instructions: typeof b.instructions === "string" ? b.instructions.slice(0, 2000) : "",
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
