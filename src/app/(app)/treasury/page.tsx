"use client";

import { useEffect, useMemo, useState } from "react";
import { formatEUR, formatDate, METHOD_LABELS, todayISO } from "@/lib/format";
import { EXPENSE_CATEGORIES, EXPENSE_METHODS } from "@/lib/treasuryLabels";
import { useAuth } from "@/context/AuthContext";

type Tab = "bilan" | "depenses" | "remises";
const MONTHS = ["Janv.", "Févr.", "Mars", "Avr.", "Mai", "Juin", "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Déc."];

export default function TreasuryPage() {
  const { can } = useAuth();
  const [tab, setTab] = useState<Tab>("bilan");
  const [year, setYear] = useState(new Date().getFullYear());

  if (!can("gerer_paiements")) return <p className="text-gray-500">Vous n'avez pas accès à la trésorerie.</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-serif font-bold text-ink">Trésorerie</h1>
        {tab !== "remises" && (
          <select className="input sm:w-32" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        )}
      </div>
      <div className="flex gap-1 border-b overflow-x-auto">
        {([
          ["bilan", "Bilan"],
          ["depenses", "Dépenses"],
          ["remises", "Remises en banque"],
        ] as [Tab, string][]).map(([k, v]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-3 py-2 text-sm border-b-2 -mb-px whitespace-nowrap ${tab === k ? "border-gold text-ink" : "border-transparent text-gray-500 hover:text-ink"}`}
          >
            {v}
          </button>
        ))}
      </div>
      {tab === "bilan" && <Summary year={year} />}
      {tab === "depenses" && <Expenses year={year} />}
      {tab === "remises" && <Deposits />}
    </div>
  );
}

function Summary({ year }: { year: number }) {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    setData(null);
    fetch(`/api/treasury?year=${year}`).then((r) => r.json()).then(setData);
  }, [year]);

  if (!data) return <p className="text-gray-500">Chargement…</p>;
  const max = Math.max(1, ...data.months.map((m: any) => Math.max(m.income, m.expenses)));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="card p-4">
          <p className="text-xs text-gray-500">Recettes</p>
          <p className="text-xl font-semibold text-green-700">{formatEUR(data.income)}</p>
          <p className="text-xs text-gray-500 mt-1">dont {formatEUR(data.nonDeductible)} avec contrepartie</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500">Dépenses</p>
          <p className="text-xl font-semibold text-red-600">{formatEUR(data.expenses)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500">Solde de l'année</p>
          <p className={`text-xl font-semibold ${data.net >= 0 ? "text-ink" : "text-red-600"}`}>{formatEUR(data.net)}</p>
        </div>
      </div>

      <div className="card p-4">
        <h2 className="font-semibold text-ink mb-3">Par mois</h2>
        <div className="flex items-center gap-4 text-xs text-gray-600 mb-2">
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-green-600" /> Recettes</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-red-400" /> Dépenses</span>
        </div>
        <div className="space-y-1.5">
          {data.months.map((m: any, i: number) => (
            <div key={i} className="grid grid-cols-[3rem_1fr] gap-2 items-center text-xs">
              <span className="text-gray-500">{MONTHS[i]}</span>
              <div className="space-y-0.5">
                <div className="h-2 bg-green-600 rounded-sm" style={{ width: `${(m.income / max) * 100}%` }} title={`Recettes ${formatEUR(m.income)}`} />
                <div className="h-2 bg-red-400 rounded-sm" style={{ width: `${(m.expenses / max) * 100}%` }} title={`Dépenses ${formatEUR(m.expenses)}`} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="card p-4 text-sm">
          <h2 className="font-semibold text-ink mb-2">Recettes par mode</h2>
          {Object.keys(data.byMethod).length === 0 && <p className="text-gray-500">Aucune recette.</p>}
          {Object.entries(data.byMethod).sort((a: any, b: any) => b[1] - a[1]).map(([k, v]: any) => (
            <div key={k} className="flex justify-between py-1"><span>{METHOD_LABELS[k] || k}</span><span>{formatEUR(v)}</span></div>
          ))}
        </div>
        <div className="card p-4 text-sm">
          <h2 className="font-semibold text-ink mb-2">Dépenses par catégorie</h2>
          {Object.keys(data.byCategory).length === 0 && <p className="text-gray-500">Aucune dépense.</p>}
          {Object.entries(data.byCategory).sort((a: any, b: any) => b[1] - a[1]).map(([k, v]: any) => (
            <div key={k} className="flex justify-between py-1"><span>{EXPENSE_CATEGORIES[k] || k}</span><span>{formatEUR(v)}</span></div>
          ))}
        </div>
      </div>
    </div>
  );
}

const EMPTY_EXPENSE = { date: todayISO(), amount: "", category: "autre", label: "", supplier: "", method: "virement", reference: "" };

function Expenses({ year }: { year: number }) {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_EXPENSE);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [category, setCategory] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/expenses?year=${year}`);
    const d = await res.json();
    setExpenses(d.expenses || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, amount: Number(form.amount) }),
    });
    const d = await res.json();
    if (!res.ok) {
      setError(d.error);
      return;
    }
    setForm({ ...EMPTY_EXPENSE, date: form.date, category: form.category, method: form.method });
    await load();
  }

  async function remove(id: string) {
    if (!confirm("Supprimer cette dépense ?")) return;
    await fetch(`/api/expenses/${id}`, { method: "DELETE" });
    await load();
  }

  const shown = category ? expenses.filter((e) => e.category === category) : expenses;
  const total = useMemo(() => shown.reduce((s, e) => s + e.amount, 0), [shown]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <select className="input sm:w-64" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Toutes les catégories</option>
          {Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <div className="flex flex-wrap gap-2">
          <a className="btn-secondary" href={`/api/export/depenses?from=${year}-01-01&to=${year}-12-31`}>Exporter (CSV)</a>
          <button className="btn-gold" onClick={() => setShowForm((v) => !v)}>{showForm ? "Fermer" : "+ Nouvelle dépense"}</button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={create} className="card p-4 space-y-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="label">Date</label>
              <input type="date" required className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div>
              <label className="label">Montant (€)</label>
              <input type="number" min="0.01" step="0.01" required className="input" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div>
              <label className="label">Catégorie</label>
              <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label">Libellé</label>
              <input required className="input" placeholder="ex : Facture EDF septembre" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
            </div>
            <div>
              <label className="label">Fournisseur</label>
              <input className="input" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} />
            </div>
            <div>
              <label className="label">Mode de règlement</label>
              <select className="input" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
                {Object.entries(EXPENSE_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Référence (n° de chèque, facture…)</label>
              <input className="input" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
            </div>
          </div>
          <button type="submit" className="btn-primary">Enregistrer la dépense</button>
        </form>
      )}

      <div className="card">
        <div className="p-4 border-b flex justify-between text-sm">
          <span className="font-semibold text-ink">{shown.length} dépense(s)</span>
          <span className="font-semibold text-red-600">{formatEUR(total)}</span>
        </div>
        <div className="divide-y">
          {loading && <p className="p-4 text-sm text-gray-500">Chargement…</p>}
          {!loading && shown.length === 0 && <p className="p-4 text-sm text-gray-500">Aucune dépense.</p>}
          {shown.map((e) => (
            <div key={e.id} className="p-4 text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-ink">{e.label}</p>
                <p className="text-gray-500">
                  {formatDate(e.date)} · {EXPENSE_CATEGORIES[e.category] || e.category}
                  {e.supplier ? ` · ${e.supplier}` : ""}
                  {e.method ? ` · ${EXPENSE_METHODS[e.method] || e.method}` : ""}
                  {e.reference ? ` · ${e.reference}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <span className="font-semibold">{formatEUR(e.amount)}</span>
                <button className="text-red-600 hover:underline" onClick={() => remove(e.id)}>Supprimer</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Deposits() {
  const [pending, setPending] = useState<any[]>([]);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [method, setMethod] = useState<"cheque" | "especes">("cheque");
  const [selected, setSelected] = useState<string[]>([]);
  const [date, setDate] = useState(todayISO());
  const [reference, setReference] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/deposits");
    const d = await res.json();
    setPending(d.pending || []);
    setDeposits(d.deposits || []);
    setSelected([]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const list = pending.filter((p) => p.method === method);
  const selectedTotal = list.filter((p) => selected.includes(p.id)).reduce((s, p) => s + p.amount, 0);

  async function create() {
    setError("");
    const res = await fetch("/api/deposits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentIds: selected, date, reference }),
    });
    const d = await res.json();
    if (!res.ok) {
      setError(d.error);
      return;
    }
    setReference("");
    await load();
  }

  async function remove(id: string) {
    if (!confirm("Supprimer cette remise ? Les encaissements redeviendront « à remettre ».")) return;
    await fetch(`/api/deposits/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="p-4 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h2 className="font-semibold text-ink">À remettre en banque</h2>
          <div className="flex gap-2">
            {(["cheque", "especes"] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMethod(m); setSelected([]); }}
                className={`rounded-full border px-3 py-1 text-sm ${method === m ? "bg-ink text-white border-ink" : "bg-white border-gray-300 text-ink"}`}
              >
                {METHOD_LABELS[m]} ({pending.filter((p) => p.method === m).length})
              </button>
            ))}
          </div>
        </div>
        <div className="divide-y">
          {loading && <p className="p-4 text-sm text-gray-500">Chargement…</p>}
          {!loading && list.length === 0 && <p className="p-4 text-sm text-gray-500">Rien à remettre.</p>}
          {list.length > 0 && (
            <label className="p-3 flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" checked={selected.length === list.length} onChange={(e) => setSelected(e.target.checked ? list.map((p) => p.id) : [])} />
              Tout sélectionner
            </label>
          )}
          {list.map((p) => (
            <label key={p.id} className="p-3 flex items-center gap-3 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={selected.includes(p.id)}
                onChange={(e) => setSelected((prev) => (e.target.checked ? [...prev, p.id] : prev.filter((x) => x !== p.id)))}
              />
              <span className="flex-1 min-w-0">
                <span className="text-ink">{p.donorName}</span>
                <span className="text-gray-500"> · {formatDate(p.date)}{p.reference ? ` · n° ${p.reference}` : ""}</span>
              </span>
              <span className="font-medium shrink-0">{formatEUR(p.amount)}</span>
            </label>
          ))}
        </div>
        {selected.length > 0 && (
          <div className="p-4 border-t space-y-3">
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Date de la remise</label>
                <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div>
                <label className="label">N° de bordereau (facultatif)</label>
                <input className="input" value={reference} onChange={(e) => setReference(e.target.value)} />
              </div>
            </div>
            <button className="btn-gold" onClick={create}>
              Créer la remise : {selected.length} {method === "cheque" ? "chèque(s)" : "versement(s)"}, {formatEUR(selectedTotal)}
            </button>
          </div>
        )}
      </div>

      <div className="card">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-ink">Remises effectuées</h2>
        </div>
        <div className="divide-y">
          {deposits.length === 0 && <p className="p-4 text-sm text-gray-500">Aucune remise.</p>}
          {deposits.map((d) => (
            <div key={d.id} className="p-4 text-sm space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <button className="text-left min-w-0" onClick={() => setOpen(open === d.id ? null : d.id)}>
                  <p className="font-medium text-ink">
                    {formatDate(d.date)} · {METHOD_LABELS[d.method]} · {d.count} pièce(s)
                    {d.reference ? ` · bordereau ${d.reference}` : ""}
                  </p>
                  <p className="text-gray-500">par {d.createdByName} · {open === d.id ? "masquer le détail" : "voir le détail"}</p>
                </button>
                <div className="flex items-center gap-4 shrink-0">
                  <span className="font-semibold">{formatEUR(d.total)}</span>
                  <button className="text-red-600 hover:underline" onClick={() => remove(d.id)}>Supprimer</button>
                </div>
              </div>
              {open === d.id && (
                <ul className="pl-3 border-l text-gray-600 space-y-0.5">
                  {d.payments.map((p: any, i: number) => (
                    <li key={i}>{p.donorName} · {formatDate(p.date)}{p.reference ? ` · n° ${p.reference}` : ""} · {formatEUR(p.amount)}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
