import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { withPermission, handleApiError, jsonError } from "@/lib/apiHelpers";

export async function GET() {
  try {
    await withPermission();
    const snap = await adminDb().collection("services").orderBy("date", "desc").get();
    const services = snap.docs.map((d) => d.data());
    return NextResponse.json({ services });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await withPermission("gerer_offices");
    const { date, type, label, notes } = await req.json();
    if (!date || !label) return jsonError("Date et intitulé sont requis.", 400);

    const now = new Date().toISOString();
    const ref = adminDb().collection("services").doc();
    const doc = {
      id: ref.id,
      date,
      type: type || "shabbat",
      label: label.trim(),
      notes: notes || "",
      closed: false,
      createdBy: user.uid,
      createdAt: now,
    };
    await ref.set(doc);
    return NextResponse.json({ service: doc });
  } catch (err) {
    return handleApiError(err);
  }
}
