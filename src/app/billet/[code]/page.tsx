"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

const CHECKIN_LABELS: Record<string, string> = {
  ok: "Entrée validée.",
  deja_utilise: "Billet déjà utilisé.",
  autre_evenement: "Ce billet concerne un autre événement.",
};

// Billet : ouvert par le fidèle (affiche son QR code) ou scanné à l'entrée
// par un membre de l'équipe connecté (bouton de validation).
export default function TicketPage() {
  const { code } = useParams<{ code: string }>();
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [checkin, setCheckin] = useState<{ status: string; registration?: any } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/public/tickets/${code}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setData(d);
      })
      .catch((e) => setError(e.message));
  }, [code]);

  async function validate() {
    setBusy(true);
    try {
      const res = await fetch("/api/events/any/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setCheckin(d);
    } catch (err: any) {
      setCheckin({ status: err.message });
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream px-4">
        <div className="card p-8 max-w-md text-center text-gray-600">{error}</div>
      </div>
    );
  }
  if (!data) return <div className="min-h-screen flex items-center justify-center bg-cream text-gray-500">Chargement…</div>;

  const { ticket, event } = data;
  const used = checkin?.registration?.checkedInAt || ticket.checkedInAt;

  return (
    <div className="min-h-screen bg-cream px-4 py-10">
      <div className="max-w-sm mx-auto card p-6 text-center space-y-4">
        {event && (
          <div>
            <h1 className="text-xl font-serif font-bold text-ink">{event.title}</h1>
            <p className="text-gray-600 text-sm first-letter:uppercase">
              {new Date(`${event.date}:00`).toLocaleString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
            </p>
            {event.location && <p className="text-gray-500 text-sm">{event.location}</p>}
          </div>
        )}
        <div>
          <p className="font-medium text-ink">{ticket.name}</p>
          <p className="text-sm text-gray-600">{ticket.qty} place{ticket.qty > 1 ? "s" : ""}</p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/public/tickets/${ticket.code}/qr`} alt="QR code du billet" className="mx-auto w-56 h-56" />
        <p className="font-mono tracking-widest text-lg text-ink">{ticket.code}</p>
        {used && <p className="text-sm text-gray-500">Utilisé le {new Date(used).toLocaleString("fr-FR")}</p>}

        {user && (
          <div className="border-t pt-4 space-y-2">
            {checkin && (
              <p className={`font-semibold ${checkin.status === "ok" ? "text-green-700" : "text-red-600"}`}>
                {CHECKIN_LABELS[checkin.status] || checkin.status}
              </p>
            )}
            {!checkin && (
              <button className="btn-gold w-full" disabled={busy} onClick={validate}>
                {busy ? "Validation…" : "Valider l'entrée"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
