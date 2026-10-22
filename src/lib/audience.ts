import { adminDb } from "./firebaseAdmin";
import { remainingOf, round2 } from "./format";

export type Audience =
  | { type: "tous" }
  | { type: "groupes"; groups: string[] }
  | { type: "solde" } // fidèles avec un reste dû
  | { type: "donateurs"; year: number }; // fidèles ayant versé dans l'année

// Destinataires d'un message groupé : fidèles avec e-mail, non désinscrits,
// dédoublonnés par adresse.
export async function resolveAudience(a: Audience) {
  const db = adminDb();
  const donorsSnap = await db.collection("donors").get();
  let donors = donorsSnap.docs.map((d) => d.data() as any).filter((d) => d.email && !d.emailOptOut);

  const balance: Record<string, number> = {};
  {
    // Le solde sert au filtre « solde » et à la variable {solde}.
    const pledges = await db.collection("pledges").get();
    for (const d of pledges.docs) {
      const p = d.data() as any;
      balance[p.donorId] = round2((balance[p.donorId] || 0) + remainingOf(p));
    }
  }

  if (a.type === "groupes") {
    const wanted = new Set(a.groups);
    donors = donors.filter((d) => (d.groups || []).some((g: string) => wanted.has(g)));
  } else if (a.type === "solde") {
    donors = donors.filter((d) => (balance[d.id] || 0) > 0);
  } else if (a.type === "donateurs") {
    const payments = await db.collection("payments").get();
    const ids = new Set(payments.docs.map((d) => d.data() as any).filter((p) => p.date.startsWith(String(a.year))).map((p) => p.donorId));
    donors = donors.filter((d) => ids.has(d.id));
  }

  const seen = new Set<string>();
  return donors
    .filter((d) => {
      const e = d.email.trim().toLowerCase();
      if (seen.has(e)) return false;
      seen.add(e);
      return true;
    })
    .map((d) => ({ id: d.id, firstName: d.firstName, lastName: d.lastName, email: d.email.trim(), balance: balance[d.id] || 0 }));
}
