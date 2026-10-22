import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { withPermission, handleApiError, jsonError } from "@/lib/apiHelpers";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await withPermission("gerer_paiements");
    const snap = await adminDb().collection("events").doc(params.id).get();
    if (!snap.exists) return jsonError("Événement introuvable.", 404);
    const regs = (await adminDb().collection("registrations").where("eventId", "==", params.id).get()).docs
      .map((d) => d.data() as any)
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));
    return NextResponse.json({ event: snap.data(), registrations: regs, url: `${process.env.NEXT_PUBLIC_APP_URL || ""}/evenement/${(snap.data() as any).slug}` });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await withPermission("gerer_paiements");
    const ref = adminDb().collection("events").doc(params.id);
    if (!(await ref.get()).exists) return jsonError("Événement introuvable.", 404);
    const { active } = await req.json();
    if (typeof active === "boolean") await ref.update({ active });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
