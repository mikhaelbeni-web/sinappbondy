import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { withPermission, handleApiError, jsonError } from "@/lib/apiHelpers";
import { ASSOCIATION_CATEGORIES, EMPTY_ASSOCIATION, missingAssociationFields } from "@/lib/association";
import { getAssociation } from "@/lib/associationServer";

// Fiche de l'association (émetteur des reçus fiscaux).
export async function GET() {
  try {
    await withPermission("gerer_paiements");
    const association = await getAssociation();
    return NextResponse.json({ association, missing: missingAssociationFields(association) });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    await withPermission("gerer_paiements");
    const body = await req.json();
    const update: any = {};
    for (const key of Object.keys(EMPTY_ASSOCIATION) as (keyof typeof EMPTY_ASSOCIATION)[]) {
      if (key === "updatedAt") continue;
      const v = body[key];
      if (key === "autoReceipt") {
        if (typeof v === "boolean") update.autoReceipt = v;
      } else if (typeof v === "string") {
        update[key] = key === "signatureImage" || key === "logoImage" ? v : v.trim();
      }
    }
    if (update.category && !ASSOCIATION_CATEGORIES.some((c) => c.key === update.category)) {
      return jsonError("Qualité de l'organisme invalide.", 400);
    }
    if (update.rna && !/^W\d{9}$/i.test(update.rna)) return jsonError("Le n° RNA doit être de la forme W123456789.", 400);
    if (update.rna) update.rna = update.rna.toUpperCase();
    if (update.siren) update.siren = update.siren.replace(/\s/g, "");
    if (update.siren && !/^\d{9}$/.test(update.siren)) return jsonError("Le SIREN doit compter 9 chiffres.", 400);
    for (const [key, label] of [["signatureImage", "Signature"], ["logoImage", "Logo"]] as const) {
      const img = update[key];
      if (!img) continue;
      if (!/^data:image\/(png|jpe?g);base64,/.test(img)) return jsonError(`${label} : image PNG ou JPEG attendue.`, 400);
      if (img.length > 400_000) return jsonError(`${label} trop lourd(e) : choisissez une image plus légère.`, 400);
    }
    update.updatedAt = new Date().toISOString();

    await adminDb().collection("settings").doc("association").set(update, { merge: true });
    const association = await getAssociation();
    return NextResponse.json({ association, missing: missingAssociationFields(association) });
  } catch (err) {
    return handleApiError(err);
  }
}
