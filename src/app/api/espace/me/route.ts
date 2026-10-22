import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { handleApiError, jsonError } from "@/lib/apiHelpers";
import { requireDonorId } from "@/lib/donorSession";
import { paidOf, remainingOf, round2 } from "@/lib/format";
import { payUrl } from "@/lib/payments";

// Données de l'espace fidèle connecté (lecture seule).
export async function GET() {
  try {
    const donorId = requireDonorId();
    const db = adminDb();
    const [donorSnap, pledgesSnap, paySnap, receiptSnap] = await Promise.all([
      db.collection("donors").doc(donorId).get(),
      db.collection("pledges").where("donorId", "==", donorId).get(),
      db.collection("payments").where("donorId", "==", donorId).get(),
      db.collection("receipts").where("donorId", "==", donorId).get(),
    ]);
    if (!donorSnap.exists) return jsonError("Fiche introuvable.", 404);
    const d = donorSnap.data() as any;

    const pledges = pledgesSnap.docs
      .map((x) => x.data() as any)
      .filter((p) => p.status !== "annule")
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .map((p) => ({
        id: p.id,
        label: p.catalogItemName,
        service: p.serviceLabel,
        date: p.createdAt,
        amount: p.amount,
        paid: paidOf(p),
        remaining: remainingOf(p),
        status: p.status,
      }));
    const payments = paySnap.docs
      .map((x) => x.data() as any)
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .map((p) => ({ id: p.id, date: p.date, amount: p.amount, method: p.method }));
    const receipts = receiptSnap.docs
      .map((x) => x.data() as any)
      .filter((r) => !r.cancelled)
      .sort((a, b) => (a.number < b.number ? 1 : -1))
      .map((r) => ({ id: r.id, number: r.number, year: r.year, kind: r.kind, amount: r.amount, issuedAt: r.issuedAt }));

    const balance = round2(pledges.reduce((s, p) => s + p.remaining, 0));
    let balanceUrl: string | null = null;
    if (balance > 0) {
      try {
        balanceUrl = payUrl({ kind: "donor", id: donorId });
      } catch {}
    }

    return NextResponse.json({
      donor: { firstName: d.firstName, lastName: d.lastName, email: d.email, hasAddress: !!(d.address && d.postalCode && d.city) },
      pledges,
      payments,
      receipts,
      balance,
      balanceUrl,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
