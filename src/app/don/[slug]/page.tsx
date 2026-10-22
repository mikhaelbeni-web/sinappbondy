"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import DonateForm from "@/components/DonateForm";
import { formatEUR } from "@/lib/format";

// Page publique d'une campagne de dons (lien ou QR code).
export default function CampaignPage() {
  const { slug } = useParams<{ slug: string }>();
  const [campaign, setCampaign] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/public/campaigns/${slug}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setCampaign(d.campaign);
      })
      .catch((e) => setError(e.message));
  }, [slug]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream px-4">
        <div className="card p-8 max-w-md text-center">
          <p className="text-gray-600">{error}</p>
          <a href="/don" className="text-gold hover:underline mt-3 inline-block">Faire un don à la synagogue</a>
        </div>
      </div>
    );
  }
  if (!campaign) return <div className="min-h-screen flex items-center justify-center bg-cream text-gray-500">Chargement…</div>;

  const pct = campaign.goal > 0 ? Math.min(100, Math.round((campaign.raised / campaign.goal) * 100)) : 0;

  return (
    <div className="min-h-screen bg-cream px-4 py-10">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-serif font-bold text-ink">{campaign.title}</h1>
          {campaign.description && <p className="text-gray-600 mt-2 whitespace-pre-line">{campaign.description}</p>}
        </div>

        {campaign.goal > 0 && (
          <div className="card p-4 space-y-2">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="font-semibold text-green-700">{formatEUR(campaign.raised)} collectés</span>
              <span className="text-gray-500">objectif {formatEUR(campaign.goal)}</span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full bg-gold" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-xs text-gray-500">{campaign.donations} don(s) · {pct} %</p>
          </div>
        )}

        <div className="card p-6">
          <DonateForm campaign={slug} suggested={campaign.suggestedAmounts} />
        </div>
      </div>
    </div>
  );
}
