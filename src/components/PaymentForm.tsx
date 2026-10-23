"use client";

import { useMemo, useState } from "react";
import { formatEUR, METHOD_LABELS, remainingOf, todayISO } from "@/lib/format";
import { filterByQuery } from "@/lib/search";
import Combobox from "@/components/Combobox";

interface Donor { id: string; firstName: string; lastName: string; }

// Saisie d'un encaissement (chèque, espèces, virement, CB). Sans promesse
// choisie, le montant est affecté aux promesses ouvertes les plus anciennes.
export default function PaymentForm({
  donors,
  fixedDonorId,
  pledges,
  onSaved,
}: {
  donors?: Donor[];
  fixedDonorId?: string;
  pledges?: any[]; // promesses du fidèle (fiche fidèle)
  onSaved: (info?: { receiptNumber?: string }) => void;
}) {
  const [donorId, setDonorId] = useState(fixedDonorId || "");
  const [donorQuery, setDonorQuery] = useState("");
  const [pledgeId, setPledgeId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cheque");
  const [reference, setReference] = useState("");
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const openPledges = (pledges || []).filter((p) => remainingOf(p) > 0);
  const totalDue = openPledges.reduce((s, p) => s + remainingOf(p), 0);

  const matches = useMemo(() => {
    if (!donors || !donorQuery) return [];
    return filterByQuery(donors, donorQuery, (d) => `${d.firstName} ${d.lastName}`).slice(0, 8);
  }, [donors, donorQuery]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!donorId || !amount || Number(amount) <= 0) {
      setError("Fidèle et montant sont requis.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ donorId, pledgeId: pledgeId || null, amount: Number(amount), method, reference, date, notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAmount("");
      setReference("");
      setNotes("");
      setPledgeId("");
      onSaved({ receiptNumber: data.receipt?.number });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!fixedDonorId && (
        <div className="relative">
          <label className="label">Fidèle</label>
          <input
            className="input"
            placeholder="Rechercher un fidèle par nom…"
            value={donorQuery}
            onChange={(e) => {
              setDonorQuery(e.target.value);
              setDonorId("");
            }}
          />
          {donorQuery && !donorId && (
            <div className="absolute z-10 bg-white border border-gray-200 rounded-md shadow-md w-full mt-1 max-h-56 overflow-auto">
              {matches.map((d) => (
                <button
                  type="button"
                  key={d.id}
                  className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                  onClick={() => {
                    setDonorId(d.id);
                    setDonorQuery(`${d.firstName} ${d.lastName}`);
                  }}
                >
                  {d.firstName} {d.lastName}
                </button>
              ))}
              {matches.length === 0 && <p className="px-3 py-2 text-sm text-gray-400">Aucun résultat.</p>}
            </div>
          )}
        </div>
      )}

      {pledges && (
        <div>
          <label className="label">Affecter à</label>
          <Combobox
            value={pledgeId}
            onChange={(id) => {
              setPledgeId(id);
              const p = openPledges.find((x) => x.id === id);
              if (p) setAmount(String(remainingOf(p)));
            }}
            placeholder={`Promesses les plus anciennes d'abord (${formatEUR(totalDue)} dû)`}
            emptyLabel={`Promesses les plus anciennes d'abord (${formatEUR(totalDue)} dû)`}
            options={openPledges.map((p) => ({
              value: p.id,
              label: `${p.catalogItemName} · ${p.serviceLabel}`,
              hint: `reste ${formatEUR(remainingOf(p))}`,
            }))}
          />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Montant (€)</label>
          <div className="flex gap-2">
            <input required type="number" min="0.01" step="0.01" className="input" value={amount} onChange={(e) => setAmount(e.target.value)} />
            {pledges && !pledgeId && totalDue > 0 && (
              <button type="button" className="btn-secondary text-xs whitespace-nowrap" onClick={() => setAmount(String(totalDue))}>
                Tout le solde
              </button>
            )}
          </div>
        </div>
        <div>
          <label className="label">Mode</label>
          <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
            {Object.entries(METHOD_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">{method === "cheque" ? "N° de chèque / banque" : "Référence"}</label>
          <input className="input" value={reference} onChange={(e) => setReference(e.target.value)} />
        </div>
        <div>
          <label className="label">Date d'encaissement</label>
          <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      <div>
        <label className="label">Notes (facultatif)</label>
        <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <button type="submit" disabled={saving} className="btn-gold">
        {saving ? "Enregistrement…" : "Enregistrer le paiement"}
      </button>
    </form>
  );
}
