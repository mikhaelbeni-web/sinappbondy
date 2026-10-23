import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { withPermission, handleApiError, jsonError } from "@/lib/apiHelpers";
import { sendReminderEmail } from "@/lib/email";
import { payUrl, donorEmailOf } from "@/lib/payments";
import { remainingOf } from "@/lib/format";
import { getAssociation } from "@/lib/associationServer";

// Laisse le temps à Gmail de répondre (ou d'échouer) avant la coupure.
export const maxDuration = 30;

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await withPermission("envoyer_relances");
    const ref = adminDb().collection("pledges").doc(params.id);
    const snap = await ref.get();
    if (!snap.exists) return jsonError("Promesse introuvable.", 404);
    const pledge = snap.data() as any;

    if (pledge.status === "paye") return jsonError("Ce don a déjà été payé.", 400);
    if (pledge.status === "annule") return jsonError("Cette promesse a été annulée.", 400);
    // L'e-mail copié sur la promesse peut dater d'avant sa saisie sur la fiche.
    const to = await donorEmailOf(pledge);
    if (!to) {
      return jsonError(`${pledge.donorName || "Ce fidèle"} n'a pas d'adresse e-mail : ajoutez-la sur sa fiche.`, 400);
    }

    // Lien signé : le montant (reste dû) est recalculé au moment du clic.
    const link = payUrl({ kind: "pledge", id: pledge.id });

    const association = await getAssociation();
    const sent = await sendReminderEmail({
      senderName: association.legalName,
      to,
      donorName: pledge.donorName,
      amount: remainingOf(pledge),
      catalogItemName: pledge.catalogItemName,
      serviceLabel: pledge.serviceLabel,
      payUrl: link,
    });
    if (!sent.sent) return jsonError(`E-mail non envoyé : ${sent.reason}.`, 400);

    const now = new Date().toISOString();
    await ref.update({
      // Un paiement partiel reste visible comme tel après relance.
      status: pledge.status === "partiel" ? "partiel" : "relance_envoyee",
      remindersSentCount: (pledge.remindersSentCount || 0) + 1,
      lastReminderAt: now,
      updatedAt: now,
    });

    return NextResponse.json({ ok: true, to });
  } catch (err) {
    return handleApiError(err);
  }
}
