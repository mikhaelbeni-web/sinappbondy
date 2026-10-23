import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { remainingOf, round2 } from "@/lib/format";
import { verifyPayTarget, type PayTarget } from "@/lib/payments";
import { createCheckoutSession } from "@/lib/stripeHelpers";

// Lien de paiement public (envoyé par e-mail) : ?pledge=<id>&t=<signature>
// ou ?donor=<id>&t=<signature> pour régler tout le solde du fidèle.
// Le montant est recalculé à chaque clic, puis redirection vers Stripe.
export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
  const { searchParams } = new URL(req.url);
  const pledgeId = searchParams.get("pledge");
  const donorId = searchParams.get("donor");
  const token = searchParams.get("t") || "";

  const target: PayTarget | null = pledgeId
    ? { kind: "pledge", id: pledgeId }
    : donorId
      ? { kind: "donor", id: donorId }
      : null;

  try {
    if (!target || !verifyPayTarget(target, token)) {
      return NextResponse.redirect(`${appUrl}/merci?erreur=lien`, 303);
    }

    const db = adminDb();
    let amount = 0;
    let label = "";
    let email = "";
    let metadata: Record<string, string>;

    if (target.kind === "pledge") {
      const snap = await db.collection("pledges").doc(target.id).get();
      if (!snap.exists) return NextResponse.redirect(`${appUrl}/merci?erreur=lien`, 303);
      const p = snap.data() as any;
      amount = remainingOf(p);
      label = `${p.catalogItemName} - ${p.serviceLabel}`;
      email = p.donorEmail;
      metadata = { kind: "pledge", pledgeId: p.id, donorId: p.donorId };
    } else {
      const donorSnap = await db.collection("donors").doc(target.id).get();
      if (!donorSnap.exists) return NextResponse.redirect(`${appUrl}/merci?erreur=lien`, 303);
      const donor = donorSnap.data() as any;
      const snap = await db.collection("pledges").where("donorId", "==", target.id).get();
      amount = round2(snap.docs.reduce((s, d) => s + remainingOf(d.data() as any), 0));
      label = `Solde de vos dons - ${donor.firstName} ${donor.lastName}`;
      email = donor.email;
      metadata = { kind: "donor", donorId: target.id };
    }

    if (amount <= 0) return NextResponse.redirect(`${appUrl}/merci?deja=1`, 303);

    const url = await createCheckoutSession({ amount, label, email, metadata });
    return NextResponse.redirect(url, 303);
  } catch (err) {
    console.error("[pay]", err);
    return NextResponse.redirect(`${appUrl}/merci?erreur=stripe`, 303);
  }
}
