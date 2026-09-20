import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { withPermission, handleApiError, jsonError } from "@/lib/apiHelpers";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await withPermission();
    const snap = await adminDb().collection("services").doc(params.id).get();
    if (!snap.exists) return jsonError("Office introuvable.", 404);

    const pledgesSnap = await adminDb().collection("pledges").where("serviceId", "==", params.id).get();
    const pledges = pledgesSnap.docs
      .map((d) => d.data() as any)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

    return NextResponse.json({ service: snap.data(), pledges });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await withPermission("gerer_offices");
    const ref = adminDb().collection("services").doc(params.id);
    const snap = await ref.get();
    if (!snap.exists) return jsonError("Office introuvable.", 404);

    const { date, type, label, notes, closed } = await req.json();
    const update: any = {};
    if (typeof date === "string") update.date = date;
    if (typeof type === "string") update.type = type;
    if (typeof label === "string" && label.trim()) update.label = label.trim();
    if (typeof notes === "string") update.notes = notes;
    if (typeof closed === "boolean") update.closed = closed;

    await ref.update(update);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await withPermission("gerer_offices");
    const pledgesSnap = await adminDb().collection("pledges").where("serviceId", "==", params.id).limit(1).get();
    if (!pledgesSnap.empty) {
      return jsonError("Des promesses sont déjà enregistrées sur cet office.", 400);
    }
    await adminDb().collection("services").doc(params.id).delete();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
