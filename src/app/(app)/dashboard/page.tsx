"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatEUR, formatDate, METHOD_LABELS } from "@/lib/format";
import StatusBadge from "@/components/StatusBadge";
import { useAuth } from "@/context/AuthContext";

interface DashboardData {
  counts: { enAttente: number; relanceEnvoyee: number; partiel: number; paye: number; annule: number };
  amounts: { total: number; paye: number; du: number };
  recent: any[];
  topDebtors: { donorId: string; donorName: string; due: number }[];
  cash: null | {
    months: { month: string; amount: number }[];
    byMethod: Record<string, number>;
    thisMonth: number;
    thisYear: number;
  };
  total: number;
}

const MONTHS_FR = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-serif font-bold text-ink">Tableau de bord</h1>
        {can("envoyer_relances") && data.counts.enAttente + data.counts.partiel > 0 && (
          <button onClick={relancerToutes} disabled={sending} className="btn-gold">
            {sending ? "Envoi…" : `Relancer les ${data.counts.enAttente + data.counts.partiel} en attente`}
          </button>
        )}
      </div>
      {message && <p className="text-sm text-gray-600">{message}</p>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total promis" value={formatEUR(data.amounts.total)} />
        <StatCard label="Total réglé" value={formatEUR(data.amounts.paye)} accent="text-green-700" />
        <StatCard label="Reste dû" value={formatEUR(data.amounts.du)} accent="text-amber-700" />
        <StatCard label="Promesses" value={String(data.total)} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <MiniStat label="En attente" value={data.counts.enAttente} />
        <MiniStat label="Relance envoyée" value={data.counts.relanceEnvoyee} />
        <MiniStat label="Partielles" value={data.counts.partiel} />
        <MiniStat label="Payées" value={data.counts.paye} />
        <MiniStat label="Annulées" value={data.counts.annule} />
      </div>

      {data.cash && <CashPanel cash={data.cash} />}

      {data.topDebtors.length > 0 && (
        <div className="card">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-ink">Plus gros soldes dus</h2>
          </div>
          <div className="divide-y">
            {data.topDebtors.map((d) => (
              <Link key={d.donorId} href={`/donors/${d.donorId}`} className="flex items-center justify-between gap-3 p-3 px-4 hover:bg-gray-50 text-sm">
                <span className="text-ink truncate">{d.donorName}</span>
                <span className="font-semibold text-amber-700 shrink-0">{formatEUR(d.due)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <div className="p-4 border-b flex flex-wrap items-center justify-between gap-2">
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
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-4 hover:bg-gray-50 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium text-ink">{p.donorName}</p>
                <p className="text-gray-500">
                  {p.catalogItemName} · {p.serviceLabel} · {formatDate(p.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
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

function CashPanel({ cash }: { cash: NonNullable<DashboardData["cash"]> }) {
  const max = Math.max(1, ...cash.months.map((m) => m.amount));
  const methods = Object.entries(cash.byMethod).sort((a, b) => b[1] - a[1]);
  return (
    <div className="card p-4 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2">
        <h2 className="font-semibold text-ink">Encaissements</h2>
        <p className="text-sm text-gray-500">
          Ce mois : <span className="font-semibold text-green-700">{formatEUR(cash.thisMonth)}</span> · Cette année :{" "}
          <span className="font-semibold text-green-700">{formatEUR(cash.thisYear)}</span>
        </p>
      </div>
      <div className="flex items-end gap-1 h-32" role="img" aria-label="Encaissements des 12 derniers mois">
        {cash.months.map((m) => {
          const monthIdx = Number(m.month.slice(5, 7)) - 1;
          return (
            <div key={m.month} className="flex-1 flex flex-col items-center justify-end h-full min-w-0" title={`${MONTHS_FR[monthIdx]} : ${formatEUR(m.amount)}`}>
              <div className="w-full bg-gold/80 rounded-t" style={{ height: `${(m.amount / max) * 100}%`, minHeight: m.amount > 0 ? 2 : 0 }} />
              <span className="text-[10px] text-gray-500 mt-1 truncate">{MONTHS_FR[monthIdx]}</span>
            </div>
          );
        })}
      </div>
      {methods.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
          {methods.map(([k, v]) => (
            <span key={k}>
              {METHOD_LABELS[k] || k} : <span className="font-medium text-ink">{formatEUR(v)}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
