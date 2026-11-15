"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";

// Demande de réservation des salons : date, type d'événement, invités,
// coordonnées. La date n'est réservée qu'après confirmation de l'équipe.
export default function SalonRequestForm() {
  const [data, setData] = useState<{ enabled: boolean; intro: string; capacity: string; eventTypes: string[]; booked: string[] } | null>(null);
  const [form, setForm] = useState({ date: "", eventType: "", guests: "", name: "", email: "", phone: "", message: "", website: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  useEffect(() => {
    fetch("/api/public/salons", { cache: "no-store" })
      .then((r) => r.json())
      .then(setData)
      .catch(() => setError("Chargement impossible. Réessayez dans un instant."));
  }, []);

  if (!data) return <p className="card p-5 text-sm text-gray-600" role={error ? "alert" : "status"}>{error || "Chargement…"}</p>;
  if (!data.enabled) return <p className="card p-5 text-sm text-gray-600">Les demandes en ligne sont fermées pour le moment. Contactez le secrétariat.</p>;
  if (done) {
    return (
      <div className="card p-6 space-y-2" role="status">
        <p className="flex items-center gap-2 text-lg font-bold text-ink">
          <Check className="w-5 h-5 text-green-700" aria-hidden /> Demande envoyée
        </p>
        <p className="text-sm text-gray-700">Votre demande pour le {done} est bien enregistrée. La date n'est pas encore réservée : le secrétariat vous recontacte pour la confirmer.</p>
      </div>
    );
  }

  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const dateTaken = !!form.date && data.booked.includes(form.date);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (dateTaken) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/public/salons", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(d.error || "Envoi impossible. Réessayez.");
    setDone(d.day || form.date);
  }

  return (
    <form onSubmit={submit} className="card p-5 space-y-4">
      <p className="text-sm text-gray-700 leading-relaxed">{data.intro}</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="label" htmlFor="sl-date">Date souhaitée</label>
          <input id="sl-date" type="date" required min={tomorrow} className="input" value={form.date} onChange={set("date")} aria-describedby={dateTaken ? "sl-date-err" : undefined} aria-invalid={dateTaken} />
          {dateTaken && <p id="sl-date-err" role="alert" className="text-xs text-red-600 mt-1">Les salons sont déjà réservés ce jour-là.</p>}
        </div>
        <div>
          <label className="label" htmlFor="sl-type">Événement</label>
          <select id="sl-type" required className="input" value={form.eventType} onChange={set("eventType")}>
            <option value="">Choisir…</option>
            {data.eventTypes.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="sl-guests">Nombre d'invités</label>
          <input id="sl-guests" type="number" inputMode="numeric" min={1} max={1000} required className="input" value={form.guests} onChange={set("guests")} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="label" htmlFor="sl-name">Nom et prénom</label>
          <input id="sl-name" required autoComplete="name" className="input" value={form.name} onChange={set("name")} />
        </div>
        <div>
          <label className="label" htmlFor="sl-email">E-mail</label>
          <input id="sl-email" type="email" required autoComplete="email" className="input" value={form.email} onChange={set("email")} />
        </div>
        <div>
          <label className="label" htmlFor="sl-phone">Téléphone</label>
          <input id="sl-phone" type="tel" required autoComplete="tel" className="input" value={form.phone} onChange={set("phone")} />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="sl-message">Précisions (facultatif)</label>
        <textarea id="sl-message" rows={3} maxLength={1000} className="input" value={form.message} onChange={set("message")} placeholder="Horaires, traiteur, besoins particuliers…" />
      </div>
      {/* Champ piège pour les robots, invisible et hors tabulation. */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" value={form.website} onChange={set("website")} />
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button type="submit" className="btn-primary px-6 py-3" disabled={busy || dateTaken}>
        {busy ? "Envoi…" : "Envoyer ma demande"}
      </button>
    </form>
  );
}
