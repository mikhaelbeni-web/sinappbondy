import { createHmac, timingSafeEqual } from "crypto";
import { adminDb } from "./firebaseAdmin";
import { isOpen, paidOf, remainingOf, round2 } from "./format";
import type { PaymentAllocation, PaymentDoc, PaymentMethod } from "./types";

export const PAYMENT_METHODS: PaymentMethod[] = ["cb_en_ligne", "cb_terminal", "cheque", "especes", "virement"];

// Enregistre un paiement et l'affecte aux promesses du fidèle.
// - pledgeId fourni : tout le montant va sur cette promesse.
// - sinon : affectation aux promesses ouvertes, de la plus ancienne à la plus récente.
// Le reliquat éventuel reste sur le paiement (champ unallocated).
// `id` permet l'idempotence (ex. id de la session Stripe Checkout).
export async function recordPayment(params: {
  id?: string;
  donorId: string;
  amount: number;
  method: PaymentMethod;
  reference?: string;
  date: string;
  notes?: string;
  pledgeId?: string | null;
  allocate?: boolean; // false : don libre, non affecté aux promesses
  campaignId?: string | null;
  stripeCheckoutSessionId?: string | null;
  createdBy: string;
  createdByName: string;
}): Promise<PaymentDoc | null> {
  const db = adminDb();
  const amount = round2(params.amount);
  const paymentRef = params.id ? db.collection("payments").doc(params.id) : db.collection("payments").doc();

  // Lecture hors transaction de la liste des promesses (pas de requête
  // dans une transaction Admin sans where indexé) ; on relit chaque
  // promesse dans la transaction pour un cumul exact.
  let candidateIds: string[];
  if (params.allocate === false) {
    candidateIds = [];
  } else if (params.pledgeId) {
    candidateIds = [params.pledgeId];
  } else {
    const snap = await db.collection("pledges").where("donorId", "==", params.donorId).get();
    candidateIds = snap.docs
      .map((d) => d.data() as any)
      .filter((p) => isOpen(p))
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
      .map((p) => p.id);
  }

  return db.runTransaction(async (tx) => {
    const existing = await tx.get(paymentRef);
    if (existing.exists) return null; // déjà enregistré (webhook rejoué)

    const donorSnap = await tx.get(db.collection("donors").doc(params.donorId));
    if (!donorSnap.exists) {
      const err: any = new Error("Fidèle introuvable.");
      err.status = 400;
      throw err;
    }
    const donor = donorSnap.data() as any;

    const pledgeRefs = candidateIds.map((id) => db.collection("pledges").doc(id));
    const pledgeSnaps = pledgeRefs.length ? await tx.getAll(...pledgeRefs) : [];

    const now = new Date().toISOString();
    let left = amount;
    const allocations: PaymentAllocation[] = [];

    for (const snap of pledgeSnaps) {
      if (!snap.exists) continue;
      const p = snap.data() as any;
      if (p.donorId !== params.donorId || p.status === "annule") continue;
      const due = remainingOf(p);
      // Une promesse ciblée reçoit tout le montant, même au-delà du dû.
      const part = params.pledgeId ? left : Math.min(left, due);
      if (part <= 0) continue;

      const newPaid = round2(paidOf(p) + part);
      const fullyPaid = newPaid >= p.amount;
      tx.update(snap.ref, {
        amountPaid: newPaid,
        status: p.status === "annule" ? "annule" : fullyPaid ? "paye" : "partiel",
        paidAt: fullyPaid ? p.paidAt || now : null,
        ...(params.stripeCheckoutSessionId ? { stripeCheckoutSessionId: params.stripeCheckoutSessionId } : {}),
        updatedAt: now,
      });
      allocations.push({ pledgeId: p.id, amount: round2(part) });
      left = round2(left - part);
      if (left <= 0) break;
    }

    const doc: PaymentDoc = {
      id: paymentRef.id,
      donorId: params.donorId,
      donorName: `${donor.firstName} ${donor.lastName}`,
      amount,
      method: params.method,
      reference: params.reference || "",
      date: params.date,
      notes: params.notes || "",
      allocations,
      unallocated: left,
      campaignId: params.campaignId || null,
      stripeCheckoutSessionId: params.stripeCheckoutSessionId || null,
      createdBy: params.createdBy,
      createdByName: params.createdByName,
      createdAt: now,
    };
    tx.set(paymentRef, doc);
    return doc;
  });
}

// Supprime un paiement saisi par erreur et retire ses affectations.
export async function deletePayment(paymentId: string): Promise<void> {
  const db = adminDb();
  const paymentRef = db.collection("payments").doc(paymentId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(paymentRef);
    if (!snap.exists) {
      const err: any = new Error("Paiement introuvable.");
      err.status = 404;
      throw err;
    }
    const payment = snap.data() as PaymentDoc;
    if (payment.receiptId) {
      const err: any = new Error("Ce paiement figure sur un reçu fiscal : annulez d'abord le reçu.");
      err.status = 409;
      throw err;
    }
    const refs = payment.allocations.map((a) => db.collection("pledges").doc(a.pledgeId));
    const pledgeSnaps = refs.length ? await tx.getAll(...refs) : [];
    const now = new Date().toISOString();

    pledgeSnaps.forEach((ps, i) => {
      if (!ps.exists) return;
      const p = ps.data() as any;
      const newPaid = Math.max(0, round2(paidOf(p) - payment.allocations[i].amount));
      let status = p.status;
      if (status !== "annule") {
        if (newPaid >= p.amount) status = "paye";
        else if (newPaid > 0) status = "partiel";
        else status = (p.remindersSentCount || 0) > 0 ? "relance_envoyee" : "en_attente";
      }
      tx.update(ps.ref, {
        amountPaid: newPaid,
        status,
        paidAt: status === "paye" ? p.paidAt : null,
        updatedAt: now,
      });
    });
    tx.delete(paymentRef);
  });
}

// ---- Liens de paiement signés (sans connexion) ----
// Le lien porte une signature HMAC de la cible : seul quelqu'un qui a reçu
// le lien peut ouvrir la page de paiement, et le montant est toujours
// recalculé côté serveur au moment du clic.

function linkSecret(): string {
  const s = process.env.PAY_LINK_SECRET || process.env.STRIPE_SECRET_KEY;
  if (!s) throw new Error("PAY_LINK_SECRET (ou STRIPE_SECRET_KEY) manquant.");
  return s;
}

export type PayTarget = { kind: "pledge" | "donor"; id: string };

// Signature HMAC tronquée, réutilisée pour les liens de connexion à l'espace fidèle.
export function signValue(value: string): string {
  return createHmac("sha256", linkSecret()).update(value).digest("hex").slice(0, 32);
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b || "");
  return x.length === y.length && timingSafeEqual(x, y);
}

export function signPayTarget(t: PayTarget): string {
  return signValue(`${t.kind}:${t.id}`);
}

export function verifyPayTarget(t: PayTarget, token: string): boolean {
  return safeEqual(signPayTarget(t), token);
}

export function payUrl(t: PayTarget): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const param = t.kind === "pledge" ? "pledge" : "donor";
  return `${appUrl}/api/pay?${param}=${encodeURIComponent(t.id)}&t=${signPayTarget(t)}`;
}
