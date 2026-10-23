import { adminDb } from "./firebaseAdmin";
import { paidOf, round2 } from "./format";
import type { SessionUser } from "./types";

// Modification, annulation et suppression des promesses saisies à la main.
// Règles : on ne descend jamais sous ce qui est déjà réglé, une promesse qui
// a reçu un paiement ne se supprime pas (on l'annule), et chaque changement
// laisse une trace dans la collection auditLog (qui, quand, avant/après).

function fail(message: string, status: number): never {
  const err: any = new Error(message);
  err.status = status;
  throw err;
}

// Statut d'une promesse non annulée d'après son montant et ce qui est réglé.
export function statusFor(p: { amount: number; remindersSentCount?: number }, paid: number): string {
  if (paid >= p.amount) return "paye";
  if (paid > 0) return "partiel";
  return (p.remindersSentCount || 0) > 0 ? "relance_envoyee" : "en_attente";
}

// Les places des fêtes et les cotisations se gèrent depuis leur propre page.
function assertManual(p: any) {
  if (p.kind === "place") fail("Cette somme due vient d'une place des fêtes : gérez-la depuis la page Places des fêtes.", 409);
  if (p.kind === "cotisation") fail("Cette somme due est une cotisation : gérez-la depuis la page Cotisations.", 409);
}

function assertAccess(user: SessionUser, p: any, canSeeAll: boolean) {
  if (!canSeeAll && p.createdBy !== user.uid) fail("Accès refusé.", 403);
}

// Un paiement HelloAsso ouvert il y a moins de 45 minutes (durée de vie d'un
// panier) peut encore aboutir avec l'ancien montant : on attend qu'il expire.
async function assertNoCheckoutInProgress(pledgeId: string) {
  const snap = await adminDb().collection("checkouts").where("metadata.pledgeId", "==", pledgeId).get();
  const limit = Date.now() - 45 * 60_000;
  const open = snap.docs.some((d) => {
    const c = d.data() as any;
    return c.status === "en_attente" && Date.parse(c.createdAt) > limit;
  });
  if (open) fail("Un paiement en ligne de cette promesse est en cours. Réessayez dans 45 minutes.", 409);
}

function audit(tx: FirebaseFirestore.Transaction, user: SessionUser, pledgeId: string, action: string, before: any, after: any) {
  const ref = adminDb().collection("auditLog").doc();
  tx.set(ref, {
    id: ref.id,
    entity: "pledge",
    entityId: pledgeId,
    action,
    before,
    after,
    by: user.uid,
    byName: user.name,
    at: new Date().toISOString(),
  });
}

function snapshotOf(p: any) {
  return {
    amount: p.amount,
    amountPaid: paidOf(p),
    status: p.status,
    catalogItemName: p.catalogItemName,
    notes: p.notes || "",
    donorId: p.donorId,
    donorName: p.donorName,
    serviceLabel: p.serviceLabel,
  };
}

export async function updatePledge(
  user: SessionUser,
  canSeeAll: boolean,
  pledgeId: string,
  input: { amount?: unknown; catalogItemName?: unknown; notes?: unknown; status?: unknown }
): Promise<any> {
  const db = adminDb();
  const ref = db.collection("pledges").doc(pledgeId);

  const first = await ref.get();
  if (!first.exists) fail("Promesse introuvable.", 404);
  const changesAmountOrStatus = input.amount !== undefined || input.status !== undefined;
  if (changesAmountOrStatus) await assertNoCheckoutInProgress(pledgeId);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) fail("Promesse introuvable.", 404);
    const p = snap.data() as any;
    assertAccess(user, p, canSeeAll);

    const paid = paidOf(p);
    const update: any = {};

    if (typeof input.notes === "string") update.notes = input.notes.trim();
    if (typeof input.catalogItemName === "string") {
      const name = input.catalogItemName.trim();
      if (!name) fail("L'objet de la promesse ne peut pas être vide.", 400);
      if (name !== p.catalogItemName) {
        assertManual(p);
        update.catalogItemName = name;
      }
    }

    let amount = p.amount;
    if (input.amount !== undefined) {
      const n = round2(Number(input.amount));
      if (!Number.isFinite(n) || n <= 0) fail("Le montant doit être positif.", 400);
      if (n !== p.amount) {
        assertManual(p);
        if (p.status === "annule") fail("Cette promesse est annulée : rétablissez-la avant de changer son montant.", 409);
        if (n < paid) fail(`Montant impossible : ${paid} € ont déjà été réglés sur cette promesse.`, 409);
        amount = n;
        update.amount = n;
      }
    }

    let status = p.status;
    if (input.status === "annule") {
      if (p.status !== "annule" && paid >= p.amount) fail("Cette promesse est entièrement réglée : elle ne peut pas être annulée.", 409);
      status = "annule";
    }
    else if (input.status === "en_attente" || input.status === "actif") status = statusFor({ ...p, amount }, paid);
    else if (input.status !== undefined) fail("Statut inconnu.", 400);
    else if (status !== "annule" && update.amount !== undefined) status = statusFor({ ...p, amount }, paid);

    if (status !== p.status) {
      update.status = status;
      // Le passage à « payé » par baisse du montant date du jour de la modification.
      update.paidAt = status === "paye" ? p.paidAt || new Date().toISOString() : status === "annule" ? p.paidAt || null : null;
    }

    if (!Object.keys(update).length) return p;
    update.updatedAt = new Date().toISOString();
    const after = { ...p, ...update };
    tx.update(ref, update);

    const action = update.status === "annule" ? "annulation" : p.status === "annule" && update.status ? "retablissement" : "modification";
    audit(tx, user, pledgeId, action, snapshotOf(p), snapshotOf(after));
    return after;
  });
}

// Suppression définitive, réservée aux promesses sans aucun paiement.
export async function deletePledge(user: SessionUser, canSeeAll: boolean, pledgeId: string): Promise<void> {
  const db = adminDb();
  const ref = db.collection("pledges").doc(pledgeId);

  const first = await ref.get();
  if (!first.exists) fail("Promesse introuvable.", 404);
  const donorId = (first.data() as any).donorId;
  assertManual(first.data());
  await assertNoCheckoutInProgress(pledgeId);

  // Filet en plus de amountPaid : un paiement du fidèle encore affecté à
  // cette promesse (et donc peut-être sur un reçu fiscal) bloque la suppression.
  const payments = await db.collection("payments").where("donorId", "==", donorId).get();
  const linked = payments.docs.some((d) => ((d.data() as any).allocations || []).some((a: any) => a.pledgeId === pledgeId));

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) fail("Promesse introuvable.", 404);
    const p = snap.data() as any;
    assertAccess(user, p, canSeeAll);
    if (linked || paidOf(p) > 0) {
      fail("Cette promesse a déjà reçu un paiement : elle ne peut pas être supprimée. Annulez-la à la place.", 409);
    }
    tx.delete(ref);
    audit(tx, user, pledgeId, "suppression", snapshotOf(p), null);
  });
}
