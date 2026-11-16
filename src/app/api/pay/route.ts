import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { remainingOf, round2 } from "@/lib/format";
import { verifyPayTarget, type PayTarget } from "@/lib/payments";
import { createCheckout } from "@/lib/helloasso";
import { settleBooking } from "@/lib/seatingServer";
import { settleKiddushPledge } from "@/lib/kiddushServer";

// Lien de paiement public (envoyé par e-mail) : ?pledge=<id>&t=<signature>
// ou ?donor=<id>&t=<signature> pour régler tout le solde du fidèle.
// Le montant est recalculé à chaque clic, puis redirection vers HelloAsso.
export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
  const { searchParams } = new URL(req.url);
  const pledgeId = searchParams.get("pledge");
  const donorId = searchParams.get("donor");
  const bookingId = searchParams.get("booking");
  const token = searchParams.get("t") || "";

  const target: PayTarget | null = pledgeId
    ? { kind: "pledge", id: pledgeId }
    : donorId
      ? { kind: "donor", id: donorId }
      : bookingId
        ? { kind: "booking", id: bookingId }
        : null;

  try {
    if (!target || !verifyPayTarget(target, token)) {
      return NextResponse.redirect(`${appUrl}/merci?erreur=lien`, 303);
    }

    const db = adminDb();
    let amount = 0;
    let label = "";
    let email = "";
    let firstName = "";
    let lastName = "";
    let metadata: Record<string, string>;
    let backPath: string | undefined;

    if (target.kind === "pledge") {
      let snap = await db.collection("pledges").doc(target.id).get();
      if (!snap.exists) return NextResponse.redirect(`${appUrl}/merci?erreur=lien`, 303);
      const isKiddush = (snap.data() as any).kind === "kiddouch";
      if (isKiddush) {
        // Parrainage : une garde expirée est d'abord libérée, on ne fait pas
        // payer un Chabbat qui a pu être repris par quelqu'un d'autre.
        await settleKiddushPledge(target.id);
        snap = await db.collection("pledges").doc(target.id).get();
        if (!snap.exists) return NextResponse.redirect(`${appUrl}/kiddouch?expire=1`, 303);
      }
      const p = snap.data() as any;
      amount = remainingOf(p);
      label = `${p.catalogItemName} - ${p.serviceLabel}`;
      email = p.donorEmail;
      metadata = { kind: "pledge", pledgeId: p.id, donorId: p.donorId };
      if (isKiddush) {
        metadata.kiddouch = "1";
        backPath = "/api/helloasso/cancel/{ref}";
      }
    } else if (target.kind === "booking") {
      // Réservation de places : seulement les places de cette réservation.
      // Une garde expirée est d'abord libérée : on ne fait pas payer une
      // place qui a pu être remise en vente.
      await settleBooking(target.id);
      const snap = await db.collection("pledges").where("bookingId", "==", target.id).get();
      const open = snap.docs.map((d) => d.data() as any).filter((p) => p.status !== "annule" && remainingOf(p) > 0);
      if (!snap.docs.length) return NextResponse.redirect(`${appUrl}/places?expire=1`, 303);
      if (!open.length) return NextResponse.redirect(`${appUrl}/merci?deja=1`, 303);
      amount = round2(open.reduce((s, p) => s + remainingOf(p), 0));
      label = `${open.length} place(s) - ${open[0].serviceLabel}`;
      email = open[0].donorEmail;
      metadata = { kind: "booking", bookingId: target.id, donorId: open[0].donorId, pledgeIds: open.map((p) => p.id).join(",") };
      backPath = "/api/helloasso/cancel/{ref}";
    } else {
      const donorSnap = await db.collection("donors").doc(target.id).get();
      if (!donorSnap.exists) return NextResponse.redirect(`${appUrl}/merci?erreur=lien`, 303);
      const donor = donorSnap.data() as any;
      const snap = await db.collection("pledges").where("donorId", "==", target.id).get();
      amount = round2(snap.docs.reduce((s, d) => s + remainingOf(d.data() as any), 0));
      label = `Solde de vos dons - ${donor.firstName} ${donor.lastName}`;
      email = donor.email;
      firstName = donor.firstName;
      lastName = donor.lastName;
      metadata = { kind: "donor", donorId: target.id };
    }

    if (amount <= 0) return NextResponse.redirect(`${appUrl}/merci?deja=1`, 303);

    const url = await createCheckout({ amount, label, email, firstName, lastName, containsDonation: true, metadata, backPath });
    return NextResponse.redirect(url, 303);
  } catch (err) {
    console.error("[pay]", err);
    return NextResponse.redirect(`${appUrl}/merci?erreur=paiement`, 303);
  }
}
