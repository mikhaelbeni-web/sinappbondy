import { adminDb } from "./firebaseAdmin";
import { round2 } from "./format";

export { EXPENSE_CATEGORIES, EXPENSE_METHODS } from "./treasuryLabels";

// Dépenses et remises en banque. Les recettes viennent de `payments`.


export interface ExpenseDoc {
  id: string;
  date: string; // yyyy-mm-dd
  amount: number;
  category: string;
  label: string;
  supplier: string;
  method: string;
  reference: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
}

export interface DepositDoc {
  id: string;
  date: string;
  method: "cheque" | "especes";
  reference: string; // n° de bordereau
  paymentIds: string[];
  count: number;
  total: number;
  createdBy: string;
  createdByName: string;
  createdAt: string;
}

export const DEPOSIT_METHODS = ["cheque", "especes"] as const;

export async function createDeposit(params: {
  paymentIds: string[];
  date: string;
  reference: string;
  user: { uid: string; name: string };
}): Promise<DepositDoc> {
  const db = adminDb();
  const ref = db.collection("deposits").doc();
  return db.runTransaction(async (tx) => {
    const snaps = await tx.getAll(...params.paymentIds.map((id) => db.collection("payments").doc(id)));
    const payments = snaps.map((s) => {
      if (!s.exists) throw Object.assign(new Error("Encaissement introuvable."), { status: 404 });
      return s.data() as any;
    });
    const method = payments[0].method;
    for (const p of payments) {
      if (p.depositId) throw Object.assign(new Error(`L'encaissement de ${p.donorName} est déjà remis en banque.`), { status: 409 });
      if (p.method !== method || !DEPOSIT_METHODS.includes(p.method)) {
        throw Object.assign(new Error("Une remise regroupe soit des chèques, soit des espèces."), { status: 400 });
      }
    }
    const deposit: DepositDoc = {
      id: ref.id,
      date: params.date,
      method,
      reference: params.reference,
      paymentIds: params.paymentIds,
      count: payments.length,
      total: round2(payments.reduce((s, p) => s + p.amount, 0)),
      createdBy: params.user.uid,
      createdByName: params.user.name,
      createdAt: new Date().toISOString(),
    };
    tx.set(ref, deposit);
    snaps.forEach((s) => tx.update(s.ref, { depositId: ref.id }));
    return deposit;
  });
}

export async function deleteDeposit(id: string): Promise<void> {
  const db = adminDb();
  const ref = db.collection("deposits").doc(id);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw Object.assign(new Error("Remise introuvable."), { status: 404 });
    const d = snap.data() as DepositDoc;
    const pSnaps = d.paymentIds.length ? await tx.getAll(...d.paymentIds.map((pid) => db.collection("payments").doc(pid))) : [];
    pSnaps.forEach((s) => s.exists && tx.update(s.ref, { depositId: null }));
    tx.delete(ref);
  });
}
