import { adminDb } from "./firebaseAdmin";
import { missingAssociationFields, type AssociationSettings } from "./association";
import { getAssociation } from "./associationServer";
import { round2 } from "./format";
import { sendReceiptEmail } from "./email";
import { renderReceiptPdf } from "./receiptPdf";
import type { PaymentDoc, ReceiptDoc } from "./types";

// Reçus fiscaux (modèle Cerfa 11580). Un reçu ne porte que sur des sommes
// effectivement encaissées : chaque paiement ne peut figurer que sur un
// seul reçu (champ receiptId), qu'il soit unitaire ou récapitulatif annuel.

function httpError(message: string, status = 400, code?: string) {
  const err: any = new Error(message);
  err.status = status;
  if (code) err.code = code;
  return err;
}

export function donorAddressComplete(d: any): boolean {
  return !!(d?.address?.trim() && d?.postalCode?.trim() && d?.city?.trim());
}

export async function issueReceipt(params: {
  donorId: string;
  paymentIds: string[];
  kind: "unitaire" | "annuel";
  issuedBy: string;
  association?: AssociationSettings;
}): Promise<ReceiptDoc> {
  const association = params.association || (await getAssociation());
  const missing = missingAssociationFields(association);
  if (missing.length) {
    throw httpError(`Fiche association incomplète : ${missing.join(", ")}.`, 400, "association");
  }
  if (!params.paymentIds.length) throw httpError("Aucun paiement à couvrir.");

  const db = adminDb();
  const receiptRef = db.collection("receipts").doc();

  return db.runTransaction(async (tx) => {
    const donorSnap = await tx.get(db.collection("donors").doc(params.donorId));
    if (!donorSnap.exists) throw httpError("Fidèle introuvable.", 404);
    const donor = donorSnap.data() as any;
    if (!donorAddressComplete(donor)) {
      throw httpError(`Adresse postale manquante pour ${donor.firstName} ${donor.lastName}.`, 400, "adresse");
    }

    const paySnaps = await tx.getAll(...params.paymentIds.map((id) => db.collection("payments").doc(id)));
    const payments = paySnaps.map((s) => {
      if (!s.exists) throw httpError("Paiement introuvable.", 404);
      const p = s.data() as PaymentDoc;
      if (p.donorId !== params.donorId) throw httpError("Paiement d'un autre fidèle.");
      if (p.receiptId) throw httpError("Un des paiements a déjà un reçu fiscal.", 409);
      return p;
    });
    payments.sort((a, b) => (a.date < b.date ? -1 : 1));

    // L'année fiscale du reçu est celle du dernier versement couvert.
    const year = Number(payments[payments.length - 1].date.slice(0, 4));
    const counterRef = db.collection("settings").doc(`receiptCounter_${year}`);
    const counterSnap = await tx.get(counterRef);
    const next = ((counterSnap.exists ? (counterSnap.data() as any).last : 0) || 0) + 1;

    const now = new Date().toISOString();
    const receipt: ReceiptDoc = {
      id: receiptRef.id,
      number: `${year}/${String(next).padStart(5, "0")}`,
      year,
      kind: params.kind,
      donorId: params.donorId,
      donor: {
        name: `${donor.firstName} ${donor.lastName}`,
        address: donor.address,
        postalCode: donor.postalCode,
        city: donor.city,
        email: donor.email || "",
      },
      amount: round2(payments.reduce((s, p) => s + p.amount, 0)),
      payments: payments.map((p) => ({ id: p.id, date: p.date, amount: p.amount, method: p.method })),
      periodStart: params.kind === "annuel" ? `${year}-01-01` : payments[0].date,
      periodEnd: params.kind === "annuel" ? `${year}-12-31` : payments[payments.length - 1].date,
      association: {
        legalName: association.legalName,
        address: association.address,
        postalCode: association.postalCode,
        city: association.city,
        object: association.object,
        rna: association.rna,
        siren: association.siren,
        category: association.category,
        signatoryName: association.signatoryName,
        signatoryTitle: association.signatoryTitle,
      },
      issuedAt: now,
      issuedBy: params.issuedBy,
      emailedAt: null,
      cancelled: false,
      cancelledAt: null,
    };

    tx.set(counterRef, { last: next }, { merge: true });
    tx.set(receiptRef, receipt);
    for (const s of paySnaps) tx.update(s.ref, { receiptId: receiptRef.id });
    return receipt;
  });
}

