import { adminDb } from "./firebaseAdmin";
import { missingAssociationFields, type AssociationSettings } from "./association";
import { getAssociation } from "./associationServer";
import { round2 } from "./format";
import { sendReceiptEmail } from "./email";
import { renderReceiptPdf } from "./receiptPdf";
import type { PaymentDoc, ReceiptAuditDoc, ReceiptDoc } from "./types";

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
    // Seule la part sans contrepartie figure sur le reçu.
    const deductible = payments
      .map((p) => ({ p, amount: round2(p.amount - (p.nonDeductible || 0)) }))
      .filter((x) => x.amount > 0);
    if (!deductible.length) throw httpError("Ces paiements ne donnent pas droit à un reçu fiscal (contrepartie).");

    // L'année fiscale du reçu est celle du dernier versement couvert.
    const year = Number(deductible[deductible.length - 1].p.date.slice(0, 4));
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
      amount: round2(deductible.reduce((s, x) => s + x.amount, 0)),
      payments: deductible.map(({ p, amount }) => ({ id: p.id, date: p.date, amount, method: p.method })),
      periodStart: params.kind === "annuel" ? `${year}-01-01` : deductible[0].p.date,
      periodEnd: params.kind === "annuel" ? `${year}-12-31` : deductible[deductible.length - 1].p.date,
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

// ---------------------------------------------------------------------------
// Gestion des reçus après émission.
//
// Un reçu est un « brouillon » tant qu'il n'est jamais sorti de l'association :
// ni envoyé par e-mail, ni téléchargé par le fidèle, ni marqué remis en main
// propre. Un brouillon peut être modifié (numéro, fidèle, montant, date) ou
// supprimé. Une fois envoyé, il n'est plus jamais modifié ni supprimé : on
// l'annule (il garde son numéro) et on le remplace par un nouveau reçu au
// numéro suivant (art. 1740 A CGI, conservation 6 ans).
//
// Numérotation : le compteur settings/receiptCounter_{année} vaut toujours le
// plus grand numéro existant. Supprimer le dernier brouillon le fait reculer
// d'un cran (ce numéro n'a jamais été envoyé) ; un numéro envoyé ou annulé
// n'est jamais libéré. Un brouillon ne peut prendre qu'un numéro libre
// compris entre 1 et le dernier numéro utilisé : on comble un trou, on n'en
// ouvre jamais un au-delà du compteur.
// ---------------------------------------------------------------------------

export type ReceiptState = "brouillon" | "envoye" | "annule";

export function receiptState(r: ReceiptDoc): ReceiptState {
  if (r.cancelled) return "annule";
  if (r.emailedAt || r.deliveredAt) return "envoye";
  return "brouillon";
}

export function receiptSeq(number: string): number {
  const m = /^(\d{4})\/(\d+)$/.exec(number.trim());
  return m ? Number(m[2]) : NaN;
}

export function formatReceiptNumber(year: number, seq: number): string {
  return `${year}/${String(seq).padStart(5, "0")}`;
}

// Numéros manquants entre 1 et le plus grand numéro de l'année.
export function missingNumbers(receipts: ReceiptDoc[], year: number): string[] {
  const used = new Set(receipts.map((r) => receiptSeq(r.number)));
  const max = Math.max(0, ...Array.from(used).filter((n) => Number.isFinite(n)));
  const out: string[] = [];
  for (let i = 1; i <= max; i++) if (!used.has(i)) out.push(formatReceiptNumber(year, i));
  return out;
}

interface Actor {
  uid: string;
  name: string;
}

function auditSnapshot(r: ReceiptDoc) {
  return {
    number: r.number,
    donorId: r.donorId,
    donorName: r.donor.name,
    amount: r.amount,
    issuedAt: r.issuedAt,
    state: receiptState(r),
  };
}

function writeAudit(
  tx: FirebaseFirestore.Transaction,
  entry: Omit<ReceiptAuditDoc, "id" | "at" | "by" | "byUid">,
  actor: Actor
) {
  const ref = adminDb().collection("receiptAudit").doc();
  tx.set(ref, { ...entry, id: ref.id, at: new Date().toISOString(), by: actor.name, byUid: actor.uid });
}

function requireReason(reason: unknown): string {
  const r = typeof reason === "string" ? reason.trim() : "";
  if (r.length < 3) throw httpError("Indiquez le motif de l'opération.");
  return r;
}

