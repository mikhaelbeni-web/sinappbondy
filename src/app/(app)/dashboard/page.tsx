"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BellRing, ChevronRight, HandCoins, Inbox, UserCheck } from "lucide-react";
import { formatEUR, formatDate } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";

interface DashboardData {
  counts: { enAttente: number; relanceEnvoyee: number; partiel: number; paye: number; annule: number };
  amounts: { total: number; paye: number; du: number };
  movements: { kind: string; date: string; name: string; donorId: string; detail: string }[];
  registrations: number | null;
  donorsToRemind: number;
  cash: null | {
    months: { month: string; amount: number; promised: number }[];
    byMethod: Record<string, number>;
    thisMonth: number;
    thisYear: number;
    unallocated: number;
  };
  total: number;
}

const MONTHS_FR = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

function compactEUR(n: number) {
  if (n >= 10000) return `${(n / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 2 })}k €`;
  return formatEUR(n);
}

function initials(name: string) {
  return (name || "?")
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function DashboardPage() {
  const { can } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    const res = await fetch("/api/dashboard");
    setData(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function relancerToutes() {
    if (!confirm("Envoyer une relance à toutes les promesses en attente ?")) return;
    setSending(true);
    setMessage("");
    try {
      const res = await fetch("/api/reminders/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const json = await res.json();
      const ok = json.results?.filter((r: any) => r.ok).length || 0;
      setMessage(`${ok} / ${json.results?.length || 0} relance(s) envoyée(s).`);
      await load();
    } catch {
      setMessage("Erreur lors des relances.");
    } finally {
      setSending(false);
    }
  }

  if (!data) return <p className="text-gray-500">Chargement…</p>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Tableau de bord</h1>
        <p className="page-subtitle">Vue d'ensemble de l'activité</p>
      </div>
      {message && <p className="text-sm text-gray-600">{message}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="card p-4 lg:col-span-2">
          <p className="card-header">Trésorerie</p>
          {data.cash ? <TreasuryChart months={data.cash.months} /> : <SummaryFallback data={data} />}
        </div>

        <div className="card p-4 flex flex-col">
          <div className="flex items-center justify-between px-1 pb-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-ink">Derniers mouvements</p>
            <span className="grid place-items-center min-w-5 h-5 px-1.5 rounded-full bg-gold-light text-[10px] font-bold text-gold-dark">
              {data.movements.length}
            </span>
          </div>
          <div className="flex-1 divide-y divide-gray-100">
            {data.movements.length === 0 && <p className="py-6 text-sm text-gray-500 text-center">Aucun mouvement pour l'instant.</p>}
            {data.movements.map((m, i) => (
              <Link key={i} href={`/donors/${m.donorId}`} className="flex items-start gap-3 py-3 px-1 hover:bg-cream/60 rounded-lg">
                <span
                  className={`grid place-items-center w-8 h-8 rounded-full text-[10px] font-bold shrink-0 ${
                    m.kind === "paiement" ? "bg-ink-light/15 text-ink-light" : "bg-gold-light text-gold-dark"
                  }`}
                >
                  {initials(m.name)}
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-ink truncate">{m.name}</span>
                  <span className="block text-[11px] text-gray-500 truncate">
                    {m.detail} · {formatDate(m.date)}
                  </span>
                </span>
              </Link>
            ))}
          </div>
          {can("saisir_promesses") && (
            <Link href="/pledges" className="mt-2 pt-3 [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:pt-0 border-t border-gray-100 flex items-center justify-center gap-1 text-xs font-semibold text-ink hover:underline">
              Voir tout l'historique <ChevronRight size={14} />
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {data.cash && (
          <KpiCard
            icon={<Inbox size={18} />}
            tone="blue"
            label="Attente d'affectation"
            value={formatEUR(data.cash.unallocated)}
            valueClass="text-amber-600"
            action="Traiter"
            href="/payments"
          />
        )}
        <KpiCard
          icon={<BellRing size={18} />}
          tone="red"
          label="Donateurs à relancer"
          value={String(data.donorsToRemind)}
          valueClass="text-red-600"
          action={sending ? "Envoi…" : "Relancer"}
          onClick={can("envoyer_relances") && data.donorsToRemind > 0 ? relancerToutes : undefined}
          href={can("envoyer_relances") ? undefined : "/pledges"}
        />
        <KpiCard
          icon={<HandCoins size={18} />}
          tone="yellow"
          label="Promesses en attente"
          value={compactEUR(data.amounts.du)}
          valueClass="text-ink"
          action="Gérer"
          href="/pledges"
        />
        {data.registrations !== null ? (
          <KpiCard icon={<UserCheck size={18} />} tone="dark" label="Inscriptions" value={String(data.registrations)} action="Consulter" href="/events" />
        ) : (
          <KpiCard icon={<UserCheck size={18} />} tone="dark" label="Promesses réglées" value={String(data.counts.paye)} action="Consulter" href="/pledges" />
        )}
      </div>
    </div>
  );
}

const TONES: Record<string, string> = {
  blue: "bg-ink-light/10 text-ink-light",
  red: "bg-red-50 text-red-500",
  yellow: "bg-amber-50 text-amber-500",
  dark: "bg-white/10 text-white",
};

function KpiCard({
  icon,
  tone,
  label,
  value,
  valueClass,
  action,
  href,
  onClick,
}: {
  icon: React.ReactNode;
  tone: string;
  label: string;
  value: string;
  valueClass?: string;
  action: string;
  href?: string;
  onClick?: () => void;
}) {
  const dark = tone === "dark";
  const cta = (
    <span className={`flex items-center gap-1 text-xs font-semibold ${dark ? "text-white" : "text-gold"}`}>
      {action} <ArrowRight size={14} />
    </span>
  );
  return (
    <div className={`rounded-2xl p-5 flex flex-col justify-between min-h-[120px] ${dark ? "bg-gradient-to-br from-ink-dark to-ink text-white shadow-soft" : "card"}`}>
      <div className="flex items-start gap-3">
        <span className={`grid place-items-center w-9 h-9 rounded-lg shrink-0 ${TONES[tone]}`}>{icon}</span>
        <div className="min-w-0">
          <p className={`text-[10px] font-bold uppercase tracking-wider ${dark ? "text-white/80" : "text-gray-600"}`}>{label}</p>
          <p className={`text-xl font-bold mt-0.5 ${dark ? "text-white" : valueClass || "text-ink"}`}>{value}</p>
        </div>
      </div>
      <div className="flex justify-end mt-3">
        {onClick ? (
          <button onClick={onClick} className="tap justify-end">{cta}</button>
        ) : href ? (
          <Link href={href} className="tap justify-end">{cta}</Link>
        ) : null}
      </div>
    </div>
  );
}

// Histogramme : promis (doré) et encaissé (bleu) sur les 12 derniers mois.
function TreasuryChart({ months }: { months: { month: string; amount: number; promised: number }[] }) {
  const max = Math.max(1, ...months.map((m) => Math.max(m.amount, m.promised)));
  const step = niceStep(max / 5);
  const top = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step).reverse();
  return (
    <div className="mt-4">
      <div className="flex items-center gap-4 text-[11px] text-gray-500 mb-3 px-1">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-gold-sand" /> Promis</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-ink" /> Encaissé</span>
      </div>
      <div className="flex gap-2 h-64">
        <div className="flex flex-col justify-between text-[10px] text-gray-400 text-right w-12 shrink-0 pb-5">
          {ticks.map((t) => (
            <span key={t}>{t.toLocaleString("fr-FR")}</span>
          ))}
        </div>
        <div className="flex-1 flex items-stretch gap-1 sm:gap-2 min-w-0">
          {months.map((m, i) => {
            const idx = Number(m.month.slice(5, 7)) - 1;
            return (
              <div key={m.month} className="flex-1 flex flex-col min-w-0">
                <div className={`flex-1 flex items-end justify-center gap-0.5 sm:gap-1 rounded-t-md ${i % 2 === 0 ? "bg-gray-100/70" : ""}`}>
                  <div
                    className="w-1/3 max-w-[18px] rounded-t-md bg-gradient-to-t from-gold-light to-gold-sand"
                    style={{ height: `${(m.promised / top) * 100}%` }}
                    title={`${MONTHS_FR[idx]} · promis ${formatEUR(m.promised)}`}
                  />
                  <div
                    className="w-1/3 max-w-[18px] rounded-t-md bg-gradient-to-t from-ink-light/30 to-ink"
                    style={{ height: `${(m.amount / top) * 100}%` }}
                    title={`${MONTHS_FR[idx]} · encaissé ${formatEUR(m.amount)}`}
                  />
                </div>
                <span className="text-[10px] text-gray-400 text-center mt-1.5 truncate">
                  <span className="sm:hidden">{MONTHS_FR[idx].slice(0, 1).toUpperCase()}</span>
                  <span className="hidden sm:inline">{MONTHS_FR[idx]}</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function niceStep(raw: number) {
  const pow = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1))));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

function SummaryFallback({ data }: { data: DashboardData }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
      {[
        ["Total promis", formatEUR(data.amounts.total), "text-ink"],
        ["Total réglé", formatEUR(data.amounts.paye), "text-green-700"],
        ["Reste dû", formatEUR(data.amounts.du), "text-amber-600"],
      ].map(([l, v, c]) => (
        <div key={l} className="rounded-xl bg-cream/70 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{l}</p>
          <p className={`text-xl font-bold mt-1 ${c}`}>{v}</p>
        </div>
      ))}
    </div>
  );
}
