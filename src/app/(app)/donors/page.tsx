"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

interface Donor {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

export default function DonorsPage() {
  const { can } = useAuth();
  const [donors, setDonors] = useState<Donor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/donors");
    const data = await res.json();
    setDonors(data.donors || []);
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
      const res = await fetch("/api/donors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setForm({ firstName: "", lastName: "", email: "", phone: "", notes: "" });
      setShowForm(false);
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const filtered = donors.filter((d) =>
    `${d.firstName} ${d.lastName} ${d.email}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-serif font-bold text-ink">Fidèles</h1>
        {can("gerer_fideles") && (
          <button onClick={() => setShowForm((s) => !s)} className="btn-primary">
            {showForm ? "Annuler" : "+ Nouveau fidèle"}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          {error && <p className="md:col-span-2 text-sm text-red-600">{error}</p>}
          <div>
            <label className="label">Prénom</label>
            <input required className="input" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
          </div>
          <div>
            <label className="label">Nom</label>
            <input required className="input" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
          </div>
          <div>
            <label className="label">E-mail</label>
            <input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="label">Téléphone</label>
            <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <label className="label">Notes</label>
            <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <button type="submit" disabled={saving} className="btn-gold">
              {saving ? "Enregistrement…" : "Créer le fidèle"}
            </button>
          </div>
        </form>
      )}

      <input
        className="input max-w-sm"
        placeholder="Rechercher un fidèle…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="card divide-y">
        {loading && <p className="p-4 text-sm text-gray-500">Chargement…</p>}
        {!loading && filtered.length === 0 && <p className="p-4 text-sm text-gray-500">Aucun fidèle.</p>}
        {filtered.map((d) => (
          <Link key={d.id} href={`/donors/${d.id}`} className="flex items-center justify-between p-4 hover:bg-gray-50">
            <div>
              <p className="font-medium text-ink">{d.firstName} {d.lastName}</p>
              <p className="text-sm text-gray-500">{d.email || "Pas d'e-mail"} {d.phone && `· ${d.phone}`}</p>
            </div>
            <span className="text-gold text-sm">Voir →</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
