import { NextRequest, NextResponse } from "next/server";
import { getEventBySlug, seatsTaken } from "@/lib/events";

export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const e = await getEventBySlug(params.slug);
    if (!e || !e.active) return NextResponse.json({ error: "Événement introuvable ou inscriptions closes." }, { status: 404 });
    const taken = await seatsTaken(e.id);
    return NextResponse.json({
      event: {
        title: e.title,
        description: e.description,
        date: e.date,
        location: e.location,
        price: e.price,
        remaining: e.capacity > 0 ? Math.max(0, e.capacity - taken) : null,
      },
    });
  } catch (err) {
    console.error("[public/events]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
