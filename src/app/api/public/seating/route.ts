import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/apiHelpers";
import { currentDonorId } from "@/lib/donorSession";
import { payUrl } from "@/lib/payments";
import { adminDb } from "@/lib/firebaseAdmin";
import { planView, publishedPlans, settlePendingSeats } from "@/lib/seatingServer";

export const dynamic = "force-dynamic";

// Plans publiés, visibles sans compte. Les places prises sont renvoyées
// sans nom. Un fidèle déjà connecté voit en plus ses propres places.
export async function GET() {
  try {
    let donorId = currentDonorId();
    // Fiche retirée depuis (réservation jamais payée) : visiteur anonyme.
    if (donorId && !(await adminDb().collection("donors").doc(donorId).get()).exists) donorId = null;
    const out = [];
    let due = 0;
    for (const plan of await publishedPlans()) {
      await settlePendingSeats(plan).catch((e) => console.error("[seating] libération", e));
      const v = await planView(plan, donorId);
      out.push(v.view);
      due += v.due;
    }
    let balanceUrl: string | null = null;
    try {
      if (donorId && due > 0) balanceUrl = payUrl({ kind: "donor", id: donorId });
    } catch {}
    return NextResponse.json({ plans: out, due: Math.round(due * 100) / 100, balanceUrl, signedIn: !!donorId });
  } catch (err) {
    return handleApiError(err);
  }
}
