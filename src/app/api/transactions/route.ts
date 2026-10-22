import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { withPermission, handleApiError, jsonError } from "@/lib/apiHelpers";
import { PAYMENT_METHODS, recordPayment } from "@/lib/payments";
import { todayISO } from "@/lib/format";
import { autoReceiptForPayment } from "@/lib/receipts";

// Encaissements (paiements reçus, en ligne ou hors ligne).
export async function GET(req: NextRequest) {
  try {
    await withPermission("gerer_paiements");
    const { searchParams } = new URL(req.url);
    const donorId = searchParams.get("donorId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    let query: FirebaseFirestore.Query = adminDb().collection("payments");
    if (donorId) query = query.where("donorId", "==", donorId);
    // Filtre de dates et tri en mémoire (pas d'orderBy avec where).
    const snap = await query.get();
    const payments = snap.docs
      .map((d) => d.data() as any)
      .filter((p) => (!from || p.date >= from) && (!to || p.date <= to))
      .sort((a, b) => (a.date === b.date ? (a.createdAt < b.createdAt ? 1 : -1) : a.date < b.date ? 1 : -1));
    return NextResponse.json({ payments });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await withPermission("gerer_paiements");
    const { donorId, pledgeId, amount, method, reference, date, notes } = await req.json();

    if (!donorId || !amount || Number(amount) <= 0) return jsonError("Fidèle et montant (positif) sont requis.", 400);
    if (!PAYMENT_METHODS.includes(method)) return jsonError("Mode de paiement invalide.", 400);
    const d = typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayISO();

    const payment = await recordPayment({
      donorId,
      pledgeId: pledgeId || null,
      amount: Number(amount),
      method,
      reference: typeof reference === "string" ? reference.trim() : "",
      date: d,
      notes: typeof notes === "string" ? notes : "",
      createdBy: user.uid,
      createdByName: user.name,
    });
    const receipt = payment ? await autoReceiptForPayment(payment, user.name) : null;
    return NextResponse.json({ payment, receipt });
  } catch (err) {
    return handleApiError(err);
  }
}
