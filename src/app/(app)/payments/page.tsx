"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatEUR, formatDate, METHOD_LABELS } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";
import PaymentForm from "@/components/PaymentForm";

interface Donor { id: string; firstName: string; lastName: string; }

export default function PaymentsPage() {
  const { can } = useAuth();
  const [payments, setPayments] = useState<any[]>([]);
  const [donors, setDonors] = useState<Donor[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(`${new Date().getFullYear()}-01-01`);
  const [to, setTo] = useState("");
  const [method, setMethod] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const qs = new URLSearchParams();
    if (from) qs.set("from", from);
    if (to) qs.set("to", to);
    const [pRes, dRes] = await Promise.all([fetch(`/api/transactions?${qs}`), fetch("/api/donors")]);
    const [p, d] = await Promise.all([pRes.json(), dRes.json()]);
    setPayments(p.payments || []);
    setDonors(d.donors || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  const visible = method ? payments.filter((p) => p.method === method) : payments;

  const totals = useMemo(() => {
    const byMethod: Record<string, number> = {};
    let total = 0;
    for (const p of visible) {
      total += p.amount;
      byMethod[p.method] = (byMethod[p.method] || 0) + p.amount;
    }
    return { total, byMethod };
  }, [visible]);

  async function remove(id: string) {
    if (!confirm("Supprimer cet encaissement ? Les promesses concernées redeviendront dues.")) return;
    setError("");
    const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) setError(data.error);
    await load();
  }

  if (!can("gerer_paiements")) {
    return <p className="text-gray-500">Vous n'avez pas accès aux encaissements.</p>;
  }

  const exportQs = new URLSearchParams();
  if (from) exportQs.set("from", from);
  if (to) exportQs.set("to", to);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-serif font-bold text-ink">Encaissements</h1>
        <div className="flex flex-wrap gap-2">
          {can("voir_tout") && (
            <a href={`/api/export/encaissements?${exportQs}`} className="btn-secondary">
              Exporter (CSV)
            </a>
          )}
          <button onClick={() => setShowForm((v) => !v)} className="btn-gold">
            {showForm ? "Fermer" : "Enregistrer un paiement"}
          </button>
        </div>
      </div>

      {showForm && (
        <div className="card p-4">
          <PaymentForm
            donors={donors}
            onSaved={() => {
              setShowForm(false);
              load();
            }}
          />
        </div>
      )}

      <div className="card p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="label">Du</label>
          <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className="label">Au</label>
          <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div>
          <label className="label">Mode</label>
          <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="">Tous les modes</option>
            {Object.entries(METHOD_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="card p-4 col-span-2 md:col-span-1">
          <p className="text-xs text-gray-500 uppercase">Total</p>
          <p className="text-xl font-bold text-green-700">{formatEUR(totals.total)}</p>
        </div>
        {Object.entries(METHOD_LABELS).map(([k, v]) => (
          <div key={k} className="card p-4">
            <p className="text-xs text-gray-500 uppercase">{v}</p>
            <p className="text-lg font-semibold text-ink">{formatEUR(totals.byMethod[k] || 0)}</p>
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="card divide-y">
        {loading && <p className="p-4 text-sm text-gray-500">Chargement…</p>}
        {!loading && visible.length === 0 && <p className="p-4 text-sm text-gray-500">Aucun encaissement sur cette période.</p>}
        {visible.map((p) => (
          <div key={p.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm">
            <div className="min-w-0">
              <Link href={`/donors/${p.donorId}`} className="font-medium text-ink hover:underline">
                {p.donorName}
              </Link>
              <p className="text-gray-500">
                {formatDate(p.date)} · {METHOD_LABELS[p.method] || p.method}
                {p.reference && ` · ${p.reference}`} · saisi par {p.createdByName}
              </p>
              {p.unallocated > 0 && (
                <p className="text-purple-700 text-xs">Dont {formatEUR(p.unallocated)} non affecté (avoir)</p>
              )}
              {p.notes && <p className="text-gray-400 italic">{p.notes}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <span className="font-semibold text-green-700">{formatEUR(p.amount)}</span>
              <button onClick={() => remove(p.id)} className="text-xs text-red-600 hover:underline">
                Supprimer
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
