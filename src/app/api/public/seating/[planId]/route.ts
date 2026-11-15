import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { handleApiError, jsonError } from "@/lib/apiHelpers";
import { findDonorsByEmail } from "@/lib/donors";
import { DONOR_COOKIE, DONOR_COOKIE_OPTIONS, createDonorToken, currentDonorId } from "@/lib/donorSession";
import { sendSeatConfirmationEmail } from "@/lib/email";
import { payUrl } from "@/lib/payments";
import { bookSeats } from "@/lib/seatingServer";

// Réservation sans compte : le visiteur a choisi ses places, il donne son
// nom et son e-mail. La fiche du fidèle est retrouvée par e-mail ou créée,
// les places et les sommes dues lui sont rattachées, et il reçoit un e-mail
// avec ses places, le lien de règlement et l'accès à son espace.
// Une fiche existante n'est jamais ouverte ici (pas de cookie) : seul le
// lien envoyé à son adresse y donne accès.
export async function POST(req: NextRequest, { params }: { params: { planId: string } }) {
  try {
    const body = await req.json();
    const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
    const db = adminDb();

    let donorId = currentDonorId();
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
        await ref.set({ id: ref.id, firstName, lastName, email, phone: str(body.phone, 30), address: "", postalCode: "", city: "", notes: "Créé par une réservation de places en ligne", createdAt: now, updatedAt: now });
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
    try {
      if (result.total > 0) url = payUrl({ kind: "booking", id: result.bookingId });
    } catch {}
    let emailed = false;
    if (result.donorEmail) {
      const r = await sendSeatConfirmationEmail({
        to: result.donorEmail,
        donorName: result.donorName,
        planName: result.planName,
        seats: result.booked,
        due: result.total,
        payUrl: url,
        espaceUrl: `${appUrl}/espace/connexion?t=${encodeURIComponent(createDonorToken(donorId!))}`,
        holdHours: result.total > 0 ? result.holdHours : 0,
      }).catch(() => ({ sent: false }));
      emailed = !!r.sent;
    }

    const res = NextResponse.json({ booked: result.booked, total: result.total, payUrl: url, created, emailed, holdHours: result.holdHours });
    if (created) res.cookies.set(DONOR_COOKIE, createDonorToken(donorId!), DONOR_COOKIE_OPTIONS);
    return res;
  } catch (err) {
    return handleApiError(err);
  }
}
