"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  const [deleted, setDeleted] = useState("");
  const [drawn, setDrawn] = useState(true);
  const [tariffs, setTariffs] = useState([{ id: "places", name: "Places", price: 0 }]);
  const router = useRouter();

  async function load() {
    const res = await fetch("/api/seating");
    const data = await res.json();
    setPlans(data.plans || []);
  }

  useEffect(() => {
    load();
    // Retour de la page du plan après suppression.
    const name = new URLSearchParams(window.location.search).get("deleted");
    if (name) {
      setDeleted(name);
      window.history.replaceState(null, "", "/seating");
    }
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/seating", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(drawn ? { name, year, drawn: true, sections: tariffs } : { name, year, sections }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    if (drawn) {
      router.push(`/seating/${data.plan.id}?edit=1`);
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

      {deleted && <p className="text-sm text-green-700">Plan « {deleted} » supprimé.</p>}

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
          <fieldset className="space-y-2">
            <legend className="label">Type de plan</legend>
            <label className="tap flex items-start gap-2 text-sm">
              <input type="radio" name="kind" checked={drawn} onChange={() => setDrawn(true)} className="mt-1" />
              <span><strong>Plan de salle dessiné</strong> : murs, Aron, téva, portes et rangées placées comme dans votre synagogue. Vous le dessinez juste après.</span>
            </label>
            <label className="tap flex items-start gap-2 text-sm">
              <input type="radio" name="kind" checked={!drawn} onChange={() => setDrawn(false)} className="mt-1" />
              <span><strong>Grille simple</strong> : sections de N rangs × M places.</span>
            </label>
          </fieldset>
          {drawn && (
            <>
              <p className="label">Tarifs</p>
              {tariffs.map((s, i) => (
                <div key={s.id} className="grid grid-cols-3 gap-2 items-end">
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500" htmlFor={`tn${i}`}>Nom</label>
                    <input id={`tn${i}`} className="input" value={s.name} onChange={(e) => setTariffs(tariffs.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500" htmlFor={`tp${i}`}>Tarif (€)</label>
                    <input id={`tp${i}`} type="number" min="0" className="input" value={s.price} onChange={(e) => setTariffs(tariffs.map((x, j) => (j === i ? { ...x, price: Number(e.target.value) } : x)))} />
                  </div>
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-secondary text-sm" onClick={() => setTariffs([...tariffs, { id: `t${Date.now().toString(36)}`, name: "Femmes", price: 0 }])}>+ Tarif</button>
                {tariffs.length > 1 && <button type="button" className="btn-secondary text-sm" onClick={() => setTariffs(tariffs.slice(0, -1))}>Retirer le dernier</button>}
              </div>
              <p className="text-xs text-gray-500">Dans l'éditeur, chaque rangée suit l'un de ces tarifs. Vous pourrez les modifier ensuite.</p>
            </>
          )}
          {!drawn && <p className="label">Sections</p>}
          {!drawn && sections.map((s, i) => (
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
          {!drawn && <div className="flex flex-wrap gap-2">
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
          </div>}
          <button type="submit" className="btn-primary">{drawn ? "Créer et dessiner le plan" : "Créer le plan"}</button>
        </form>
      )}

      <div className="card divide-y">
        {plans.length === 0 && <p className="p-4 text-sm text-gray-500">Aucun plan. Créez-en un pour Roch Hachana et Kippour.</p>}
        {plans.map((p) => (
          <Link key={p.id} href={`/seating/${p.id}`} className="p-4 flex items-center justify-between gap-3 hover:bg-gray-50 text-sm">
            <div className="min-w-0">
              <p className="font-medium text-ink">{p.name}</p>
              <p className="text-gray-500">{p.drawn || p.layout ? "Plan dessiné · " : ""}{p.sections.map((s: any) => s.name).join(" · ")}</p>
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