// Annule un reçu (erreur de saisie) : le numéro reste consommé, les
// paiements redeviennent disponibles pour un nouveau reçu.
export async function cancelReceipt(receiptId: string): Promise<void> {
  const db = adminDb();
  const ref = db.collection("receipts").doc(receiptId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw httpError("Reçu introuvable.", 404);
    const r = snap.data() as ReceiptDoc;
    if (r.cancelled) return;
    const paySnaps = r.payments.length ? await tx.getAll(...r.payments.map((p) => db.collection("payments").doc(p.id))) : [];
    tx.update(ref, { cancelled: true, cancelledAt: new Date().toISOString() });
    for (const s of paySnaps) {
      if (s.exists && (s.data() as any).receiptId === receiptId) tx.update(s.ref, { receiptId: null });
    }
  });
}

export async function emailReceipt(receipt: ReceiptDoc, association?: AssociationSettings): Promise<{ sent: boolean; reason?: string }> {
  if (!receipt.donor.email) return { sent: false, reason: "pas d'e-mail" };
  const a = association || (await getAssociation());
  const pdf = await renderReceiptPdf(receipt, a.signatureImage, a.logoImage);
  const result = await sendReceiptEmail({
    to: receipt.donor.email,
    donorName: receipt.donor.name,
    associationName: receipt.association.legalName,
    number: receipt.number,
    amount: receipt.amount,
    kind: receipt.kind,
    year: receipt.year,
    pdf,
  });
  if (result.sent) {
    await adminDb().collection("receipts").doc(receipt.id).update({ emailedAt: new Date().toISOString() });
  }
  return result;
}

// Après un encaissement : reçu unitaire envoyé tout de suite si la fiche
// association est complète, l'option activée et l'adresse du fidèle connue.
// Ne lève jamais : l'encaissement reste enregistré quoi qu'il arrive, et le
// paiement sans reçu apparaît dans « à émettre ».
export async function autoReceiptForPayment(payment: PaymentDoc, issuedBy: string): Promise<ReceiptDoc | null> {
  try {
    const association = await getAssociation();
    if (!association.autoReceipt || missingAssociationFields(association).length) return null;
    const donorSnap = await adminDb().collection("donors").doc(payment.donorId).get();
    if (!donorAddressComplete(donorSnap.data())) return null;

    const receipt = await issueReceipt({
      donorId: payment.donorId,
      paymentIds: [payment.id],
      kind: "unitaire",
      issuedBy,
      association,
    });
    await emailReceipt(receipt, association);
    return receipt;
  } catch (err) {
    console.warn("[receipts] reçu automatique non émis:", err);
    return null;
  }
}

// Paiements sans reçu sur une année, regroupés par fidèle.
export async function pendingByDonor(year: number) {
  const db = adminDb();
  const [paySnap, donorsSnap] = await Promise.all([db.collection("payments").get(), db.collection("donors").get()]);
  const donors = new Map(donorsSnap.docs.map((d) => [d.id, d.data() as any]));
  const groups = new Map<string, { donorId: string; donorName: string; amount: number; paymentIds: string[]; hasAddress: boolean; hasEmail: boolean }>();

  for (const d of paySnap.docs) {
    const p = d.data() as PaymentDoc;
    if (p.receiptId || !p.date.startsWith(String(year))) continue;
    const donor = donors.get(p.donorId);
    const g = groups.get(p.donorId) || {
      donorId: p.donorId,
      donorName: p.donorName,
      amount: 0,
      paymentIds: [],
      hasAddress: donorAddressComplete(donor),
      hasEmail: !!donor?.email,
    };
    g.amount = round2(g.amount + p.amount);
    g.paymentIds.push(p.id);
    groups.set(p.donorId, g);
  }
  return Array.from(groups.values()).sort((a, b) => a.donorName.localeCompare(b.donorName, "fr"));
}
