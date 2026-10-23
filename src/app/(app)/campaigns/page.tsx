"use client";

import { useEffect, useState } from "react";
import { formatEUR } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";

export default function CampaignsPage() {
  const { can } = useAuth();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [generalUrl, setGeneralUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", goal: "", suggested: "18, 36, 54, 100, 180" });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/campaigns");
    const data = await res.json();
    setCampaigns(data.campaigns || []);
    setGeneralUrl(data.generalUrl || "");
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        description: form.description,
        goal: Number(form.goal) || 0,
        suggestedAmounts: form.suggested.split(/[,; ]+/).map(Number).filter((n) => n > 0),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setForm({ title: "", description: "", goal: "", suggested: "18, 36, 54, 100, 180" });
    setShowForm(false);
    await load();
  }

  async function toggle(c: any) {
    await fetch(`/api/campaigns/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !c.active }),
    });
    await load();
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Lien copié.");
    } catch {
      setMessage(url);
    }
  }

  if (!can("gerer_paiements")) return <p className="text-gray-500">Vous n'avez pas accès aux campagnes.</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-serif font-bold text-ink">Campagnes de dons</h1>
        <button onClick={() => setShowForm((v) => !v)} className="btn-gold">
          {showForm ? "Fermer" : "+ Nouvelle campagne"}
        </button>
      </div>

      <div className="card p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm">
        <div className="min-w-0">
          <p className="font-medium text-ink">Page de don générale</p>
          <p className="text-gray-500 break-all">{generalUrl}</p>
        </div>
        <div className="flex flex-wrap gap-3 shrink-0">
          <button className="text-gold hover:underline tap" onClick={() => copy(generalUrl)}>Copier le lien</button>
          <a className="text-gold hover:underline tap" href="/api/campaigns/general/qr" target="_blank" rel="noreferrer">QR code</a>
        </div>
      </div>

      {showForm && (
        <form onSubmit={create} className="card p-4 space-y-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div>
            <label className="label">Titre</label>
            <input required className="input" placeholder="ex : Rénovation du Heikhal" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <label className="label">Description (affichée aux donateurs)</label>
            <textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Objectif (€, facultatif)</label>
              <input type="number" min="0" className="input" value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })} />
            </div>
            <div>
              <label className="label">Montants proposés (€)</label>
              <input className="input" value={form.suggested} onChange={(e) => setForm({ ...form, suggested: e.target.value })} />
            </div>
          </div>
          <button type="submit" className="btn-primary">Créer la campagne</button>
        </form>
      )}

      {message && <p className="text-sm text-gray-600 break-all">{message}</p>}

      <div className="card divide-y">
        {loading && <p className="p-4 text-sm text-gray-500">Chargement…</p>}
        {!loading && campaigns.length === 0 && <p className="p-4 text-sm text-gray-500">Aucune campagne pour l'instant.</p>}
        {campaigns.map((c) => {
          const pct = c.goal > 0 ? Math.min(100, Math.round((c.raised / c.goal) * 100)) : null;
          return (
            <div key={c.id} className={`p-4 space-y-2 text-sm ${c.active ? "" : "opacity-60"}`}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-ink">
                    {c.title} {!c.active && <span className="text-xs text-gray-500">(clôturée)</span>}
                  </p>
                  <p className="text-gray-500 break-all">{c.url}</p>
                </div>
                <div className="flex flex-wrap gap-3 shrink-0">
                  <button className="text-gold hover:underline tap" onClick={() => copy(c.url)}>Copier le lien</button>
                  <a className="text-gold hover:underline tap" href={`/api/campaigns/${c.id}/qr`} target="_blank" rel="noreferrer">QR code</a>
                  <a className="text-gold hover:underline tap" href={c.url} target="_blank" rel="noreferrer">Voir</a>
                  <button className="text-gray-600 hover:underline tap" onClick={() => toggle(c)}>{c.active ? "Clôturer" : "Rouvrir"}</button>
                </div>
              </div>
              <p className="text-gray-600">
                <span className="font-semibold text-green-700">{formatEUR(c.raised)}</span> collectés · {c.donations} don(s)
                {c.goal > 0 && ` · objectif ${formatEUR(c.goal)} (${pct} %)`}
              </p>
              {pct !== null && (
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gold" style={{ width: `${pct}%` }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
