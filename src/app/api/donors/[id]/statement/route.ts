import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { withPermission, handleApiError, jsonError } from "@/lib/apiHelpers";
import { sendStatementEmail } from "@/lib/email";
import { formatDate, remainingOf, round2 } from "@/lib/format";
import { payUrl } from "@/lib/payments";

// Envoie au fidèle son relevé (promesses restant dues) avec un lien unique
// pour régler tout le solde.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await withPermission("envoyer_relances");
    const donorSnap = await adminDb().collection("donors").doc(params.id).get();
    if (!donorSnap.exists) return jsonError("Fidèle introuvable.", 404);
    const donor = donorSnap.data() as any;
    if (!donor.email) return jsonError("Ce fidèle n'a pas d'adresse e-mail enregistrée.", 400);

    const snap = await adminDb().collection("pledges").where("donorId", "==", params.id).get();
    const open = snap.docs
      .map((d) => d.data() as any)
      .filter((p) => remainingOf(p) > 0)
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
    if (!open.length) return jsonError("Rien à régler pour ce fidèle.", 400);

    const total = round2(open.reduce((s, p) => s + remainingOf(p), 0));
    const result = await sendStatementEmail({
      to: donor.email,
      donorName: `${donor.firstName} ${donor.lastName}`,
      lines: open.map((p) => ({
        label: `${p.catalogItemName} (${p.serviceLabel})`,
        date: formatDate(p.createdAt),
        remaining: remainingOf(p),
      })),
      total,
      payUrl: payUrl({ kind: "donor", id: params.id }),
    });
    if (!result.sent) return jsonError(`E-mail non envoyé : ${result.reason}.`, 400);

    const now = new Date().toISOString();
    const batch = adminDb().batch();
    for (const p of open) {
      batch.update(adminDb().collection("pledges").doc(p.id), {
        status: p.status === "partiel" ? "partiel" : "relance_envoyee",
        remindersSentCount: (p.remindersSentCount || 0) + 1,
        lastReminderAt: now,
        updatedAt: now,
      });
    }
    await batch.commit();

    return NextResponse.json({ ok: true, total });
  } catch (err) {
    return handleApiError(err);
  }
}
