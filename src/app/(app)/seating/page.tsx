"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

const DEFAULT_SECTIONS = [
  { id: "hommes", name: "Hommes", rows: 10, seatsPerRow: 12, price: 150 },
  { id: "femmes", name: "Femmes", rows: 8, seatsPerRow: 12, price: 150 },
];

export default function SeatingPage() {
  const { can } = useAuth();
  const [plans, setPlans] = useState<any[]>([]);
  const [show, setShow] = useState(false);
  const [name, setName] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [sections, setSections] = useState(DEFAULT_SECTIONS);
  const [error, setError] = useState("");

  async function load() {
    const res = await fetch("/api/seating");
    const data = await res.json();
    setPlans(data.plans || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/seating", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, year, sections }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setShow(false);
    setName("");
    await load();
  }

  const setSec = (i: number, k: string, v: any) => setSections(sections.map((s, j) => (j === i ? { ...s, [k]: v } : s)));

  if (!can("gerer_paiements")) return <p className="text-gray-500">Vous n'avez pas accès aux places des fêtes.</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-serif font-bold text-ink">Places des fêtes</h1>
        <button className="btn-gold" onClick={() => setShow((v) => !v)}>{show ? "Fermer" : "+ Nouveau plan"}</button>
      </div>

      {show && (
        <form onSubmit={create} className="card p-4 space-y-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="label">Nom du plan</label>
              <input required className="input" placeholder="ex : Roch Hachana et Kippour 5787" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="label">Année</label>
              <input type="number" className="input" value={year} onChange={(e) => setYear(Number(e.target.value))} />
            </div>
          </div>
          <p className="label">Sections</p>
          {sections.map((s, i) => (
            <div key={i} className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
              <div className="col-span-2 sm:col-span-2">
                <label className="text-xs text-gray-500">Nom</label>
                <input className="input" value={s.name} onChange={(e) => setSec(i, "name", e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-gray-500">Rangs</label>
                <input type="number" min="1" className="input" value={s.rows} onChange={(e) => setSec(i, "rows", Number(e.target.value))} />
              </div>
              <div>
                <label className="text-xs text-gray-500">Places / rang</label>
                <input type="number" min="1" className="input" value={s.seatsPerRow} onChange={(e) => setSec(i, "seatsPerRow", Number(e.target.value))} />
              </div>
              <div>
                <label className="text-xs text-gray-500">Tarif (€)</label>
                <input type="number" min="0" className="input" value={s.price} onChange={(e) => setSec(i, "price", Number(e.target.value))} />
              </div>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn-secondary text-sm"
              onClick={() => setSections([...sections, { id: `s${Date.now().toString(36)}`, name: "Tribune", rows: 4, seatsPerRow: 10, price: 100 }])}
            >
              + Section
            </button>
            {sections.length > 1 && (
              <button type="button" className="btn-secondary text-sm" onClick={() => setSections(sections.slice(0, -1))}>
                Retirer la dernière
              </button>
            )}
          </div>
          <button type="submit" className="btn-primary">Créer le plan</button>
        </form>
      )}

      <div className="card divide-y">
        {plans.length === 0 && <p className="p-4 text-sm text-gray-500">Aucun plan. Créez-en un pour Roch Hachana et Kippour.</p>}
        {plans.map((p) => (
          <Link key={p.id} href={`/seating/${p.id}`} className="p-4 flex items-center justify-between gap-3 hover:bg-gray-50 text-sm">
            <div className="min-w-0">
              <p className="font-medium text-ink">{p.name}</p>
              <p className="text-gray-500">{p.sections.map((s: any) => s.name).join(" · ")}</p>
            </div>
            <span className="shrink-0 text-gray-600">
              {p.assigned} / {p.capacity} places
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
