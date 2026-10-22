import { adminDb } from "./firebaseAdmin";

// Cotisations annuelles : chaque appel de cotisation crée, pour chaque
// fidèle concerné, une « promesse » de type cotisation. Elle profite ainsi
// de tout le reste : paiements partiels, relances, espace fidèle, reçus.

export interface MembershipTier {
  name: string;
  amount: number;
}

export const DEFAULT_TIERS: MembershipTier[] = [
  { name: "Individuel", amount: 180 },
  { name: "Famille", amount: 360 },
];

export async function getTiers(): Promise<MembershipTier[]> {
  const snap = await adminDb().collection("settings").doc("memberships").get();
  const tiers = snap.exists ? (snap.data() as any).tiers : null;
  return Array.isArray(tiers) && tiers.length ? tiers : DEFAULT_TIERS;
}

export async function membershipPledges(year: number) {
  const snap = await adminDb().collection("pledges").where("membershipYear", "==", year).get();
  return snap.docs.map((d) => d.data() as any).filter((p) => p.kind === "cotisation");
}
