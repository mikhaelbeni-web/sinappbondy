import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { withPermission, handleApiError, jsonError } from "@/lib/apiHelpers";
import { hasPermission } from "@/lib/permissions";
import { sendReminderEmail } from "@/lib/email";
import { payUrl, donorEmailOf } from "@/lib/payments";
import { remainingOf } from "@/lib/format";
import { getAssociation } from "@/lib/associationServer";

export const maxDuration = 60;

// Relance en une fois toutes les promesses restant dues (en attente, déjà relancées
// ou partielles), visibles par
// l'utilisateur) qui ont un e-mail de fidèle renseigné.
export async function POST(req: NextRequest) {
  try {
    const user = await withPermission("envoyer_relances");
    const body = await req.json().catch(() => ({}));
    const pledgeIds: string[] | undefined = body?.pledgeIds;

    let query: FirebaseFirestore.Query = adminDb().collection("pledges").where("status", "in", ["en_attente", "relance_envoyee", "partiel"]);
    if (!hasPermission(user.role, "voir_tout")) {
      query = query.where("createdBy", "==", user.uid);
    }
    const snap = await query.get();

    let docs = snap.docs;
    if (Array.isArray(pledgeIds) && pledgeIds.length) {
      docs = docs.filter((d) => pledgeIds.includes(d.id));
    }

    const results: { id: string; ok: boolean; error?: string }[] = [];
    const { legalName } = await getAssociation();

    for (const d of docs) {
      const pledge = d.data() as any;
      try {
        const to = await donorEmailOf(pledge);
        if (!to) {
          results.push({ id: d.id, ok: false, error: "Pas d'e-mail" });
          continue;
        }
        // Lien signé : le montant (reste dû) est recalculé au moment du clic.
        const link = payUrl({ kind: "pledge", id: pledge.id });

        const sent = await sendReminderEmail({
          senderName: legalName,
          to,
          donorName: pledge.donorName,
          amount: remainingOf(pledge),
          catalogItemName: pledge.catalogItemName,
          serviceLabel: pledge.serviceLabel,
          payUrl: link,
        });
        if (!sent.sent) {
          results.push({ id: d.id, ok: false, error: sent.reason });
          continue;
        }

        const now = new Date().toISOString();
        await d.ref.update({
          status: pledge.status === "partiel" ? "partiel" : "relance_envoyee",
          remindersSentCount: (pledge.remindersSentCount || 0) + 1,
          lastReminderAt: now,
          updatedAt: now,
        });
        results.push({ id: d.id, ok: true });
      } catch (e: any) {
        results.push({ id: d.id, ok: false, error: e?.message || "Erreur" });
      }
    }

    return NextResponse.json({ results });
  } catch (err) {
    return handleApiError(err);
  }
}
