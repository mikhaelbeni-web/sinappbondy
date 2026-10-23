"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatEUR } from "@/lib/format";
import PublicPage from "@/components/PublicPage";

function dayLabel(date: string) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}

function MikveBooking() {
  const params = useSearchParams();
  const cancel = params.get("annulation");
  const [data, setData] = useState<any>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", email: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  async function load() {
    const res = await fetch("/api/public/mikve", { cache: "no-store" });
    const d = await res.json();
    setData(d);
    if (d.days?.length) setDate((cur) => cur || d.days[0].date);
  }

  useEffect(() => {
    load();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/public/mikve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, date, time }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error);
      setDone(d.when);
    } catch (err: any) {
      setError(err.message);
      setTime("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  const wrap = (children: React.ReactNode) => (
    <PublicPage title="Réservation du mikvé" subtitle="Choisissez votre créneau en toute discrétion">
      {cancel === "ok" && <p className="card p-4 text-sm text-green-700">Votre réservation a été annulée.</p>}
      {cancel === "erreur" && <p className="card p-4 text-sm text-red-600">Lien d'annulation invalide.</p>}
      {children}
    </PublicPage>
  );

  if (!data) return wrap(<p className="text-center text-gray-500">Chargement…</p>);
  if (data.error || !data.enabled) return wrap(<p className="card p-6 text-center text-gray-600">La réservation en ligne n'est pas ouverte.</p>);
  if (done) {
    return wrap(
      <div className="card p-6 text-center space-y-2">
        <p className="font-semibold text-green-700">Créneau réservé</p>
        <p className="text-ink first-letter:uppercase">{done}</p>
        <p className="text-sm text-gray-500">Une confirmation vous a été envoyée par e-mail, avec un lien pour annuler.</p>
      </div>
    );
  }
  if (!data.days.length) return wrap(<p className="card p-6 text-center text-gray-600">Aucun créneau disponible pour le moment.</p>);

  const day = data.days.find((d: any) => d.date === date) || data.days[0];

  return wrap(
    <>
      {(data.instructions || data.price > 0) && (
        <div className="card p-4 text-sm text-gray-700 space-y-1">
          {data.price > 0 && <p>Participation : {formatEUR(data.price)}, à régler sur place.</p>}
          {data.instructions && <p className="whitespace-pre-line">{data.instructions}</p>}
        </div>
      )}
      <div className="card p-4 space-y-4">
        <div>
          <label className="label">Jour</label>
          <select className="input" value={day.date} onChange={(e) => { setDate(e.target.value); setTime(""); }}>
            {data.days.map((d: any) => (
              <option key={d.date} value={d.date}>{dayLabel(d.date)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Heure</label>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {day.slots.map((s: any) => (
              <button
                key={s.time}
                type="button"
                disabled={!s.free}
                onClick={() => setTime(s.time)}
                className={`rounded border px-2 py-3 text-sm ${
                  !s.free ? "bg-gray-100 text-gray-400 line-through" : time === s.time ? "bg-ink text-white border-ink" : "bg-white border-gray-300 text-ink"
                }`}
              >
                {s.time.replace(":", "h")}
              </button>
            ))}
          </div>
        </div>
        {time && (
          <form onSubmit={submit} className="space-y-3 border-t pt-4">
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div>
              <label className="label">Prénom</label>
              <input required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">E-mail</label>
                <input required type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <label className="label">Téléphone (facultatif)</label>
                <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <button type="submit" className="btn-gold w-full" disabled={busy}>
              {busy ? "Réservation…" : `Réserver ${dayLabel(day.date)} à ${time.replace(":", "h")}`}
            </button>
          </form>
        )}
        {!time && error && <p className="text-sm text-red-600">{error}</p>}
      </div>
      <p className="text-xs text-gray-500 text-center">Vos coordonnées servent uniquement à cette réservation et sont effacées en cas d'annulation.</p>
    </>
  );
}

export default function MikvePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-cream text-gray-500">Chargement…</div>}>
      <MikveBooking />
    </Suspense>
  );
}
