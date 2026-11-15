import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { handleApiError, jsonError } from "@/lib/apiHelpers";
import { requireDonorId } from "@/lib/donorSession";
import { paidOf, remainingOf, round2 } from "@/lib/format";
import { payUrl } from "@/lib/payments";
import { upcomingHazkarot } from "@/lib/hazkarot";
import { planSeatLabel } from "@/lib/seating";

// Données de l'espace fidèle connecté.
export async function GET() {
  try {
    const donorId = requireDonorId();
    const db = adminDb();
    const [donorSnap, pledgesSnap, paySnap, receiptSnap, plansSnap] = await Promise.all([
      db.collection("donors").doc(donorId).get(),
      db.collection("pledges").where("donorId", "==", donorId).get(),
      db.collection("payments").where("donorId", "==", donorId).get(),
      db.collection("receipts").where("donorId", "==", donorId).get(),
      db.collection("seatingPlans").where("published", "==", true).get(),
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

    // Compléments : chaque bloc est facultatif, une panne n'empêche pas l'espace de s'ouvrir.
    const today = new Date().toISOString().slice(0, 10);
    const plans = plansSnap.docs.map((x) => x.data() as any);
    const [seats, kiddush, salons, hazkarot] = await Promise.all([
      db.collection("seats").where("donorId", "==", donorId).get()
        .then((s) =>
          s.docs
            .map((x) => x.data() as any)
            .map((s) => {
              const plan = plans.find((p) => p.id === s.planId);
              return plan ? { id: s.id, plan: plan.name, label: planSeatLabel(plan, s.sectionId, s.row, s.seat), pending: !!s.pending } : null;
            })
            .filter(Boolean)
        )
        .catch(() => []),
      db.collection("kiddushSponsors").where("donorId", "==", donorId).get()
        .then((s) =>
          s.docs
            .map((x) => x.data() as any)
            .filter((k) => k.date >= today)
            .sort((a, b) => (a.date < b.date ? -1 : 1))
            .map((k) => ({ id: k.id, date: k.date, parasha: k.parasha, label: k.optionLabel, dedication: k.dedication || "", pending: !!k.pending }))
        )
        .catch(() => []),
      d.email
        ? db.collection("salonRequests").where("email", "==", String(d.email).toLowerCase()).get()
            .then((s) =>
              s.docs
                .map((x) => x.data() as any)
                .filter((r) => r.date >= today)
                .sort((a, b) => (a.date < b.date ? -1 : 1))
                .map((r) => ({ id: r.id, date: r.date, eventType: r.eventType, guests: r.guests, status: r.status }))
            )
            .catch(() => [])
        : [],
      upcomingHazkarot(400, donorId)
        .then((l) => l.map((h) => ({ id: h.id, name: h.deceasedName, relation: h.relation, hebrewDate: h.hebrewDate, next: h.next?.date || null, nextHebrew: h.next?.hebrew || "" })))
        .catch(() => []),
    ]);

    const balance = round2(pledges.reduce((s, p) => s + p.remaining, 0));
    let balanceUrl: string | null = null;
    if (balance > 0) {
      try {
        balanceUrl = payUrl({ kind: "donor", id: donorId });
      } catch {}
    }

    return NextResponse.json({
      donor: {
        firstName: d.firstName,
        lastName: d.lastName,
        email: d.email,
        phone: d.phone || "",
        address: d.address || "",
        postalCode: d.postalCode || "",
        city: d.city || "",
        hasAddress: !!(d.address && d.postalCode && d.city),
      },
      seats,
      kiddush,
      salons,
      hazkarot,
      pledges,
      payments,
      receipts,
      balance,
      balanceUrl,
      seatingPlans: plans
        .filter((p) => p.active !== false && p.layout)
        .map((p) => ({ id: p.id, name: p.name, salesOpen: !!p.salesOpen })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

// Le fidèle complète ses coordonnées (l'adresse postale est obligatoire sur
// un reçu fiscal). Nom et e-mail restent gérés par la synagogue.
export async function PATCH(req: NextRequest) {
  try {
    const donorId = requireDonorId();
    const body = await req.json();
    const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
    const update = { address: str(body.address, 200), postalCode: str(body.postalCode, 12), city: str(body.city, 80), phone: str(body.phone, 30) };
    if (!update.address || !update.postalCode || !update.city) return jsonError("Adresse, code postal et ville sont nécessaires.", 400);
    if (!/^[0-9A-Za-z -]{3,12}$/.test(update.postalCode)) return jsonError("Code postal invalide.", 400);
    const ref = adminDb().collection("donors").doc(donorId);
    if (!(await ref.get()).exists) return jsonError("Fiche introuvable.", 404);
    await ref.update({ ...update, updatedAt: new Date().toISOString() });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
