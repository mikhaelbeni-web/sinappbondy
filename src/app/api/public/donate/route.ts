import { NextRequest, NextResponse } from "next/server";
import { getCampaignBySlug } from "@/lib/campaigns";
import { createCheckout } from "@/lib/helloasso";

// Don en ligne depuis la page publique : crée le paiement HelloAsso. Le fidèle
// est rattaché (ou créé) par le webhook une fois le paiement confirmé.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const amount = Math.round(Number(body.amount) * 100) / 100;
    const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
    const firstName = str(body.firstName, 80);
    const lastName = str(body.lastName, 80);
    const email = str(body.email, 120);

    if (!(amount >= 1 && amount <= 50000)) return NextResponse.json({ error: "Montant entre 1 € et 50 000 €." }, { status: 400 });
    if (!firstName || !lastName || !email.includes("@")) {
      return NextResponse.json({ error: "Prénom, nom et e-mail sont requis." }, { status: 400 });
    }

    let campaign: any = null;
    if (body.campaign) {
      campaign = await getCampaignBySlug(str(body.campaign, 80));
      if (!campaign || !campaign.active) return NextResponse.json({ error: "Campagne terminée." }, { status: 400 });
    }

    const synagogueName = process.env.NEXT_PUBLIC_SYNAGOGUE_NAME || "Synagogue";
    const url = await createCheckout({
      amount,
      label: campaign ? `Don - ${campaign.title}` : `Don - ${synagogueName}`,
      email,
      firstName,
      lastName,
      containsDonation: true,
      metadata: {
        kind: "don",
        campaignId: campaign?.id || "",
        firstName,
        lastName,
        email,
        address: str(body.address),
        postalCode: str(body.postalCode, 10),
        city: str(body.city, 80),
      },
    });
    return NextResponse.json({ url });
  } catch (err) {
    console.error("[public/donate]", err);
    return NextResponse.json({ error: "Paiement en ligne indisponible pour le moment." }, { status: 500 });
  }
}