function donorSnapshot(donor: any): ReceiptDoc["donor"] {
  return {
    name: `${donor.firstName} ${donor.lastName}`,
    address: donor.address,
    postalCode: donor.postalCode,
    city: donor.city,
    email: donor.email || "",
  };
}

function coveredAmount(r: ReceiptDoc): number {
  return round2(r.payments.reduce((s, p) => s + p.amount, 0));
}

function checkAmount(amount: unknown, r: ReceiptDoc): number {
  const a = round2(Number(amount));
  if (!Number.isFinite(a) || a <= 0) throw httpError("Montant invalide.");
  const max = coveredAmount(r);
  if (a > max) {
    throw httpError(`Le montant ne peut pas dépasser les sommes encaissées couvertes par ce reçu (${max.toFixed(2)} €).`);
  }
  return a;
}

async function readDonorForReceipt(tx: FirebaseFirestore.Transaction, donorId: string) {
  const snap = await tx.get(adminDb().collection("donors").doc(donorId));
  if (!snap.exists) throw httpError("Fidèle introuvable.", 404);
  const donor = snap.data() as any;
  if (!donorAddressComplete(donor)) {
    throw httpError(`Adresse postale manquante pour ${donor.firstName} ${donor.lastName}.`, 400, "adresse");
  }
  return donor;
}

function maxSeq(receipts: ReceiptDoc[]): number {
  return Math.max(0, ...receipts.map((r) => receiptSeq(r.number)).filter((n) => Number.isFinite(n)));
}

// Modification d'un brouillon. Les paiements restent rattachés au fidèle qui
// les a versés : seul le bénéficiaire du reçu change.
export async function updateDraftReceipt(
  receiptId: string,
  changes: { number?: string; donorId?: string; amount?: number; issuedAt?: string; reason?: string },
  actor: Actor
): Promise<ReceiptDoc> {
  const db = adminDb();
  const ref = db.collection("receipts").doc(receiptId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw httpError("Reçu introuvable.", 404);
    const r = snap.data() as ReceiptDoc;
    if (receiptState(r) !== "brouillon") {
      throw httpError("Ce reçu a déjà été remis au fidèle : il ne peut plus être modifié. Annulez-le puis remplacez-le.", 409);
    }
    const yearSnap = await tx.get(db.collection("receipts").where("year", "==", r.year));
    const yearReceipts = yearSnap.docs.map((d) => d.data() as ReceiptDoc);
    const counterRef = db.collection("settings").doc(`receiptCounter_${r.year}`);
    const counterSnap = await tx.get(counterRef);
    const last = Math.max((counterSnap.exists ? (counterSnap.data() as any).last : 0) || 0, maxSeq(yearReceipts));
    const donor = changes.donorId && changes.donorId !== r.donorId ? await readDonorForReceipt(tx, changes.donorId) : null;

    const update: Partial<ReceiptDoc> = {};
    if (changes.number !== undefined && changes.number.trim() !== r.number) {
      const raw = changes.number.trim();
      // Accepte « 12 » ou « 2026/00012 ».
      const seq = /^\d+$/.test(raw) ? Number(raw) : receiptSeq(raw);
      if (/^\d{4}\//.test(raw) && Number(raw.slice(0, 4)) !== r.year) {
        throw httpError(`Le numéro doit rester dans l'année ${r.year}.`);
      }
      if (!Number.isInteger(seq) || seq < 1) throw httpError("Numéro invalide.");
      if (seq > last) {
        throw httpError(`Numéro trop grand : le dernier numéro utilisé est ${formatReceiptNumber(r.year, last)}, la suite ne doit pas avoir de trou.`);
      }
      const number = formatReceiptNumber(r.year, seq);
      if (yearReceipts.some((o) => o.id !== r.id && o.number === number)) throw httpError(`Le numéro ${number} est déjà pris.`, 409);
      update.number = number;
    }
    if (donor) {
      update.donorId = changes.donorId!;
      update.donor = donorSnapshot(donor);
    }
    if (changes.amount !== undefined && round2(Number(changes.amount)) !== r.amount) {
      update.amount = checkAmount(changes.amount, r);
    }
    if (changes.issuedAt !== undefined && changes.issuedAt.slice(0, 10) !== r.issuedAt.slice(0, 10)) {
      const d = changes.issuedAt.slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw httpError("Date invalide.");
      if (d < r.periodEnd.slice(0, 10)) throw httpError("Le reçu ne peut pas être daté avant le dernier versement couvert.");
      if (d > new Date().toISOString().slice(0, 10)) throw httpError("Le reçu ne peut pas être daté dans le futur.");
      update.issuedAt = `${d}T12:00:00.000Z`;
    }
    if (!Object.keys(update).length) return r;

    const now = new Date().toISOString();
    const next = { ...r, ...update, updatedAt: now } as ReceiptDoc;
    tx.update(ref, { ...update, updatedAt: now });
    // Le compteur suit le plus grand numéro existant après la modification.
    const remaining = yearReceipts.map((o) => (o.id === r.id ? next : o));
    tx.set(counterRef, { last: maxSeq(remaining) }, { merge: true });
    writeAudit(
      tx,
      {
        action: "modification",
        receiptId: r.id,
        number: next.number,
        year: r.year,
        reason: (changes.reason || "").trim(),
        before: auditSnapshot(r),
        after: auditSnapshot(next),
      },
      actor
    );
    return next;
  });
}

