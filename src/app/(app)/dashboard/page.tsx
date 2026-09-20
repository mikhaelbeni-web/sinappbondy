"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatEUR, formatDate } from "@/lib/format";
import StatusBadge from "@/components/StatusBadge";
import { useAuth } from "@/context/AuthContext";

interface DashboardData {
  counts: { enAttente: number; relanceEnvoyee: number; paye: number; annule: number };
  amounts: { total: number; paye: number; du: number };
  recent: any[];
  total: number;
}

export default function DashboardPage() {
  const { can } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/dashboard");
    const json = await res.json();
    setData(json);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function relancerToutes() {
    setSending(true);
    setMessage("");
    try {
      const res = await fetch("/api/reminders/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const json = await res.json();
      const ok = json.results?.filter((r: any) => r.ok).length || 0;
      const total = json.results?.length || 0;
      setMessage(`${ok} / ${total} relance(s) envoyée(s).`);
      await load();
    } catch (e: any) {
      setMessage("Erreur lors des relances.");
    } finally {
      setSending(false);
    }
  }

  if (loading || !data) return <p className="text-gray-500">Chargement…</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-serif font-bold text-ink">Tableau de bord</h1>
        {can("envoyer_relances") && data.counts.enAttente > 0 && (
          <button onClick={relancerToutes} disabled={sending} className="btn-gold">
            {sending ? "Envoi…" : `Relancer les ${data.counts.enAttente} en attente`}
          </button>
        )}
      </div>
      {message && <p className="text-sm text-gray-600">{message}</p>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total promis" value={formatEUR(data.amounts.total)} />
        <StatCard label="Total encaissé" value={formatEUR(data.amounts.paye)} accent="text-green-700" />
        <StatCard label="Reste dû" value={formatEUR(data.amounts.du)} accent="text-amber-700" />
        <StatCard label="Promesses" value={String(data.total)} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MiniStat label="En attente" value={data.counts.enAttente} />
        <MiniStat label="Relance envoyée" value={data.counts.relanceEnvoyee} />
        <MiniStat label="Payées" value={data.counts.paye} />
        <MiniStat label="Annulées" value={data.counts.annule} />
      </div>

      <div className="card">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold text-ink">Promesses récentes</h2>
          {can("saisir_promesses") && (
            <Link href="/pledges" className="text-sm text-gold hover:underline">
              Voir tout →
            </Link>
          )}
        </div>
        <div className="divide-y">
          {data.recent.length === 0 && <p className="p-4 text-sm text-gray-500">Aucune promesse enregistrée pour l'instant.</p>}
          {data.recent.map((p) => (
            <Link
              key={p.id}
              href={`/donors/${p.donorId}`}
              className="flex items-center justify-between p-4 hover:bg-gray-50 text-sm"
            >
              <div>
                <p className="font-medium text-ink">{p.donorName}</p>
                <p className="text-gray-500">
                  {p.catalogItemName} · {p.serviceLabel} · {formatDate(p.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-semibold">{formatEUR(p.amount)}</span>
                <StatusBadge status={p.status} />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${accent || "text-ink"}`}>{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-4 text-center">
      <p className="text-xl font-bold text-ink">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}
