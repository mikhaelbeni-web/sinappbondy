import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { withPermission, handleApiError, jsonError } from "@/lib/apiHelpers";
import { getCampaignBySlug, publicDonateUrl, raisedByCampaign, slugify } from "@/lib/campaigns";

export async function GET() {
  try {
    await withPermission("gerer_paiements");
    const [snap, raised] = await Promise.all([adminDb().collection("campaigns").get(), raisedByCampaign()]);
    const campaigns = snap.docs
      .map((d) => d.data() as any)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .map((c) => ({ ...c, raised: raised[c.id]?.amount || 0, donations: raised[c.id]?.count || 0, url: publicDonateUrl(c.slug) }));
    return NextResponse.json({ campaigns, generalUrl: publicDonateUrl() });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    await withPermission("gerer_paiements");
    const { title, description, goal, suggestedAmounts } = await req.json();
    if (!title || !String(title).trim()) return jsonError("Le titre est requis.", 400);

    let slug = slugify(title) || "campagne";
    if (await getCampaignBySlug(slug)) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

    const now = new Date().toISOString();
    const ref = adminDb().collection("campaigns").doc();
    const doc = {
      id: ref.id,
      slug,
      title: String(title).trim(),
      description: typeof description === "string" ? description.trim() : "",
      goal: Math.max(0, Number(goal) || 0),
      suggestedAmounts: Array.isArray(suggestedAmounts)
        ? suggestedAmounts.map(Number).filter((n) => n > 0).slice(0, 6)
        : [18, 36, 54, 100, 180],
      active: true,
      createdAt: now,
      updatedAt: now,
    };
    await ref.set(doc);
    return NextResponse.json({ campaign: doc });
  } catch (err) {
    return handleApiError(err);
  }
}