// Suppression définitive d'un brouillon. Les paiements redeviennent
// disponibles ; si c'était le dernier numéro, le compteur recule.
export async function deleteDraftReceipt(receiptId: string, confirmNumber: string, reason: unknown, actor: Actor): Promise<void> {
  const motif = requireReason(reason);
  const db = adminDb();
  const ref = db.collection("receipts").doc(receiptId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw httpError("Reçu introuvable.", 404);
    const r = snap.data() as ReceiptDoc;
    if (receiptState(r) !== "brouillon") {
      throw httpError("Un reçu déjà remis ou annulé ne peut pas être supprimé : la loi impose de le conserver 6 ans.", 409);
    }
    if ((confirmNumber || "").trim() !== r.number) throw httpError(`Recopiez le numéro ${r.number} pour confirmer.`);
    const yearSnap = await tx.get(db.collection("receipts").where("year", "==", r.year));
    const paySnaps = r.payments.length ? await tx.getAll(...r.payments.map((p) => db.collection("payments").doc(p.id))) : [];

    tx.delete(ref);
    for (const s of paySnaps) {
      if (s.exists && (s.data() as any).receiptId === receiptId) tx.update(s.ref, { receiptId: null });
    }
    const remaining = yearSnap.docs.map((d) => d.data() as ReceiptDoc).filter((o) => o.id !== r.id);
    tx.set(db.collection("settings").doc(`receiptCounter_${r.year}`), { last: maxSeq(remaining) }, { merge: true });
    writeAudit(
      tx,
      { action: "suppression", receiptId: r.id, number: r.number, year: r.year, reason: motif, before: { ...auditSnapshot(r), receipt: r }, after: null },
      actor
    );
  });
}

// Annulation : le reçu garde son numéro et reste consultable, marqué
// « REÇU ANNULÉ ». Les paiements redeviennent disponibles pour un nouveau reçu.
export async function cancelReceipt(receiptId: string, confirmNumber: string, reason: unknown, actor: Actor): Promise<void> {
  const motif = requireReason(reason);
  const db = adminDb();
  const ref = db.collection("receipts").doc(receiptId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw httpError("Reçu introuvable.", 404);
    const r = snap.data() as ReceiptDoc;
    if (r.cancelled) throw httpError("Ce reçu est déjà annulé.", 409);
    if ((confirmNumber || "").trim() !== r.number) throw httpError(`Recopiez le numéro ${r.number} pour confirmer.`);
    const paySnaps = r.payments.length ? await tx.getAll(...r.payments.map((p) => db.collection("payments").doc(p.id))) : [];
    const now = new Date().toISOString();
    tx.update(ref, { cancelled: true, cancelledAt: now, cancelledBy: actor.name, cancelReason: motif, updatedAt: now });
    for (const s of paySnaps) {
      if (s.exists && (s.data() as any).receiptId === receiptId) tx.update(s.ref, { receiptId: null });
    }
    writeAudit(
      tx,
      {
        action: "annulation",
        receiptId: r.id,
        number: r.number,
        year: r.year,
        reason: motif,
        before: auditSnapshot(r),
        after: { ...auditSnapshot(r), state: "annule" },
      },
      actor
    );
  });
}

