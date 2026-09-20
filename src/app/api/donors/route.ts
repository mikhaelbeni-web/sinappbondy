import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { withPermission, handleApiError, jsonError } from "@/lib/apiHelpers";

export async function GET() {
  try {
    await withPermission();
    const snap = await adminDb().collection("donors").orderBy("lastName", "asc").get();
    const donors = snap.docs.map((d) => d.data());
    return NextResponse.json({ donors });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    await withPermission("gerer_fideles");
    const { firstName, lastName, email, phone, notes } = await req.json();
    if (!firstName || !lastName) return jsonError("Prénom et nom sont requis.", 400);

    const now = new Date().toISOString();
    const ref = adminDb().collection("donors").doc();
    const doc = {
      id: ref.id,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: (email || "").trim(),
      phone: (phone || "").trim(),
      notes: notes || "",
      createdAt: now,
      updatedAt: now,
    };
    await ref.set(doc);
    return NextResponse.json({ donor: doc });
  } catch (err) {
    return handleApiError(err);
  }
}
