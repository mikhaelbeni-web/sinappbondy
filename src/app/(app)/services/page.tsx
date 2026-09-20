"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatDate } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";

const TYPE_LABELS: Record<string, string> = { shabbat: "Shabbat", fete: "Fête", autre: "Autre" };

export default function ServicesPage() {
  const { can } = useAuth();
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ date: "", type: "shabbat", label: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/services");
    const data = await res.json();
    setServices(data.services || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setForm({ date: "", type: "shabbat", label: "", notes: "" });
      setShowForm(false);
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-serif font-bold text-ink">Offices</h1>
        {can("gerer_offices") && (
          <button onClick={() => setShowForm((s) => !s)} className="btn-primary">
            {showForm ? "Annuler" : "+ Nouvel office"}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          {error && <p className="md:col-span-2 text-sm text-red-600">{error}</p>}
          <div>
            <label className="label">Date</label>
            <input type="date" required className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div>
            <label className="label">Type</label>
            <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="shabbat">Shabbat</option>
              <option value="fete">Fête</option>
              <option value="autre">Autre</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="label">Intitulé</label>
            <input required className="input" placeholder="ex : Shabbat Bereshit" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <label className="label">Notes</label>
            <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <button type="submit" disabled={saving} className="btn-gold">
              {saving ? "Création…" : "Créer l'office"}
            </button>
          </div>
        </form>
      )}

      <div className="card divide-y">
        {loading && <p className="p-4 text-sm text-gray-500">Chargement…</p>}
        {!loading && services.length === 0 && <p className="p-4 text-sm text-gray-500">Aucun office créé.</p>}
        {services.map((s) => (
          <Link key={s.id} href={`/services/${s.id}`} className="flex items-center justify-between p-4 hover:bg-gray-50">
            <div>
              <p className="font-medium text-ink">{s.label}</p>
              <p className="text-sm text-gray-500">{formatDate(s.date)} · {TYPE_LABELS[s.type] || s.type}</p>
            </div>
            <span className="text-gold text-sm">Voir →</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