// Remplacement : annule le reçu et en émet un nouveau au numéro suivant,
// pour un autre fidèle et/ou un autre montant, sur les mêmes paiements.
export async function replaceReceipt(
  receiptId: string,
  params: { donorId?: string; amount?: number; confirmNumber: string; reason: unknown },
  actor: Actor
): Promise<ReceiptDoc> {
  const motif = requireReason(params.reason);
  const association = await getAssociation();
  const missing = missingAssociationFields(association);
  if (missing.length) throw httpError(`Fiche association incomplète : ${missing.join(", ")}.`, 400, "association");

  const db = adminDb();
  const ref = db.collection("receipts").doc(receiptId);
  const newRef = db.collection("receipts").doc();
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw httpError("Reçu introuvable.", 404);
    const r = snap.data() as ReceiptDoc;
    if (r.cancelled) throw httpError("Ce reçu est déjà annulé.", 409);
    if ((params.confirmNumber || "").trim() !== r.number) throw httpError(`Recopiez le numéro ${r.number} pour confirmer.`);
    const donorId = params.donorId || r.donorId;
    const donor = await readDonorForReceipt(tx, donorId);
    const amount = params.amount !== undefined && params.amount !== null ? checkAmount(params.amount, r) : r.amount;
    const yearSnap = await tx.get(db.collection("receipts").where("year", "==", r.year));
    const counterRef = db.collection("settings").doc(`receiptCounter_${r.year}`);
    const counterSnap = await tx.get(counterRef);
    const paySnaps = r.payments.length ? await tx.getAll(...r.payments.map((p) => db.collection("payments").doc(p.id))) : [];
    const last = Math.max(
      (counterSnap.exists ? (counterSnap.data() as any).last : 0) || 0,
      maxSeq(yearSnap.docs.map((d) => d.data() as ReceiptDoc))
    );
    const seq = last + 1;
    const now = new Date().toISOString();

    const replacement: ReceiptDoc = {
      ...r,
      id: newRef.id,
      number: formatReceiptNumber(r.year, seq),
      donorId,
      donor: donorSnapshot(donor),
      amount,
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
      issuedBy: actor.name,
      emailedAt: null,
      deliveredAt: null,
      deliveredVia: null,
      cancelled: false,
      cancelledAt: null,
      cancelledBy: null,
      cancelReason: null,
      replacesId: r.id,
      replacesNumber: r.number,
      replacedById: null,
      replacedByNumber: null,
      updatedAt: null,
    };

    tx.update(ref, {
      cancelled: true,
      cancelledAt: now,
      cancelledBy: actor.name,
      cancelReason: motif,
      replacedById: newRef.id,
      replacedByNumber: replacement.number,
      updatedAt: now,
    });
    tx.set(newRef, replacement);
    tx.set(counterRef, { last: seq }, { merge: true });
    for (const s of paySnaps) {
      if (s.exists && (s.data() as any).receiptId === receiptId) tx.update(s.ref, { receiptId: newRef.id });
    }
    writeAudit(
      tx,
      {
        action: "remplacement",
        receiptId: r.id,
        number: r.number,
        year: r.year,
        reason: motif,
        before: auditSnapshot(r),
        after: { ...auditSnapshot(replacement), receiptId: newRef.id },
      },
      actor
    );
    return replacement;
  });
}

// Remise hors e-mail : le reçu sort de l'état brouillon.
export async function markReceiptDelivered(receiptId: string, via: "main_propre" | "espace", actor: Actor): Promise<void> {
  const db = adminDb();
  const ref = db.collection("receipts").doc(receiptId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw httpError("Reçu introuvable.", 404);
    const r = snap.data() as ReceiptDoc;
    if (r.cancelled || r.deliveredAt) return;
    const now = new Date().toISOString();
    tx.update(ref, { deliveredAt: now, deliveredVia: via });
    writeAudit(
      tx,
      {
        action: "remise",
        receiptId: r.id,
        number: r.number,
        year: r.year,
        reason: via === "espace" ? "Téléchargé par le fidèle depuis son espace" : "Remis en main propre",
        before: auditSnapshot(r),
        after: { ...auditSnapshot(r), state: "envoye" },
      },
      actor
    );
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
    if (payment.amount - (payment.nonDeductible || 0) <= 0) return null;
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
    const deductible = round2(p.amount - (p.nonDeductible || 0));
    if (deductible <= 0) continue;
    const donor = donors.get(p.donorId);
    const g = groups.get(p.donorId) || {
      donorId: p.donorId,
      donorName: p.donorName,
      amount: 0,
      paymentIds: [],
      hasAddress: donorAddressComplete(donor),
      hasEmail: !!donor?.email,
    };
    g.amount = round2(g.amount + deductible);
    g.paymentIds.push(p.id);
    groups.set(p.donorId, g);
  }
  return Array.from(groups.values()).sort((a, b) => a.donorName.localeCompare(b.donorName, "fr"));
}
