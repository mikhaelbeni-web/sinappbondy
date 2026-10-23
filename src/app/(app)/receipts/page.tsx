"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatEUR, formatDate } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";

interface Pending {
  donorId: string;
  donorName: string;
  amount: number;
  paymentIds: string[];
  hasAddress: boolean;
  hasEmail: boolean;
}

export default function ReceiptsPage() {
  const { can } = useAuth();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [missing, setMissing] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [send, setSend] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/receipts?year=${year}`);
    const data = await res.json();
    setReceipts(data.receipts || []);
    setPending(data.pending || []);
    setMissing(data.missing || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  async function emit(donorId?: string) {
    setBusy(donorId || "all");
    setMessage("");
    try {
      const res = await fetch("/api/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ donorId, year, send }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const ok = data.results.filter((r: any) => r.ok);
      const ko = data.results.filter((r: any) => !r.ok);
      const mailed = ok.filter((r: any) => r.emailed).length;
      let msg = `${ok.length} reçu(s) émis${send ? `, ${mailed} envoyé(s) par e-mail` : ""}.`;
      if (ko.length) msg += ` Non émis : ${ko.map((r: any) => `${r.donorName} (${r.error})`).join(", ")}.`;
      setMessage(msg);
      await load();
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setBusy(null);
    }
  }

  async function resend(id: string) {
    setBusy(id);
    setMessage("");
    const res = await fetch(`/api/receipts/${id}/send`, { method: "POST" });
    const data = await res.json();
    setMessage(res.ok ? "Reçu renvoyé par e-mail." : data.error);
    setBusy(null);
    await load();
  }

  async function cancel(id: string, number: string) {
    if (!confirm(`Annuler le reçu ${number} ? Le numéro ne sera pas réutilisé et les paiements pourront figurer sur un nouveau reçu.`)) return;
    setBusy(id);
    const res = await fetch(`/api/receipts/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) setMessage(data.error);
    setBusy(null);
    await load();
  }

  if (!can("gerer_paiements")) return <p className="text-gray-500">Vous n'avez pas accès aux reçus fiscaux.</p>;

  const active = receipts.filter((r) => !r.cancelled);
  const totalReceipted = active.reduce((s, r) => s + r.amount, 0);
  const totalPending = pending.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-serif font-bold text-ink">Reçus fiscaux</h1>
        <select className="input w-full sm:w-32" value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {missing.length > 0 && (
        <div className="card p-4 border-amber-300 bg-amber-50 text-sm">
          <p className="font-medium text-amber-800">Les reçus fiscaux s'activeront dès que la fiche de l'association sera complète.</p>
          <p className="text-amber-700 mt-1">À renseigner : {missing.join(", ")}.</p>
          <Link href="/admin" className="text-gold hover:underline mt-2 inline-block tap">
            Compléter dans Administration → Association
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="card p-4">
          <p className="text-xs text-gray-500 uppercase">Reçus émis {year}</p>
          <p className="text-xl font-bold text-ink">{active.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 uppercase">Montant couvert</p>
          <p className="text-xl font-bold text-green-700">{formatEUR(totalReceipted)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 uppercase">Encaissé sans reçu</p>
          <p className="text-xl font-bold text-amber-700">{formatEUR(totalPending)}</p>
        </div>
      </div>

      {message && <p className="text-sm text-gray-600">{message}</p>}

      {pending.length > 0 && (
        <div className="card">
          <div className="p-4 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="font-semibold text-ink">Paiements {year} sans reçu</h2>
              <p className="text-xs text-gray-500">Un reçu récapitulatif regroupe tous les paiements de l'année d'un fidèle.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="tap flex items-center gap-2 text-sm">
                <input type="checkbox" checked={send} onChange={(e) => setSend(e.target.checked)} />
                Envoyer par e-mail
              </label>
              <button className="btn-gold" disabled={!!busy || missing.length > 0} onClick={() => emit()}>
                {busy === "all" ? "Émission…" : "Émettre tous les récapitulatifs"}
              </button>
            </div>
          </div>
          <div className="divide-y">
            {pending.map((p) => (
              <div key={p.donorId} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <Link href={`/donors/${p.donorId}`} className="font-medium text-ink hover:underline tap">
                    {p.donorName}
                  </Link>
                  <p className="text-gray-500">
                    {p.paymentIds.length} paiement(s)
                    {!p.hasAddress && <span className="text-red-600"> · adresse manquante</span>}
                    {!p.hasEmail && <span className="text-amber-700"> · pas d'e-mail</span>}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 shrink-0">
                  <span className="font-semibold">{formatEUR(p.amount)}</span>
                  <button
                    className="btn-secondary text-xs px-2 py-1"
                    disabled={!!busy || !p.hasAddress || missing.length > 0}
                    onClick={() => emit(p.donorId)}
                  >
                    {busy === p.donorId ? "Émission…" : "Émettre"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-ink">Reçus émis</h2>
        </div>
        <div className="divide-y">
          {loading && <p className="p-4 text-sm text-gray-500">Chargement…</p>}
          {!loading && receipts.length === 0 && <p className="p-4 text-sm text-gray-500">Aucun reçu pour {year}.</p>}
          {receipts.map((r) => (
            <div key={r.id} className={`p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm ${r.cancelled ? "opacity-60" : ""}`}>
              <div className="min-w-0">
                <p className="font-medium text-ink">
                  N° {r.number} · {r.donor.name}
                  {r.cancelled && <span className="ml-2 text-xs text-red-600">annulé</span>}
                </p>
                <p className="text-gray-500">
                  {r.kind === "annuel" ? `Récapitulatif ${r.year}` : "Reçu unitaire"} · émis le {formatDate(r.issuedAt)}
                  {r.emailedAt ? ` · envoyé le ${formatDate(r.emailedAt)}` : " · non envoyé"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <span className="font-semibold">{formatEUR(r.amount)}</span>
                <a href={`/api/receipts/${r.id}/pdf`} target="_blank" rel="noreferrer" className="text-gold text-xs hover:underline tap">
                  PDF
                </a>
                {!r.cancelled && (
                  <>
                    <button className="text-xs text-ink hover:underline tap" disabled={!!busy} onClick={() => resend(r.id)}>
                      {busy === r.id ? "Envoi…" : "Envoyer"}
                    </button>
                    <button className="text-xs text-red-600 hover:underline tap" disabled={!!busy} onClick={() => cancel(r.id, r.number)}>
                      Annuler
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
