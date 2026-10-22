import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { withPermission, handleApiError, jsonError } from "@/lib/apiHelpers";
import { hasPermission } from "@/lib/permissions";
import { payUrl } from "@/lib/payments";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await withPermission();
    const snap = await adminDb().collection("donors").doc(params.id).get();
    if (!snap.exists) return jsonError("Fidèle introuvable.", 404);

    // Pas de orderBy() ici : combiné à un where() sur un autre champ, ça
    // exigerait un index composite Firestore. On trie en mémoire à la place
    // (volumes faibles, sans conséquence).
    const pledgesSnap = await adminDb().collection("pledges").where("donorId", "==", params.id).get();
    const pledges = pledgesSnap.docs
      .map((d) => d.data() as any)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

    let payments: any[] = [];
    let receipts: any[] = [];
    if (hasPermission(user.role, "gerer_paiements")) {
      const [paySnap, receiptSnap] = await Promise.all([
        adminDb().collection("payments").where("donorId", "==", params.id).get(),
        adminDb().collection("receipts").where("donorId", "==", params.id).get(),
      ]);
      receipts = receiptSnap.docs.map((d) => d.data() as any).sort((a, b) => (a.number < b.number ? 1 : -1));
      payments = paySnap.docs
        .map((d) => d.data() as any)
        .sort((a, b) => (a.date === b.date ? (a.createdAt < b.createdAt ? 1 : -1) : a.date < b.date ? 1 : -1));
    }

    // Lien « régler tout le solde » à copier ou envoyer (null si Stripe n'est pas configuré).
    let balancePayUrl: string | null = null;
    try {
      balancePayUrl = payUrl({ kind: "donor", id: params.id });
    } catch {}

    return NextResponse.json({ donor: snap.data(), pledges, payments, receipts, balancePayUrl });
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

    const { firstName, lastName, email, phone, notes, address, postalCode, city, groups, emailOptOut } = await req.json();
    const update: any = { updatedAt: new Date().toISOString() };
    if (typeof firstName === "string" && firstName.trim()) update.firstName = firstName.trim();
    if (typeof lastName === "string" && lastName.trim()) update.lastName = lastName.trim();
    if (typeof email === "string") update.email = email.trim();
    if (typeof phone === "string") update.phone = phone.trim();
    if (typeof notes === "string") update.notes = notes;
    if (typeof address === "string") update.address = address.trim();
    if (typeof postalCode === "string") update.postalCode = postalCode.trim();
    if (typeof city === "string") update.city = city.trim();
    if (Array.isArray(groups)) {
      update.groups = Array.from(new Set(groups.map((g: unknown) => String(g).trim()).filter(Boolean))).slice(0, 20);
    }
    if (typeof emailOptOut === "boolean") update.emailOptOut = emailOptOut;

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
