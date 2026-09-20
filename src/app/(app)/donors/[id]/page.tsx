"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { formatEUR, formatDate } from "@/lib/format";
import StatusBadge from "@/components/StatusBadge";
import { useAuth } from "@/context/AuthContext";

export default function DonorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const [donor, setDonor] = useState<any>(null);
  const [pledges, setPledges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reminding, setReminding] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/donors/${id}`);
    const data = await res.json();
    setDonor(data.donor);
    setPledges(data.pledges || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [id]);

  async function relancer(pledgeId: string) {
    setReminding(pledgeId);
    setMessage("");
    try {
      const res = await fetch(`/api/pledges/${pledgeId}/remind`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessage("Relance envoyée.");
      await load();
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setReminding(null);
    }
  }

  if (loading) return <p className="text-gray-500">Chargement…</p>;
  if (!donor) return <p className="text-gray-500">Fidèle introuvable.</p>;

  const totalDu = pledges.filter((p) => p.status !== "paye" && p.status !== "annule").reduce((s, p) => s + p.amount, 0);
  const totalPaye = pledges.filter((p) => p.status === "paye").reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-serif font-bold text-ink">{donor.firstName} {donor.lastName}</h1>
        <p className="text-sm text-gray-500">{donor.email || "Pas d'e-mail"} {donor.phone && `· ${donor.phone}`}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 max-w-md">
        <div className="card p-4">
          <p className="text-xs text-gray-500 uppercase">Reste dû</p>
          <p className="text-xl font-bold text-amber-700">{formatEUR(totalDu)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 uppercase">Total payé</p>
          <p className="text-xl font-bold text-green-700">{formatEUR(totalPaye)}</p>
        </div>
      </div>

      {message && <p className="text-sm text-gray-600">{message}</p>}

      <div className="card">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-ink">Historique des dons</h2>
        </div>
        <div className="divide-y">
          {pledges.length === 0 && <p className="p-4 text-sm text-gray-500">Aucune promesse pour ce fidèle.</p>}
          {pledges.map((p) => (
            <div key={p.id} className="p-4 flex items-center justify-between text-sm">
              <div>
                <p className="font-medium text-ink">{p.catalogItemName}</p>
                <p className="text-gray-500">{p.serviceLabel} · {formatDate(p.createdAt)} · saisi par {p.createdByName}</p>
                {p.notes && <p className="text-gray-400 italic">{p.notes}</p>}
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold">{formatEUR(p.amount)}</span>
                <StatusBadge status={p.status} />
                {can("envoyer_relances") && p.status !== "paye" && p.status !== "annule" && (
                  <button
                    onClick={() => relancer(p.id)}
                    disabled={reminding === p.id}
                    className="btn-secondary text-xs px-2 py-1"
                  >
                    {reminding === p.id ? "Envoi…" : "Relancer"}
                  </button>
                )}
                {p.stripePaymentLinkUrl && (
                  <a href={p.stripePaymentLinkUrl} target="_blank" rel="noreferrer" className="text-gold text-xs hover:underline">
                    Lien
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
