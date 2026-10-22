import { adminDb } from "./firebaseAdmin";

// Fidèles retrouvés par e-mail (espace fidèle, dons en ligne). Les e-mails
// ne sont pas normalisés en base : on compare en minuscules côté serveur.
export async function findDonorsByEmail(email: string): Promise<any[]> {
  const e = email.trim().toLowerCase();
  if (!e) return [];
  const db = adminDb();
  const exact = await db.collection("donors").where("email", "==", email.trim()).get();
  if (!exact.empty) return exact.docs.map((d) => d.data());
  const lower = await db.collection("donors").where("email", "==", e).get();
  if (!lower.empty) return lower.docs.map((d) => d.data());
  // Dernier recours (casse différente) : volumes faibles, lecture complète.
  const all = await db.collection("donors").get();
  return all.docs.map((d) => d.data() as any).filter((d) => (d.email || "").trim().toLowerCase() === e);
}

// Don en ligne : rattache au fidèle existant (même e-mail) ou crée sa fiche.
// L'adresse saisie complète une fiche qui n'en a pas (utile au reçu fiscal).
export async function findOrCreateDonor(params: {
  firstName: string;
  lastName: string;
  email: string;
  address?: string;
  postalCode?: string;
  city?: string;
}): Promise<string> {
  const db = adminDb();
  const now = new Date().toISOString();
  const existing = (await findDonorsByEmail(params.email))[0];
  if (existing) {
    if (!existing.address && params.address && params.postalCode && params.city) {
      await db.collection("donors").doc(existing.id).update({
        address: params.address,
        postalCode: params.postalCode,
        city: params.city,
        updatedAt: now,
      });
    }
    return existing.id;
  }
  const ref = db.collection("donors").doc();
  await ref.set({
    id: ref.id,
    firstName: params.firstName.trim(),
    lastName: params.lastName.trim(),
    email: params.email.trim(),
    phone: "",
    address: (params.address || "").trim(),
    postalCode: (params.postalCode || "").trim(),
    city: (params.city || "").trim(),
    notes: "Créé par un don en ligne",
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}
