"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";

const CATEGORY_LABELS: Record<string, string> = { shabbat: "Shabbat", fete: "Fête", special: "Spécial" };

export default function CatalogPage() {
  const { can } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", category: "shabbat", order: 50 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/catalog");
    const data = await res.json();
    setItems(data.items || []);
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
      const res = await fetch("/api/catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setForm({ name: "", category: "shabbat", order: 50 });
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(id: string, active: boolean) {
    await fetch(`/api/catalog/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !active }),
    });
    await load();
  }

  async function remove(id: string) {
    if (!confirm("Supprimer cet élément du catalogue ?")) return;
    await fetch(`/api/catalog/${id}`, { method: "DELETE" });
    await load();
  }

  if (!can("gerer_catalogue")) {
    return <p className="text-gray-500">Vous n'avez pas accès au catalogue.</p>;
  }

  const grouped = ["shabbat", "fete", "special"].map((cat) => ({
    cat,
    items: items.filter((i) => i.category === cat),
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-serif font-bold text-ink">Catalogue des honneurs</h1>
      <p className="text-sm text-gray-500">
        La liste des postes vendus pendant l'office (ouverture du Heikal, montées, etc.). Elle est proposée lors de
        la saisie des promesses.
      </p>

      <form onSubmit={handleCreate} className="card p-4 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
        {error && <p className="md:col-span-4 text-sm text-red-600">{error}</p>}
        <div className="md:col-span-2">
          <label className="label">Nom</label>
          <input required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div>
          <label className="label">Catégorie</label>
          <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            <option value="shabbat">Shabbat</option>
            <option value="fete">Fête</option>
            <option value="special">Spécial</option>
          </select>
        </div>
        <button type="submit" disabled={saving} className="btn-gold h-fit">
          {saving ? "…" : "Ajouter"}
        </button>
      </form>

      {loading && <p className="text-sm text-gray-500">Chargement…</p>}

      {!loading && grouped.map(({ cat, items: catItems }) => (
        <div key={cat} className="card">
          <div className="p-4 border-b font-semibold text-ink">{CATEGORY_LABELS[cat]}</div>
          <div className="divide-y">
            {catItems.length === 0 && <p className="p-4 text-sm text-gray-400">Rien dans cette catégorie.</p>}
            {catItems.map((i) => (
              <div key={i.id} className="p-3 flex items-center justify-between text-sm">
                <span className={i.active ? "" : "text-gray-400 line-through"}>{i.name}</span>
                <div className="flex gap-2">
                  <button onClick={() => toggleActive(i.id, i.active)} className="btn-secondary text-xs px-2 py-1">
                    {i.active ? "Désactiver" : "Activer"}
                  </button>
                  <button onClick={() => remove(i.id)} className="btn-danger text-xs px-2 py-1">
                    Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
