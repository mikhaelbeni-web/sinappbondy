import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { handleApiError, jsonError } from "@/lib/apiHelpers";
import { escapeForEmail, sendNoticeEmail } from "@/lib/email";
import { getKiddushSettings } from "@/lib/kiddushServer";
import { getPortal } from "@/lib/portalServer";

export const dynamic = "force-dynamic";

const todayIso = () => new Date().toISOString().slice(0, 10);

// Réglages publics des salons et dates déjà confirmées (sans aucun nom).
export async function GET() {
  try {
    const s = await getKiddushSettings();
    let booked: string[] = [];
    try {
      const snap = await adminDb().collection("salonRequests").where("date", ">=", todayIso()).get();
      booked = snap.docs.map((d) => d.data() as any).filter((r) => r.status === "confirmee").map((r) => r.date);
    } catch (err) {
      console.error("[salons]", err);
    }
    return NextResponse.json({ enabled: s.salonsEnabled, intro: s.salonsIntro, capacity: s.salonsCapacity, eventTypes: s.salonEventTypes, booked }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return handleApiError(err);
  }
}

// Demande de réservation des salons : enregistrée, puis validée par l'équipe.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
    if (str(body.website, 10)) return NextResponse.json({ ok: true }); // champ piège pour robots
    const s = await getKiddushSettings();
    if (!s.salonsEnabled) return jsonError("Les demandes en ligne sont fermées pour le moment.", 403);
    const date = str(body.date, 10);
    const name = str(body.name, 120);
    const email = str(body.email, 120);
    const phone = str(body.phone, 30);
    const eventType = s.salonEventTypes.includes(body.eventType) ? body.eventType : "";
    const guests = Math.round(Number(body.guests) || 0);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date <= todayIso()) return jsonError("Choisissez une date à venir.", 400);
    if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !phone) return jsonError("Nom, e-mail valide et téléphone sont requis.", 400);
    if (!eventType) return jsonError("Choisissez le type d'événement.", 400);
    if (guests < 1 || guests > 1000) return jsonError("Indiquez le nombre d'invités.", 400);

    const db = adminDb();
    const sameDay = await db.collection("salonRequests").where("date", "==", date).get();
    if (sameDay.docs.some((d) => (d.data() as any).status === "confirmee")) return jsonError("Les salons sont déjà réservés à cette date. Choisissez-en une autre.", 409);
    if (sameDay.docs.some((d) => (d.data() as any).email?.toLowerCase() === email.toLowerCase())) return jsonError("Vous avez déjà envoyé une demande pour cette date.", 409);

    const ref = db.collection("salonRequests").doc();
    const now = new Date().toISOString();
    await ref.set({ id: ref.id, date, eventType, guests, name, email, phone, message: str(body.message, 1000), status: "nouvelle", createdAt: now, updatedAt: now });

    const day = new Date(`${date}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
    const summary = `<p><strong>${escapeForEmail(eventType)}</strong>, ${escapeForEmail(day)}, ${guests} invité(s).</p>`;
    const portal = await getPortal();
    const notify = s.notifyEmail || portal.email;
    await Promise.all([
      sendNoticeEmail({
        to: email,
        subject: "Votre demande de réservation des salons",
        bodyHtml: `<p>Chalom ${escapeForEmail(name)},</p><p>Nous avons bien reçu votre demande :</p>${summary}<p>La date n'est pas encore réservée : le secrétariat vous recontacte pour la confirmer et établir le devis.</p>`,
      }).catch(() => null),
      notify
        ? sendNoticeEmail({
            to: notify,
            subject: `Demande de salon : ${eventType} le ${date}`,
            bodyHtml: `${summary}<p>${escapeForEmail(name)} · ${escapeForEmail(phone)} · ${escapeForEmail(email)}</p>${body.message ? `<p>${escapeForEmail(str(body.message, 1000))}</p>` : ""}<p>À traiter dans Administration &gt; Kiddouch &amp; salons.</p>`,
          }).catch(() => null)
        : null,
    ]);
    return NextResponse.json({ ok: true, day });
  } catch (err) {
    return handleApiError(err);
  }
}
