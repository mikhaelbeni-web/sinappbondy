"use client";

import { useEffect, useState } from "react";
import { formatDate } from "@/lib/format";

// Hazkarot d'un fidèle (fiche fidèle) : ajout et prochaine date.
export default function HazkarotSection({ donorId, canEdit }: { donorId: string; canEdit: boolean }) {
  const [list, setList] = useState<any[]>([]);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ deceasedName: "", relation: "", deathDate: "", afterSunset: false });
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch(`/api/hazkarot?donorId=${donorId}`);
    const data = await res.json();
    setList(data.hazkarot || []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [donorId]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/hazkarot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ donorId, ...form }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setForm({ deceasedName: "", relation: "", deathDate: "", afterSunset: false });
    setShow(false);
    await load();
  }

  async function remove(id: string) {
    if (!confirm("Supprimer cette hazkara ?")) return;
    await fetch(`/api/hazkarot/${id}`, { method: "DELETE" });
    await load();
  }

  if (!list.length && !canEdit) return null;

  return (
    <div className="card print:hidden">
      <div className="p-4 border-b flex items-center justify-between gap-2">
        <h2 className="font-semibold text-ink">Hazkarot</h2>
        {canEdit && (
          <button className="text-sm text-gold hover:underline tap" onClick={() => setShow((v) => !v)}>
            {show ? "Fermer" : "+ Ajouter"}
          </button>
        )}
      </div>
      {show && (
        <form onSubmit={add} className="p-4 border-b grid grid-cols-1 sm:grid-cols-2 gap-3">
          {error && <p className="sm:col-span-2 text-sm text-red-600">{error}</p>}
          <div>
            <label className="label">Nom du défunt</label>
            <input required className="input" value={form.deceasedName} onChange={(e) => setForm({ ...form, deceasedName: e.target.value })} />
          </div>
          <div>
            <label className="label">Lien de parenté</label>
            <input className="input" placeholder="ex : père" value={form.relation} onChange={(e) => setForm({ ...form, relation: e.target.value })} />
          </div>
          <div>
            <label className="label">Date du décès (civile)</label>
            <input required type="date" className="input" value={form.deathDate} onChange={(e) => setForm({ ...form, deathDate: e.target.value })} />
          </div>
          <label className="tap flex items-center gap-2 text-sm sm:mt-6">
            <input type="checkbox" checked={form.afterSunset} onChange={(e) => setForm({ ...form, afterSunset: e.target.checked })} />
            Décès après le coucher du soleil
          </label>
          <div className="sm:col-span-2">
            <button type="submit" className="btn-primary">Enregistrer</button>
          </div>
        </form>
      )}
      <div className="divide-y">
        {list.length === 0 && <p className="p-4 text-sm text-gray-500">Aucune hazkara enregistrée.</p>}
        {list.map((h) => (
          <div key={h.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm">
            <div className="min-w-0">
              <p className="font-medium text-ink">
                {h.deceasedName} {h.relation && <span className="text-gray-500 font-normal">({h.relation})</span>}
              </p>
              <p className="text-gray-500">Décès : {formatDate(h.deathDate)} · {h.hebrewDate}</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {h.next && (
                <span className="text-ink">
                  Prochaine : <strong>{formatDate(h.next.date)}</strong> <span className="text-gray-500">({h.next.hebrew})</span>
                </span>
              )}
              {canEdit && (
                <button className="text-xs text-red-600 hover:underline tap" onClick={() => remove(h.id)}>Supprimer</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
