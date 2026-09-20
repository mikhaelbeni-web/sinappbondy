import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { withPermission, handleApiError, jsonError } from "@/lib/apiHelpers";

export async function GET() {
  try {
    await withPermission();
    const snap = await adminDb().collection("catalog").orderBy("order", "asc").get();
    const items = snap.docs.map((d) => d.data());
    return NextResponse.json({ items });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    await withPermission("gerer_catalogue");
    const { name, category, order } = await req.json();
    if (!name) return jsonError("Nom requis.", 400);

    const now = new Date().toISOString();
    const ref = adminDb().collection("catalog").doc();
    const doc = {
      id: ref.id,
      name: name.trim(),
      category: category || "special",
      order: typeof order === "number" ? order : 99,
      active: true,
      createdAt: now,
    };
    await ref.set(doc);
    return NextResponse.json({ item: doc });
  } catch (err) {
    return handleApiError(err);
  }
}
