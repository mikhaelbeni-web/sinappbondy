import { adminDb } from "./firebaseAdmin";
import { sendStatementEmail } from "./email";
import { formatDate, remainingOf, round2 } from "./format";
import { payUrl } from "./payments";

function httpError(message: string, status = 400) {
  const err: any = new Error(message);
  err.status = status;
  return err;
}

// Envoie au fidèle son relevé (promesses restant dues) avec un lien unique
// pour régler tout le solde, puis compte la relance sur chaque promesse.
// `pledges` évite une relecture quand l'appelant les a déjà.
export async function sendDonorStatement(donorId: string, pledges?: any[]): Promise<{ total: number; count: number }> {
  const db = adminDb();
  const donorSnap = await db.collection("donors").doc(donorId).get();
  if (!donorSnap.exists) throw httpError("Fidèle introuvable.", 404);
  const donor = donorSnap.data() as any;
  if (!donor.email) throw httpError("Ce fidèle n'a pas d'adresse e-mail enregistrée.");

  const all = pledges || (await db.collection("pledges").where("donorId", "==", donorId).get()).docs.map((d) => d.data() as any);
  const open = all.filter((p) => remainingOf(p) > 0).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  if (!open.length) throw httpError("Rien à régler pour ce fidèle.");

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
    payUrl: payUrl({ kind: "donor", id: donorId }),
  });
  if (!result.sent) throw httpError(`E-mail non envoyé : ${result.reason}.`);

  const now = new Date().toISOString();
  const batch = db.batch();
  for (const p of open) {
    batch.update(db.collection("pledges").doc(p.id), {
      status: p.status === "partiel" ? "partiel" : "relance_envoyee",
      remindersSentCount: (p.remindersSentCount || 0) + 1,
      lastReminderAt: now,
      updatedAt: now,
    });
  }
  await batch.commit();
  return { total, count: open.length };
}
