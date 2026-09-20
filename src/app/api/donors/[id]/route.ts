import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { withPermission, handleApiError, jsonError } from "@/lib/apiHelpers";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await withPermission();
    const snap = await adminDb().collection("donors").doc(params.id).get();
    if (!snap.exists) return jsonError("Fidèle introuvable.", 404);

    // Pas de orderBy() ici : combiné à un where() sur un autre champ, ça
    // exigerait un index composite Firestore. On trie en mémoire à la place
    // (volumes faibles, sans conséquence).
    const pledgesSnap = await adminDb().collection("pledges").where("donorId", "==", params.id).get();
    const pledges = pledgesSnap.docs
      .map((d) => d.data() as any)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

    return NextResponse.json({ donor: snap.data(), pledges });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await withPermission("gerer_fideles");
    const ref = adminDb().collection("donors").doc(params.id);
    const snap = await ref.get();
    if (!snap.exists) return jsonError("Fidèle introuvable.", 404);

    const { firstName, lastName, email, phone, notes } = await req.json();
    const update: any = { updatedAt: new Date().toISOString() };
    if (typeof firstName === "string" && firstName.trim()) update.firstName = firstName.trim();
    if (typeof lastName === "string" && lastName.trim()) update.lastName = lastName.trim();
    if (typeof email === "string") update.email = email.trim();
    if (typeof phone === "string") update.phone = phone.trim();
    if (typeof notes === "string") update.notes = notes;

    await ref.update(update);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await withPermission("gerer_fideles");
    const pledgesSnap = await adminDb().collection("pledges").where("donorId", "==", params.id).limit(1).get();
    if (!pledgesSnap.empty) {
      return jsonError("Ce fidèle a des promesses de dons enregistrées et ne peut pas être supprimé.", 400);
    }
    await adminDb().collection("donors").doc(params.id).delete();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
