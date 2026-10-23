"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatEUR } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";

const EMPTY = { title: "", description: "", date: "", location: "", price: "", capacity: "" };

export default function EventsPage() {
  const { can } = useAuth();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/events");
    const data = await res.json();
    setEvents(data.events || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, price: Number(form.price) || 0, capacity: Number(form.capacity) || 0 }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setForm(EMPTY);
    setShowForm(false);
    await load();
  }

  if (!can("gerer_paiements")) return <p className="text-gray-500">Vous n'avez pas accès aux événements.</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-serif font-bold text-ink">Événements</h1>
        <button onClick={() => setShowForm((v) => !v)} className="btn-gold">
          {showForm ? "Fermer" : "+ Nouvel événement"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={create} className="card p-4 space-y-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div>
            <label className="label">Titre</label>
            <input required className="input" placeholder="ex : Dîner de gala" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <label className="label">Description</label>
            <textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Date et heure</label>
              <input required type="datetime-local" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div>
              <label className="label">Lieu</label>
              <input className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
            <div>
              <label className="label">Prix par place (€, 0 = gratuit)</label>
              <input type="number" min="0" step="0.01" className="input" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </div>
            <div>
              <label className="label">Nombre de places (0 = illimité)</label>
              <input type="number" min="0" className="input" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
            </div>
          </div>
          <button type="submit" className="btn-primary">Créer l'événement</button>
        </form>
      )}

      <div className="card divide-y">
        {loading && <p className="p-4 text-sm text-gray-500">Chargement…</p>}
        {!loading && events.length === 0 && <p className="p-4 text-sm text-gray-500">Aucun événement pour l'instant.</p>}
        {events.map((e) => (
          <Link key={e.id} href={`/events/${e.id}`} className={`block p-4 text-sm hover:bg-cream/50 ${e.active ? "" : "opacity-60"}`}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
              <p className="font-medium text-ink">
                {e.title} {!e.active && <span className="text-xs text-gray-500">(inscriptions closes)</span>}
              </p>
              <p className="text-gray-500">{new Date(`${e.date}:00`).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}</p>
            </div>
            <p className="text-gray-600 mt-1">
              {e.qty} inscrit(s){e.capacity > 0 ? ` / ${e.capacity}` : ""} · {e.checkedIn} entrée(s)
              {e.price > 0 ? ` · ${formatEUR(e.amount)} encaissés` : " · gratuit"}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
