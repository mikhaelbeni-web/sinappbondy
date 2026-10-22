"use client";

import { useEffect, useState } from "react";

const REFRESH_MS = 5 * 60 * 1000;

const civilLabel = (iso: string, opts: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long", year: "numeric" }) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("fr-FR", { ...opts, timeZone: "UTC" });

// Écran louah : à ouvrir en plein écran sur la TV de la synagogue.
export default function LouahPage() {
  const [data, setData] = useState<any>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const load = () =>
      fetch("/api/public/louah", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d) => {
          setData(d);
          setError(false);
        })
        .catch(() => setError(true));
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  function fullscreen() {
    document.documentElement.requestFullscreen?.().catch(() => {});
  }

  if (!data) {
    return <div className="min-h-screen bg-ink text-cream flex items-center justify-center">{error ? "Connexion impossible, nouvel essai dans quelques minutes." : "Chargement…"}</div>;
  }

  const clock = now?.toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" }) || "";

  return (
    <div className="min-h-screen bg-ink text-cream p-4 sm:p-8 flex flex-col gap-6 cursor-default" onDoubleClick={fullscreen}>
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 border-b border-gold/40 pb-4">
        <div>
          {data.title && <p className="text-gold text-xl sm:text-2xl font-serif">{data.title}</p>}
          <p className="text-2xl sm:text-4xl font-serif first-letter:uppercase">{civilLabel(data.civilDate)}</p>
          <p className="text-xl sm:text-3xl text-gold mt-1">
            {data.hebrewDate} · <span dir="rtl" lang="he">{data.hebrewDateHe}</span>
          </p>
        </div>
        <p className="text-5xl sm:text-7xl font-light tabular-nums">{clock}</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
        <section className="space-y-6">
          <div className="rounded-lg bg-white/5 p-5">
            <p className="text-sm uppercase tracking-wider text-gold">Paracha de la semaine</p>
            <p className="text-3xl font-serif mt-1">{data.parasha.name}</p>
            <p className="text-2xl mt-1" dir="rtl" lang="he">{data.parasha.hebrew}</p>
          </div>
          {(data.candle || data.havdalah) && (
            <div className="rounded-lg bg-white/5 p-5 space-y-3">
              {data.candle && (
                <div className="flex justify-between items-baseline gap-4">
                  <span className="first-letter:uppercase">Allumage des bougies<br /><span className="text-sm text-cream/60">{civilLabel(data.candle.date, { weekday: "long", day: "numeric", month: "long" })}</span></span>
                  <span className="text-3xl text-gold tabular-nums">{data.candle.time}</span>
                </div>
              )}
              {data.havdalah && (
                <div className="flex justify-between items-baseline gap-4">
                  <span>Havdala<br /><span className="text-sm text-cream/60">{civilLabel(data.havdalah.date, { weekday: "long", day: "numeric", month: "long" })}</span></span>
                  <span className="text-3xl text-gold tabular-nums">{data.havdalah.time}</span>
                </div>
              )}
            </div>
          )}
          {data.holidays.length > 0 && (
            <div className="rounded-lg bg-white/5 p-5">
              <p className="text-sm uppercase tracking-wider text-gold mb-2">Cette semaine</p>
              {data.holidays.map((h: any, i: number) => (
                <p key={i} className="flex justify-between gap-4 py-0.5">
                  <span>{h.name}</span>
                  <span className="text-cream/60 first-letter:uppercase">{civilLabel(h.date, { weekday: "short", day: "numeric", month: "short" })}</span>
                </p>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-6">
          {data.times.length > 0 && (
            <div className="rounded-lg bg-white/5 p-5">
              <p className="text-sm uppercase tracking-wider text-gold mb-2">Horaires des offices</p>
              {data.times.map((t: any, i: number) => (
                <p key={i} className="flex justify-between gap-4 text-xl py-1 border-b border-white/10 last:border-0">
                  <span>{t.label}</span>
                  <span className="tabular-nums">{t.value}</span>
                </p>
              ))}
            </div>
          )}
          {data.zmanim.length > 0 && (
            <div className="rounded-lg bg-white/5 p-5">
              <p className="text-sm uppercase tracking-wider text-gold mb-2">Zmanim · {data.city}</p>
              {data.zmanim.map((z: any) => (
                <p key={z.label} className="flex justify-between gap-4 py-0.5">
                  <span>{z.label}</span>
                  <span className="tabular-nums">{z.time || "-"}</span>
                </p>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-6">
          {data.announcements.length > 0 && (
            <div className="rounded-lg bg-gold/15 border border-gold/40 p-5 space-y-3">
              <p className="text-sm uppercase tracking-wider text-gold">Annonces</p>
              {data.announcements.map((a: string, i: number) => (
                <p key={i} className="text-xl">{a}</p>
              ))}
            </div>
          )}
          {data.services.length > 0 && (
            <div className="rounded-lg bg-white/5 p-5">
              <p className="text-sm uppercase tracking-wider text-gold mb-2">Prochains offices</p>
              {data.services.map((s: any, i: number) => (
                <p key={i} className="py-0.5">
                  <span className="text-cream/60 first-letter:uppercase">{civilLabel(s.date, { weekday: "short", day: "numeric", month: "short" })}</span> · {s.label}
                  {s.notes ? <span className="text-cream/60"> ({s.notes})</span> : null}
                </p>
              ))}
            </div>
          )}
          {data.hazkarot.length > 0 && (
            <div className="rounded-lg bg-white/5 p-5">
              <p className="text-sm uppercase tracking-wider text-gold mb-2">Hazkarot de la semaine</p>
              {data.hazkarot.map((h: any, i: number) => (
                <p key={i} className="flex justify-between gap-4 py-0.5">
                  <span>{h.name}</span>
                  <span className="text-cream/60">{h.hebrew}</span>
                </p>
              ))}
            </div>
          )}
        </section>
      </div>
      <p className="text-xs text-cream/40 text-center">Double-cliquez pour passer en plein écran · mise à jour automatique</p>
    </div>
  );
}
