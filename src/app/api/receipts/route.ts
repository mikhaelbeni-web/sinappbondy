import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { withPermission, handleApiError, jsonError } from "@/lib/apiHelpers";
import { missingAssociationFields } from "@/lib/association";
import { getAssociation } from "@/lib/associationServer";
import { emailReceipt, issueReceipt, pendingByDonor } from "@/lib/receipts";

// Liste des reçus d'une année + paiements encore sans reçu.
export async function GET(req: NextRequest) {
  try {
    await withPermission("gerer_paiements");
    const year = Number(new URL(req.url).searchParams.get("year")) || new Date().getFullYear();
    const [snap, pending, association] = await Promise.all([
      adminDb().collection("receipts").where("year", "==", year).get(),
      pendingByDonor(year),
      getAssociation(),
    ]);
    const receipts = snap.docs.map((d) => d.data() as any).sort((a, b) => (a.number < b.number ? 1 : -1));
    return NextResponse.json({ receipts, pending, missing: missingAssociationFields(association) });
  } catch (err) {
    return handleApiError(err);
  }
}

// Émission :
// - { donorId, year, send } : reçu récapitulatif annuel d'un fidèle ;
// - { year, send } sans donorId : récapitulatifs pour tous les fidèles
//   ayant des paiements sans reçu (ceux sans adresse sont signalés).
export async function POST(req: NextRequest) {
  try {
    const user = await withPermission("gerer_paiements");
    const { donorId, year, send } = await req.json();
    const y = Number(year) || new Date().getFullYear();
    const association = await getAssociation();
    const missing = missingAssociationFields(association);
    if (missing.length) return jsonError(`Fiche association incomplète : ${missing.join(", ")}.`, 400);

    const groups = (await pendingByDonor(y)).filter((g) => !donorId || g.donorId === donorId);
    const results: { donorId: string; donorName: string; ok: boolean; number?: string; emailed?: boolean; error?: string }[] = [];

    for (const g of groups) {
      if (!g.hasAddress) {
        results.push({ donorId: g.donorId, donorName: g.donorName, ok: false, error: "Adresse manquante" });
        continue;
      }
      try {
        const receipt = await issueReceipt({
          donorId: g.donorId,
          paymentIds: g.paymentIds,
          kind: "annuel",
          issuedBy: user.name,
          association,
        });
        let emailed = false;
        if (send) {
          const r = await emailReceipt(receipt, association).catch(() => ({ sent: false }));
          emailed = r.sent;
        }
        results.push({ donorId: g.donorId, donorName: g.donorName, ok: true, number: receipt.number, emailed });
      } catch (e: any) {
        results.push({ donorId: g.donorId, donorName: g.donorName, ok: false, error: e?.message || "Erreur" });
      }
    }
    return NextResponse.json({ results });
  } catch (err) {
    return handleApiError(err);
  }
}
