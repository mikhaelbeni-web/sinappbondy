import { NextRequest, NextResponse } from "next/server";
import { getCampaignBySlug, raisedByCampaign } from "@/lib/campaigns";

// Infos publiques d'une campagne (page /don/<slug>).
export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const c = await getCampaignBySlug(params.slug);
    if (!c || !c.active) return NextResponse.json({ error: "Campagne introuvable ou terminée." }, { status: 404 });
    const raised = (await raisedByCampaign())[c.id];
    return NextResponse.json({
      campaign: {
        title: c.title,
        description: c.description,
        goal: c.goal,
        suggestedAmounts: c.suggestedAmounts,
        raised: raised?.amount || 0,
        donations: raised?.count || 0,
      },
    });
  } catch (err) {
    console.error("[public/campaigns]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
