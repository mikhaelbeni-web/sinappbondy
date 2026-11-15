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
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div>
        <p className="label" id="don-montant">Montant</p>
        <div className="flex flex-wrap gap-2" role="group" aria-labelledby="don-montant">
          {amounts.map((a) => (
            <button
              type="button"
              key={a}
              onClick={() => setAmount(String(a))}
              aria-pressed={Number(amount) === a}
              className={Number(amount) === a ? "chip-active" : "chip hover:bg-cream"}
            >
              {a} €
            </button>
          ))}
          <input
            type="number"
            inputMode="numeric"
            min="1"
            step="1"
            aria-label="Autre montant en euros"
            className="input basis-full"
            placeholder="Autre montant (€)"
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
          <label htmlFor="don-firstName" className="label">Prénom</label>
          <input id="don-firstName" autoComplete="given-name" required className="input" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
        </div>
        <div>
          <label htmlFor="don-lastName" className="label">Nom</label>
          <input id="don-lastName" autoComplete="family-name" required className="input" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="don-email" className="label">E-mail</label>
          <input id="don-email" autoComplete="email" required type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </div>
      </div>

      <label className="tap flex items-center gap-2 text-sm">
        <input type="checkbox" checked={wantReceipt} onChange={(e) => setWantReceipt(e.target.checked)} />
        Je souhaite recevoir un reçu fiscal
      </label>

      {wantReceipt && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-3">
            <label htmlFor="don-address" className="label">Adresse postale</label>
            <input id="don-address" autoComplete="street-address" required className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div>
            <label htmlFor="don-postalCode" className="label">Code postal</label>
            <input id="don-postalCode" autoComplete="postal-code" inputMode="numeric" required className="input" value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="don-city" className="label">Ville</label>
            <input id="don-city" autoComplete="address-level2" required className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
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
