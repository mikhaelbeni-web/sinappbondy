"use client";

import { useState } from "react";

// Formulaire de don public (page générale ou campagne).
export default function DonateForm({ campaign, suggested }: { campaign?: string; suggested?: number[] }) {
  const amounts = suggested?.length ? suggested : [18, 36, 54, 100, 180];
  const [amount, setAmount] = useState<string>(String(amounts[1] ?? amounts[0]));
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", address: "", postalCode: "", city: "" });
  const [wantReceipt, setWantReceipt] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/public/donate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(amount),
          campaign,
          ...form,
          ...(wantReceipt ? {} : { address: "", postalCode: "", city: "" }),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      window.location.href = data.url;
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }

  const n = Number(amount) || 0;

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div>
        <label className="label">Montant</label>
        <div className="flex flex-wrap gap-2">
          {amounts.map((a) => (
            <button
              type="button"
              key={a}
              onClick={() => setAmount(String(a))}
              className={Number(amount) === a ? "chip-active" : "chip hover:bg-cream"}
            >
              {a} €
            </button>
          ))}
          <input
            type="number"
            min="1"
            step="1"
            className="input basis-full"
            placeholder="Autre"
            value={amounts.includes(Number(amount)) ? "" : amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        {wantReceipt && n > 0 && (
          <p className="text-xs text-gray-500 mt-2">
            Après réduction d'impôt de 66 %, ce don vous revient à {(n * 0.34).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Prénom</label>
          <input required className="input" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
        </div>
        <div>
          <label className="label">Nom</label>
          <input required className="input" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">E-mail</label>
          <input required type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
      </div>

      <label className="tap flex items-center gap-2 text-sm">
        <input type="checkbox" checked={wantReceipt} onChange={(e) => setWantReceipt(e.target.checked)} />
        Je souhaite recevoir un reçu fiscal
      </label>

      {wantReceipt && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-3">
            <label className="label">Adresse postale</label>
            <input required className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div>
            <label className="label">Code postal</label>
            <input required className="input" value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Ville</label>
            <input required className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </div>
        </div>
      )}

      <button type="submit" disabled={loading || n < 1} className="btn-gold w-full py-3 text-base">
        {loading ? "Redirection vers le paiement…" : `Donner ${n > 0 ? n.toLocaleString("fr-FR") + " €" : ""}`}
      </button>
      <p className="text-xs text-gray-400 text-center">Paiement sécurisé par carte bancaire (HelloAsso).</p>
    </form>
  );
}
