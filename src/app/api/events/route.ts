import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { withPermission, handleApiError, jsonError } from "@/lib/apiHelpers";
import { slugify } from "@/lib/campaigns";
import { getEventBySlug } from "@/lib/events";

export async function GET() {
  try {
    await withPermission("gerer_paiements");
    const [eventsSnap, regSnap] = await Promise.all([adminDb().collection("events").get(), adminDb().collection("registrations").get()]);
    const stats: Record<string, { qty: number; amount: number; checkedIn: number }> = {};
    for (const d of regSnap.docs) {
      const r = d.data() as any;
      const s = (stats[r.eventId] ||= { qty: 0, amount: 0, checkedIn: 0 });
      s.qty += r.qty;
      s.amount += r.amount;
      if (r.checkedInAt) s.checkedIn += r.qty;
    }
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
    const events = eventsSnap.docs
      .map((d) => d.data() as any)
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .map((e) => ({ ...e, ...(stats[e.id] || { qty: 0, amount: 0, checkedIn: 0 }), url: `${appUrl}/evenement/${e.slug}` }));
    return NextResponse.json({ events });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    await withPermission("gerer_paiements");
    const { title, description, date, location, price, capacity } = await req.json();
    if (!title?.trim() || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(date || "")) return jsonError("Titre et date sont requis.", 400);
    let slug = slugify(title) || "evenement";
    if (await getEventBySlug(slug)) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
    const ref = adminDb().collection("events").doc();
    const doc = {
      id: ref.id,
      slug,
      title: title.trim(),
      description: typeof description === "string" ? description.trim() : "",
      date,
      location: typeof location === "string" ? location.trim() : "",
      price: Math.max(0, Number(price) || 0),
      capacity: Math.max(0, Math.round(Number(capacity) || 0)),
      active: true,
      createdAt: new Date().toISOString(),
    };
    await ref.set(doc);
    return NextResponse.json({ event: doc });
  } catch (err) {
    return handleApiError(err);
  }
}
