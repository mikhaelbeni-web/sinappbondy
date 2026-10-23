import { adminDb } from "./firebaseAdmin";
import { round2 } from "./format";

export function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// Montant collecté par campagne (dons en ligne et saisis rattachés).
export async function raisedByCampaign(): Promise<Record<string, { amount: number; count: number }>> {
  const snap = await adminDb().collection("payments").get();
  const out: Record<string, { amount: number; count: number }> = {};
  for (const d of snap.docs) {
    const p = d.data() as any;
    if (!p.campaignId) continue;
    const e = (out[p.campaignId] ||= { amount: 0, count: 0 });
    e.amount = round2(e.amount + p.amount);
    e.count++;
  }
  return out;
}

export async function getCampaignBySlug(slug: string): Promise<any | null> {
  const snap = await adminDb().collection("campaigns").where("slug", "==", slug).limit(1).get();
  return snap.empty ? null : snap.docs[0].data();
}

export function publicDonateUrl(slug?: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return slug ? `${appUrl}/don/${slug}` : `${appUrl}/don`;
}
