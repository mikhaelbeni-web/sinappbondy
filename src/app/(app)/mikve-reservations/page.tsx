"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";

const DAYS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

export default function MikveAdminPage() {
  const { can } = useAuth();
  const [settings, setSettings] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [publicUrl, setPublicUrl] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch("/api/mikve");
    const d = await res.json();
    if (!res.ok) return;
    setSettings(d.settings);
    setBookings(d.bookings);
    setPublicUrl(d.publicUrl);
  }

  useEffect(() => {
    load();
  }, []);

  function setRange(day: number, i: number, key: "start" | "end", value: string) {
    const schedule = { ...settings.schedule };
    schedule[day] = schedule[day].map((r: any, j: number) => (j === i ? { ...r, [key]: value } : r));
    setSettings({ ...settings, schedule });
  }

  function addRange(day: number) {
    setSettings({ ...settings, schedule: { ...settings.schedule, [day]: [...settings.schedule[day], { start: "20:00", end: "22:00" }] } });
  }

  function removeRange(day: number, i: number) {
    setSettings({ ...settings, schedule: { ...settings.schedule, [day]: settings.schedule[day].filter((_: any, j: number) => j !== i) } });
  }

  async function save() {
    setSaving(true);
    setMessage("");
    const res = await fetch("/api/mikve", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    const d = await res.json();
    setMessage(res.ok ? "Réglages enregistrés." : d.error);
    setSaving(false);
  }

  async function cancel(b: any) {
    if (!confirm(`Annuler la réservation de ${b.name} ?`)) return;
    await fetch(`/api/mikve/${b.id}`, { method: "DELETE" });
    await load();
  }

  if (!can("gerer_offices")) return <p className="text-gray-500">Vous n'avez pas accès au mikvé.</p>;
  if (!settings) return <p className="text-gray-500">Chargement…</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-serif font-bold text-ink">Mikvé</h1>

      <div className="card">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-ink">Réservations à venir ({bookings.length})</h2>
        </div>
        <div className="divide-y">
          {bookings.length === 0 && <p className="p-4 text-sm text-gray-500">Aucune réservation.</p>}
          {bookings.map((b) => (
            <div key={b.id} className="p-4 text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <p className="font-medium text-ink first-letter:uppercase">
                  {new Date(`${b.date}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })} à {b.time.replace(":", "h")}
                </p>
                <p className="text-gray-500 break-all">
                  {b.name}{b.phone ? ` · ${b.phone}` : ""} · {b.email}
                </p>
              </div>
              <button className="text-red-600 hover:underline shrink-0 text-left tap" onClick={() => cancel(b)}>Annuler</button>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-4 space-y-4">
        <h2 className="font-semibold text-ink">Réglages</h2>
        <label className="tap flex items-center gap-2 text-sm">
          <input type="checkbox" checked={settings.enabled} onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })} />
          Réservation en ligne ouverte
        </label>
        {publicUrl && <p className="text-sm text-gray-500 break-all">Page publique : {publicUrl}</p>}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="label">Durée d'un créneau (min)</label>
            <input type="number" className="input" value={settings.slotMinutes} onChange={(e) => setSettings({ ...settings, slotMinutes: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label">Réservable jusqu'à (jours)</label>
            <input type="number" className="input" value={settings.daysAhead} onChange={(e) => setSettings({ ...settings, daysAhead: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label">Participation sur place (€)</label>
            <input type="number" min="0" className="input" value={settings.price} onChange={(e) => setSettings({ ...settings, price: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="label">Horaires d'ouverture</label>
          <div className="divide-y border rounded">
            {DAYS.map((name, d) => (
              <div key={d} className="p-3 flex flex-col sm:flex-row sm:items-start gap-2 text-sm">
                <span className="w-24 font-medium text-ink shrink-0">{name}</span>
                <div className="flex-1 space-y-2">
                  {settings.schedule[d].length === 0 && <span className="text-gray-400">Fermé</span>}
                  {settings.schedule[d].map((r: any, i: number) => (
                    <div key={i} className="flex flex-wrap items-center gap-x-2">
                      <span className="flex items-center gap-2 min-w-0 basis-full sm:basis-auto">
                        <input type="time" className="input min-w-0 flex-1 sm:flex-none sm:w-28" value={r.start} onChange={(e) => setRange(d, i, "start", e.target.value)} />
                        <span>à</span>
                        <input type="time" className="input min-w-0 flex-1 sm:flex-none sm:w-28" value={r.end} onChange={(e) => setRange(d, i, "end", e.target.value)} />
                      </span>
                      <button className="text-red-600 hover:underline tap" onClick={() => removeRange(d, i)}>Retirer</button>
                    </div>
                  ))}
                </div>
                <button className="text-gold hover:underline shrink-0 text-left tap" onClick={() => addRange(d)}>+ Plage</button>
              </div>
            ))}
          </div>
        </div>
        <div>
          <label className="label">Consignes (affichées et envoyées dans la confirmation)</label>
          <textarea className="input" rows={3} value={settings.instructions} onChange={(e) => setSettings({ ...settings, instructions: e.target.value })} />
        </div>
        {message && <p className="text-sm text-gray-700">{message}</p>}
        <button className="btn-primary" disabled={saving} onClick={save}>{saving ? "Enregistrement…" : "Enregistrer"}</button>
      </div>
    </div>
  );
}
