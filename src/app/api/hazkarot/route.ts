import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { withPermission, handleApiError, jsonError } from "@/lib/apiHelpers";
import { getHazkaraSettings, hebrewDeathDate, nextYahrzeit, upcomingHazkarot } from "@/lib/hazkarot";

// ?donorId=… : hazkarot d'un fidèle ; sinon celles des ?days=90 prochains jours.
export async function GET(req: NextRequest) {
  try {
    await withPermission();
    const { searchParams } = new URL(req.url);
    const donorId = searchParams.get("donorId") || undefined;
    const days = Math.min(400, Number(searchParams.get("days")) || 90);
    const [hazkarot, settings] = await Promise.all([upcomingHazkarot(days, donorId), getHazkaraSettings()]);
    return NextResponse.json({ hazkarot, settings });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    await withPermission("gerer_fideles");
    const { donorId, deceasedName, relation, deathDate, afterSunset } = await req.json();
    if (!donorId || !deceasedName?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(deathDate || "")) {
      return jsonError("Fidèle, nom du défunt et date du décès sont requis.", 400);
    }
    const donorSnap = await adminDb().collection("donors").doc(donorId).get();
    if (!donorSnap.exists) return jsonError("Fidèle introuvable.", 404);
    const donor = donorSnap.data() as any;

    const ref = adminDb().collection("hazkarot").doc();
    const doc = {
      id: ref.id,
      donorId,
      donorName: `${donor.firstName} ${donor.lastName}`,
      deceasedName: deceasedName.trim(),
      relation: typeof relation === "string" ? relation.trim() : "",
      deathDate,
      afterSunset: !!afterSunset,
      hebrewDate: hebrewDeathDate(deathDate, !!afterSunset),
      lastNotifiedFor: null,
      createdAt: new Date().toISOString(),
    };
    await ref.set(doc);
    return NextResponse.json({ hazkara: { ...doc, next: nextYahrzeit(deathDate, !!afterSunset) } });
  } catch (err) {
    return handleApiError(err);
  }
}

// Réglage des rappels : { enabled, daysBefore }.
export async function PUT(req: NextRequest) {
  try {
    await withPermission("envoyer_relances");
    const { enabled, daysBefore } = await req.json();
    await adminDb()
      .collection("settings")
      .doc("hazkarot")
      .set({ enabled: !!enabled, daysBefore: Math.min(60, Math.max(1, Math.round(Number(daysBefore) || 7))) });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
