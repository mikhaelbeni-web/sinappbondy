import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { handleApiError, jsonError } from "@/lib/apiHelpers";
import { findDonorsByEmail } from "@/lib/donors";
import { DONOR_COOKIE, DONOR_COOKIE_OPTIONS, createDonorToken, currentDonorId } from "@/lib/donorSession";
import { sendSeatConfirmationEmail } from "@/lib/email";
import { payUrl } from "@/lib/payments";
import { HOLD_MINUTES, ONLINE_DONOR_NOTE, bookSeats, settleBooking, settlePendingSeats } from "@/lib/seatingServer";
import type { SeatingPlanDoc } from "@/lib/seating";

// Réservation sans compte : le visiteur a choisi ses places, il donne son
// nom et son e-mail. La fiche du fidèle est retrouvée par e-mail ou créée.
// Places gratuites : réservées aussitôt, e-mail de confirmation envoyé.
// Places payantes : seulement gardées HOLD_MINUTES, le visiteur est envoyé
// au paiement ; elles ne sont réservées (et confirmées par e-mail) qu'une
// fois payées, sinon elles sont remises en vente.
// Une fiche existante n'est jamais ouverte ici (pas de cookie) : seul le
// lien envoyé à son adresse y donne accès.
export async function POST(req: NextRequest, { params }: { params: { planId: string } }) {
  try {
    const body = await req.json();
    const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
    const db = adminDb();

    let donorId = currentDonorId();
    if (donorId && !(await db.collection("donors").doc(donorId).get()).exists) donorId = null;
    // Gardes expirées : à libérer avant de regarder ce qui est libre.
    const plan = (await db.collection("seatingPlans").doc(params.planId).get()).data() as SeatingPlanDoc | undefined;
    if (plan) await settlePendingSeats(plan).catch((e) => console.error("[seating] gardes", e));
    let created = false;
    if (!donorId) {
      const firstName = str(body.firstName, 80);
      const lastName = str(body.lastName, 80);
      const email = str(body.email, 120);
      if (!firstName || !lastName || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return jsonError("Prénom, nom et e-mail valides sont requis.", 400);
      const existing = (await findDonorsByEmail(email))[0];
      if (existing) donorId = existing.id;
      else {
        const now = new Date().toISOString();
        const ref = db.collection("donors").doc();
        await ref.set({ id: ref.id, firstName, lastName, email, phone: str(body.phone, 30), address: "", postalCode: "", city: "", notes: ONLINE_DONOR_NOTE, createdAt: now, updatedAt: now });
        donorId = ref.id;
        created = true;
      }
    }

    let result;
    try {
      result = await bookSeats({ planId: params.planId, donorId: donorId!, seats: body.seats, source: "page publique" });
    } catch (err) {
      // Fiche créée pour rien (place prise entre-temps, plafond…) : on la retire.
      if (created) await db.collection("donors").doc(donorId!).delete().catch(() => {});
      throw err;
    }

    let url: string | null = null;
    if (result.total > 0) {
      try {
        url = payUrl({ kind: "booking", id: result.bookingId });
      } catch (err) {
        // Pas de paiement en ligne possible : rien n'est gardé.
        console.error("[seating] lien de paiement", err);
        await settleBooking(result.bookingId, true).catch(() => {});
        return jsonError("Le paiement en ligne est indisponible : ces places ne peuvent pas être réservées ici. Contactez la synagogue.", 503);
      }
    }
    let emailed = false;
    // Places payantes : l'e-mail de confirmation part après le paiement.
    if (result.total === 0 && result.donorEmail) {
      const r = await sendSeatConfirmationEmail({
        to: result.donorEmail,
        donorName: result.donorName,
        planName: result.planName,
        seats: result.booked,
        due: result.total,
        payUrl: url,
        espaceUrl: `${appUrl}/espace/connexion?t=${encodeURIComponent(createDonorToken(donorId!))}`,
      }).catch(() => ({ sent: false }));
      emailed = !!r.sent;
    }

    const res = NextResponse.json({ booked: result.booked, total: result.total, payUrl: url, created, emailed, holdMinutes: HOLD_MINUTES });
    if (created) res.cookies.set(DONOR_COOKIE, createDonorToken(donorId!), DONOR_COOKIE_OPTIONS);
    return res;
  } catch (err) {
    return handleApiError(err);
  }
}
