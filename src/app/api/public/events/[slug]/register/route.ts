import { NextRequest, NextResponse } from "next/server";
import { findOrCreateDonor } from "@/lib/donors";
import { createRegistration, getEventBySlug, seatsTaken, ticketUrl } from "@/lib/events";
import { createCheckoutSession } from "@/lib/stripeHelpers";

// Inscription publique : gratuite → billet immédiat ; payante → Stripe,
// le billet part à la confirmation du paiement (webhook).
export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const body = await req.json();
    const str = (v: unknown, max = 120) => (typeof v === "string" ? v.trim().slice(0, max) : "");
    const firstName = str(body.firstName, 80);
    const lastName = str(body.lastName, 80);
    const email = str(body.email);
    const qty = Math.round(Number(body.qty));
    if (!firstName || !lastName || !email.includes("@")) return NextResponse.json({ error: "Prénom, nom et e-mail sont requis." }, { status: 400 });
    if (!(qty >= 1 && qty <= 20)) return NextResponse.json({ error: "Entre 1 et 20 places." }, { status: 400 });

    const event = await getEventBySlug(params.slug);
    if (!event || !event.active) return NextResponse.json({ error: "Inscriptions closes." }, { status: 400 });
    if (event.capacity > 0 && (await seatsTaken(event.id)) + qty > event.capacity) {
      return NextResponse.json({ error: "Plus assez de places disponibles." }, { status: 400 });
    }

    if (event.price === 0) {
      const donorId = await findOrCreateDonor({ firstName, lastName, email });
      const reg = await createRegistration({ event, donorId, name: `${firstName} ${lastName}`, email, qty, amount: 0, paymentId: null });
      return NextResponse.json({ ticketUrl: ticketUrl(reg.code) });
    }

    const url = await createCheckoutSession({
      amount: event.price * qty,
      label: `${event.title} - ${qty} place${qty > 1 ? "s" : ""}`,
      email,
      metadata: { kind: "billet", eventId: event.id, qty: String(qty), firstName, lastName, email },
    });
    return NextResponse.json({ url });
  } catch (err) {
    console.error("[public/events/register]", err);
    return NextResponse.json({ error: "Inscription impossible pour le moment." }, { status: 500 });
  }
}
