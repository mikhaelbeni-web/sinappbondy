import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { withPermission, handleApiError, jsonError } from "@/lib/apiHelpers";
import { hasPermission } from "@/lib/permissions";
import { sendReminderEmail } from "@/lib/email";
import { createPledgePaymentLink } from "@/lib/stripeHelpers";

// Relance en une fois toutes les promesses "en attente" (visibles par
// l'utilisateur) qui ont un e-mail de fidèle renseigné.
export async function POST(req: NextRequest) {
  try {
    const user = await withPermission("envoyer_relances");
    const body = await req.json().catch(() => ({}));
    const pledgeIds: string[] | undefined = body?.pledgeIds;

    let query: FirebaseFirestore.Query = adminDb().collection("pledges").where("status", "==", "en_attente");
    if (!hasPermission(user.role, "voir_tout")) {
      query = query.where("createdBy", "==", user.uid);
    }
    const snap = await query.get();

    let docs = snap.docs;
    if (Array.isArray(pledgeIds) && pledgeIds.length) {
      docs = docs.filter((d) => pledgeIds.includes(d.id));
    }

    const results: { id: string; ok: boolean; error?: string }[] = [];

    for (const d of docs) {
      const pledge = d.data() as any;
      try {
        if (!pledge.donorEmail) {
          results.push({ id: d.id, ok: false, error: "Pas d'e-mail" });
          continue;
        }
        let paymentLinkUrl = pledge.stripePaymentLinkUrl;
        let paymentLinkId = pledge.stripePaymentLinkId;
        if (!paymentLinkUrl) {
          const link = await createPledgePaymentLink({
            pledgeId: pledge.id,
            amount: pledge.amount,
            donorName: pledge.donorName,
            catalogItemName: pledge.catalogItemName,
          });
          paymentLinkUrl = link.url;
          paymentLinkId = link.id;
        }

        await sendReminderEmail({
          to: pledge.donorEmail,
          donorName: pledge.donorName,
          amount: pledge.amount,
          catalogItemName: pledge.catalogItemName,
          serviceLabel: pledge.serviceLabel,
          payUrl: paymentLinkUrl,
        });

        const now = new Date().toISOString();
        await d.ref.update({
          status: "relance_envoyee",
          stripePaymentLinkUrl: paymentLinkUrl,
          stripePaymentLinkId: paymentLinkId,
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
