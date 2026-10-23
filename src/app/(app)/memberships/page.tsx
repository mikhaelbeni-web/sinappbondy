"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatEUR } from "@/lib/format";
import StatusBadge from "@/components/StatusBadge";
import { useAuth } from "@/context/AuthContext";

export default function MembershipsPage() {
  const { can } = useAuth();
  const current = new Date().getFullYear();
  const [year, setYear] = useState(current);
  const [data, setData] = useState<any>(null);
  const [tiers, setTiers] = useState<{ name: string; amount: number }[]>([]);
  const [defaultTier, setDefaultTier] = useState("");
  const [target, setTarget] = useState<"tous" | "groupes">("tous");
  const [groups, setGroups] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    const res = await fetch(`/api/memberships?year=${year}`);
    const d = await res.json();
    setData(d);
    setTiers(d.tiers || []);
    setDefaultTier((t) => t || d.tiers?.[0]?.name || "");
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  async function saveTiers() {
    setMessage("");
    const res = await fetch("/api/memberships", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tiers }),
    });
    const d = await res.json();
    setMessage(res.ok ? "Formules enregistrées." : d.error);
    if (res.ok) setTiers(d.tiers);
  }

  async function callMemberships() {
    if (!confirm(`Créer la cotisation ${year} pour ${target === "tous" ? "tous les fidèles" : `les groupes ${groups.join(", ")}`} ?`)) return;
    setBusy(true);
    setMessage("");
    const res = await fetch("/api/memberships/call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year, defaultTier, groups: target === "groupes" ? groups : [] }),
    });
    const d = await res.json();
    setMessage(res.ok ? `${d.created} cotisation(s) créée(s), ${d.skipped} fidèle(s) déjà appelé(s).` : d.error);
    setBusy(false);
    await load();
  }

  if (!can("gerer_paiements")) return <p className="text-gray-500">Vous n'avez pas accès aux cotisations.</p>;
  if (!data) return <p className="text-gray-500">Chargement…</p>;

  const rows = data.rows.filter((r: any) =>
    filter === "a_jour" ? r.remaining === 0 && r.status !== "annule" : filter === "du" ? r.remaining > 0 : true
  );
  const total = data.rows.reduce((s: number, r: any) => s + (r.status === "annule" ? 0 : r.amount), 0);
  const paid = data.rows.reduce((s: number, r: any) => s + r.paid, 0);
  const upToDate = data.rows.filter((r: any) => r.remaining === 0 && r.status !== "annule").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-serif font-bold text-ink">Cotisations</h1>
        <select className="input w-full sm:w-32" value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {[current + 1, current, current - 1, current - 2].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Appelées" value={String(data.rows.length)} />
        <Stat label="À jour" value={`${upToDate}`} accent="text-green-700" />
        <Stat label="Encaissé" value={formatEUR(paid)} accent="text-green-700" />
        <Stat label="Reste dû" value={formatEUR(total - paid)} accent="text-amber-700" />
      </div>

      <div className="card p-4 space-y-3">
        <h2 className="font-semibold text-ink">Formules</h2>
        {tiers.map((t, i) => (
          <div key={i} className="flex flex-wrap gap-2 items-center">
            <input className="input flex-1 min-w-[8rem]" value={t.name} onChange={(e) => setTiers(tiers.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
            <input type="number" min="0" className="input w-28" value={t.amount} onChange={(e) => setTiers(tiers.map((x, j) => (j === i ? { ...x, amount: Number(e.target.value) } : x)))} />
            <span className="text-sm text-gray-500">€ / an</span>
            <button className="text-xs text-red-600 hover:underline tap" onClick={() => setTiers(tiers.filter((_, j) => j !== i))}>Retirer</button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary text-sm" onClick={() => setTiers([...tiers, { name: "", amount: 0 }])}>+ Formule</button>
          <button className="btn-primary text-sm" onClick={saveTiers}>Enregistrer les formules</button>
        </div>
        <p className="text-xs text-gray-500">La formule habituelle d'un fidèle se choisit sur sa fiche (Modifier). Sans formule, la formule par défaut ci-dessous s'applique.</p>
      </div>

      <div className="card p-4 space-y-3">
        <h2 className="font-semibold text-ink">Appeler les cotisations {year}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Formule par défaut</label>
            <select className="input" value={defaultTier} onChange={(e) => setDefaultTier(e.target.value)}>
              {tiers.map((t) => (
                <option key={t.name} value={t.name}>{t.name} ({formatEUR(t.amount)})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Fidèles concernés</label>
            <select className="input" value={target} onChange={(e) => setTarget(e.target.value as any)}>
              <option value="tous">Tous les fidèles ({data.donorCount})</option>
              <option value="groupes">Certains groupes</option>
            </select>
          </div>
        </div>
        {target === "groupes" && (
          <div className="flex flex-wrap gap-3">
            {data.groups.length === 0 && <p className="text-sm text-gray-500">Aucun groupe défini sur les fiches fidèles.</p>}
            {data.groups.map((g: string) => (
              <label key={g} className="tap flex items-center gap-1.5 text-sm">
                <input type="checkbox" checked={groups.includes(g)} onChange={(e) => setGroups((p) => (e.target.checked ? [...p, g] : p.filter((x) => x !== g)))} />
                {g}
              </label>
            ))}
          </div>
        )}
        <p className="text-xs text-gray-500">
          Chaque fidèle reçoit une cotisation à régler : elle apparaît dans son espace, part dans les relances automatiques et donne lieu à un reçu fiscal une fois payée. Les fidèles déjà appelés pour {year} sont ignorés.
        </p>
        <button className="btn-gold" disabled={busy || (target === "groupes" && !groups.length)} onClick={callMemberships}>
          {busy ? "Création…" : `Appeler les cotisations ${year}`}
        </button>
        {message && <p className="text-sm text-gray-700">{message}</p>}
      </div>

      <div className="card">
        <div className="p-4 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h2 className="font-semibold text-ink">Suivi {year}</h2>
          <select className="input w-full sm:w-44" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">Tous</option>
            <option value="a_jour">À jour</option>
            <option value="du">Reste dû</option>
          </select>
        </div>
        <div className="divide-y">
          {rows.length === 0 && <p className="p-4 text-sm text-gray-500">Aucune cotisation.</p>}
          {rows.map((r: any) => (
            <Link key={r.pledgeId} href={`/donors/${r.donorId}`} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm hover:bg-gray-50">
              <div className="min-w-0">
                <p className="font-medium text-ink">{r.donorName}</p>
                <p className="text-gray-500">{r.tier}{r.remaining > 0 && r.paid > 0 ? ` · reste ${formatEUR(r.remaining)}` : ""}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-semibold">{formatEUR(r.amount)}</span>
                <StatusBadge status={r.status} />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-gray-500 uppercase">{label}</p>
      <p className={`text-xl font-bold ${accent || "text-ink"}`}>{value}</p>
    </div>
  );
}
