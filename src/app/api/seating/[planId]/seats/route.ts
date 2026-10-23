import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { withPermission, handleApiError, jsonError } from "@/lib/apiHelpers";
import { paidOf } from "@/lib/format";
import { seatId, seatLabel, type SeatingPlanDoc } from "@/lib/seating";

// Attribuer des places : { donorId, seats: [{ sectionId, row, seat }], bill }.
// bill = créer la promesse au tarif de la section (sinon place offerte).
export async function POST(req: NextRequest, { params }: { params: { planId: string } }) {
  try {
    const user = await withPermission("gerer_paiements");
    const { donorId, seats, bill } = await req.json();
    if (!donorId || !Array.isArray(seats) || !seats.length) return jsonError("Fidèle et places requis.", 400);
    const db = adminDb();

    const result = await db.runTransaction(async (tx) => {
      const planSnap = await tx.get(db.collection("seatingPlans").doc(params.planId));
      if (!planSnap.exists) throw Object.assign(new Error("Plan introuvable."), { status: 404 });
      const plan = planSnap.data() as SeatingPlanDoc;
      const donorSnap = await tx.get(db.collection("donors").doc(donorId));
      if (!donorSnap.exists) throw Object.assign(new Error("Fidèle introuvable."), { status: 404 });
      const donor = donorSnap.data() as any;

      const wanted = seats.map((s: any) => {
        const sec = plan.sections.find((x) => x.id === s.sectionId);
        const row = Number(s.row);
        const seat = Number(s.seat);
        if (!sec || row < 1 || row > sec.rows || seat < 1 || seat > sec.seatsPerRow) {
          throw Object.assign(new Error("Place hors du plan."), { status: 400 });
        }
        return { sec, row, seat, ref: db.collection("seats").doc(seatId(plan.id, sec.id, row, seat)) };
      });
      const existing = await tx.getAll(...wanted.map((w) => w.ref));
      const taken = existing.find((e) => e.exists);
      if (taken) throw Object.assign(new Error(`Place déjà attribuée à ${(taken.data() as any).donorName}.`), { status: 409 });

      const now = new Date().toISOString();
      const donorName = `${donor.firstName} ${donor.lastName}`;
      for (const w of wanted) {
        let pledgeId: string | null = null;
        if (bill && w.sec.price > 0) {
          const pref = db.collection("pledges").doc();
          pledgeId = pref.id;
          tx.set(pref, {
            id: pref.id,
            kind: "place",
            donorId,
            donorName,
            donorEmail: donor.email || "",
            serviceId: "",
            serviceLabel: plan.name,
            catalogItemId: null,
            catalogItemName: `Place ${seatLabel(w.sec.name, w.row, w.seat)}`,
            amount: w.sec.price,
            amountPaid: 0,
            currency: "eur",
            status: "en_attente",
            notes: "",
            createdBy: user.uid,
            createdByName: user.name,
            createdAt: now,
            updatedAt: now,
            onlineCheckoutId: null,
            remindersSentCount: 0,
            lastReminderAt: null,
            paidAt: null,
          });
        }
        tx.set(w.ref, {
          id: w.ref.id,
          planId: plan.id,
          sectionId: w.sec.id,
          row: w.row,
          seat: w.seat,
          donorId,
          donorName,
          pledgeId,
          confirmedAt: null,
          createdAt: now,
        });
      }
      return wanted.length;
    });
    return NextResponse.json({ assigned: result });
  } catch (err) {
    return handleApiError(err);
  }
}

// Libérer une place : { seatId }. La promesse liée est annulée si rien
// n'a été réglé ; sinon on refuse (rembourser ou réaffecter d'abord).
export async function DELETE(req: NextRequest, { params }: { params: { planId: string } }) {
  try {
    await withPermission("gerer_paiements");
    const { seatId: id } = await req.json();
    const db = adminDb();
    await db.runTransaction(async (tx) => {
      const ref = db.collection("seats").doc(String(id));
      const snap = await tx.get(ref);
      if (!snap.exists || (snap.data() as any).planId !== params.planId) {
        throw Object.assign(new Error("Place introuvable."), { status: 404 });
      }
      const seat = snap.data() as any;
      if (seat.pledgeId) {
        const pref = db.collection("pledges").doc(seat.pledgeId);
        const p = await tx.get(pref);
        if (p.exists) {
          if (paidOf(p.data() as any) > 0) {
            throw Object.assign(new Error("Cette place a déjà été (en partie) réglée : supprimez d'abord le paiement."), { status: 409 });
          }
          tx.update(pref, { status: "annule", updatedAt: new Date().toISOString() });
        }
      }
      tx.delete(ref);
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
