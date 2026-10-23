"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { formatEUR } from "@/lib/format";
import PublicPage from "@/components/PublicPage";

function formatDateTime(date: string) {
  return new Date(`${date}:00`).toLocaleString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Page publique d'inscription à un événement (lien ou QR code).
export default function EventPage() {
  const { slug } = useParams<{ slug: string }>();
  const [event, setEvent] = useState<any>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", qty: 1 });
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    fetch(`/api/public/events/${slug}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setEvent(d.event);
      })
      .catch((e) => setError(e.message));
  }, [slug]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError("");
    try {
      const res = await fetch(`/api/public/events/${slug}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      window.location.href = data.url || data.ticketUrl;
    } catch (err: any) {
      setFormError(err.message);
      setBusy(false);
    }
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream px-4">
        <div className="card p-8 max-w-md text-center">
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }
  if (!event) return <div className="min-h-screen flex items-center justify-center bg-cream text-gray-500">Chargement…</div>;

  const full = event.remaining === 0;
  const maxQty = Math.min(20, event.remaining ?? 20);

  return (
    <PublicPage
      title={event.title}
      subtitle={
        <>
          <span className="block first-letter:uppercase">{formatDateTime(event.date)}</span>
          {event.location && <span className="block">{event.location}</span>}
        </>
      }
    >
      {event.description && <p className="card p-5 text-sm text-gray-700 whitespace-pre-line">{event.description}</p>}

        <div className="card p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 text-sm">
            <span className="font-semibold text-ink">{event.price > 0 ? `${formatEUR(event.price)} par place` : "Entrée libre sur inscription"}</span>
            {event.remaining !== null && <span className="text-gray-500">{event.remaining} place(s) restante(s)</span>}
          </div>

          {full ? (
            <p className="text-gray-600">L'événement est complet.</p>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              {formError && <p className="text-sm text-red-600">{formError}</p>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Prénom</label>
                  <input required className="input" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
                </div>
                <div>
                  <label className="label">Nom</label>
                  <input required className="input" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="label">E-mail (le billet y sera envoyé)</label>
                <input required type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <label className="label">Nombre de places</label>
                <input
                  type="number"
                  min={1}
                  max={maxQty}
                  className="input w-28"
                  value={form.qty}
                  onChange={(e) => setForm({ ...form, qty: Math.max(1, Math.min(maxQty, Number(e.target.value) || 1)) })}
                />
              </div>
              <button type="submit" className="btn-gold w-full" disabled={busy}>
                {busy ? "Un instant…" : event.price > 0 ? `Payer ${formatEUR(event.price * form.qty)}` : "Recevoir mon billet"}
              </button>
              {event.price > 0 && (
                <p className="text-xs text-gray-500 text-center">
                  Paiement sécurisé par carte. Le billet est une contrepartie : il n'ouvre pas droit à un reçu fiscal.
                </p>
              )}
            </form>
          )}
        </div>
    </PublicPage>
  );
}
