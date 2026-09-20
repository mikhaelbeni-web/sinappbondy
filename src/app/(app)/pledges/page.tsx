"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatEUR, formatDate } from "@/lib/format";
import StatusBadge from "@/components/StatusBadge";
import { useAuth } from "@/context/AuthContext";

interface Donor { id: string; firstName: string; lastName: string; email: string; }
interface Service { id: string; label: string; date: string; }
interface CatalogItem { id: string; name: string; category: string; active: boolean; }

export default function PledgesPage() {
  return (
    <Suspense fallback={<p className="text-gray-500">Chargement…</p>}>
      <PledgesPageInner />
    </Suspense>
  );
}

function PledgesPageInner() {
  const { can } = useAuth();
  const searchParams = useSearchParams();

  const [donors, setDonors] = useState<Donor[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [pledges, setPledges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [serviceId, setServiceId] = useState(searchParams.get("serviceId") || "");
  const [donorId, setDonorId] = useState("");
  const [catalogItemId, setCatalogItemId] = useState("");
  const [customItemName, setCustomItemName] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");

  const [donorQuery, setDonorQuery] = useState("");
  const [showQuickDonor, setShowQuickDonor] = useState(false);
  const [quickDonor, setQuickDonor] = useState({ firstName: "", lastName: "", email: "", phone: "" });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [remindingId, setRemindingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");

  async function loadAll() {
    setLoading(true);
    const [dRes, sRes, cRes, pRes] = await Promise.all([
      fetch("/api/donors"),
      fetch("/api/services"),
      fetch("/api/catalog"),
      fetch("/api/pledges"),
    ]);
    const [d, s, c, p] = await Promise.all([dRes.json(), sRes.json(), cRes.json(), pRes.json()]);
    setDonors(d.donors || []);
    setServices(s.services || []);
    setCatalog((c.items || []).filter((i: CatalogItem) => i.active));
    setPledges(p.pledges || []);
    if (!serviceId && s.services?.length) setServiceId(s.services[0].id);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredDonors = useMemo(() => {
    if (!donorQuery) return donors.slice(0, 8);
    const q = donorQuery.toLowerCase();
    return donors.filter((d) => `${d.firstName} ${d.lastName}`.toLowerCase().includes(q)).slice(0, 8);
  }, [donors, donorQuery]);

  async function createQuickDonor() {
    if (!quickDonor.firstName || !quickDonor.lastName) return;
    const res = await fetch("/api/donors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(quickDonor),
    });
    const data = await res.json();
    if (res.ok) {
      setDonors((prev) => [...prev, data.donor]);
      setDonorId(data.donor.id);
      setDonorQuery(`${data.donor.firstName} ${data.donor.lastName}`);
      setShowQuickDonor(false);
      setQuickDonor({ firstName: "", lastName: "", email: "", phone: "" });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    if (!serviceId || !donorId || !amount) {
      setError("Office, fidèle et montant sont requis.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/pledges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId,
          donorId,
          catalogItemId: catalogItemId || null,
          catalogItemName: catalogItemId ? undefined : customItemName,
          amount: Number(amount),
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setPledges((prev) => [data.pledge, ...prev]);
      setMessage(`Promesse de ${formatEUR(Number(amount))} enregistrée pour ${data.pledge.donorName}.`);
      // Réinitialise pour la saisie suivante, garde l'office sélectionné.
      setDonorId("");
      setDonorQuery("");
      setCatalogItemId("");
      setCustomItemName("");
      setAmount("");
      setNotes("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function relancer(pledgeId: string) {
    setRemindingId(pledgeId);
    try {
      const res = await fetch(`/api/pledges/${pledgeId}/remind`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await loadAll();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRemindingId(null);
    }
  }

  const visiblePledges = statusFilter ? pledges.filter((p) => p.status === statusFilter) : pledges;

  if (!can("saisir_promesses")) {
    return <p className="text-gray-500">Vous n'avez pas accès à la saisie des promesses de dons.</p>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-serif font-bold text-ink">Promesses de dons</h1>

      <form onSubmit={handleSubmit} className="card p-4 space-y-4">
        <p className="text-sm text-gray-500">
          À la fin de l'office, enregistrez ici ce que chaque convive a promis. Le formulaire se réinitialise après
          chaque saisie pour enchaîner rapidement.
        </p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {message && <p className="text-sm text-green-700">{message}</p>}

        <div>
          <label className="label">Office</label>
          <select required className="input" value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
            <option value="">— Choisir un office —</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label} ({formatDate(s.date)})
              </option>
            ))}
          </select>
        </div>

        <div className="relative">
          <label className="label">Fidèle</label>
          <input
            className="input"
            placeholder="Rechercher un fidèle par nom…"
            value={donorId ? donorQuery : donorQuery}
            onChange={(e) => {
              setDonorQuery(e.target.value);
              setDonorId("");
            }}
          />
          {donorQuery && !donorId && (
            <div className="absolute z-10 bg-white border border-gray-200 rounded-md shadow-md w-full mt-1 max-h-56 overflow-auto">
              {filteredDonors.map((d) => (
                <button
                  type="button"
                  key={d.id}
                  className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                  onClick={() => {
                    setDonorId(d.id);
                    setDonorQuery(`${d.firstName} ${d.lastName}`);
                  }}
                >
                  {d.firstName} {d.lastName}
                </button>
              ))}
              {filteredDonors.length === 0 && (
                <p className="px-3 py-2 text-sm text-gray-400">Aucun résultat.</p>
              )}
              <button
                type="button"
                className="block w-full text-left px-3 py-2 text-sm text-gold hover:bg-gray-50 border-t"
                onClick={() => setShowQuickDonor(true)}
              >
                + Créer un nouveau fidèle
              </button>
            </div>
          )}
        </div>

        {showQuickDonor && (
          <div className="bg-gray-50 rounded-md p-3 grid grid-cols-2 gap-2">
            <input className="input" placeholder="Prénom" value={quickDonor.firstName} onChange={(e) => setQuickDonor({ ...quickDonor, firstName: e.target.value })} />
            <input className="input" placeholder="Nom" value={quickDonor.lastName} onChange={(e) => setQuickDonor({ ...quickDonor, lastName: e.target.value })} />
            <input className="input" placeholder="E-mail" value={quickDonor.email} onChange={(e) => setQuickDonor({ ...quickDonor, email: e.target.value })} />
            <input className="input" placeholder="Téléphone" value={quickDonor.phone} onChange={(e) => setQuickDonor({ ...quickDonor, phone: e.target.value })} />
            <div className="col-span-2 flex gap-2">
              <button type="button" onClick={createQuickDonor} className="btn-primary text-sm">Ajouter ce fidèle</button>
              <button type="button" onClick={() => setShowQuickDonor(false)} className="btn-secondary text-sm">Annuler</button>
            </div>
          </div>
        )}

        <div>
          <label className="label">Poste vendu pendant l'office</label>
          <select className="input" value={catalogItemId} onChange={(e) => setCatalogItemId(e.target.value)}>
            <option value="">— Autre / saisie libre —</option>
            {catalog.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {!catalogItemId && (
            <input
              className="input mt-2"
              placeholder="Nom du poste (si absent du catalogue)"
              value={customItemName}
              onChange={(e) => setCustomItemName(e.target.value)}
            />
          )}
        </div>

        <div>
          <label className="label">Montant promis (€)</label>
          <input required type="number" min="1" step="1" className="input" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>

        <div>
          <label className="label">Notes (facultatif)</label>
          <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        <button type="submit" disabled={saving} className="btn-gold">
          {saving ? "Enregistrement…" : "Enregistrer la promesse"}
        </button>
      </form>

      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-ink">Toutes les promesses</h2>
        <select className="input w-48" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Tous les statuts</option>
          <option value="en_attente">En attente</option>
          <option value="relance_envoyee">Relance envoyée</option>
          <option value="paye">Payé</option>
          <option value="annule">Annulé</option>
        </select>
      </div>

      <div className="card divide-y">
        {loading && <p className="p-4 text-sm text-gray-500">Chargement…</p>}
        {!loading && visiblePledges.length === 0 && <p className="p-4 text-sm text-gray-500">Aucune promesse.</p>}
        {visiblePledges.map((p) => (
          <div key={p.id} className="p-4 flex items-center justify-between text-sm">
            <div>
              <p className="font-medium text-ink">{p.donorName} — {p.catalogItemName}</p>
              <p className="text-gray-500">{p.serviceLabel} · {formatDate(p.createdAt)}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-semibold">{formatEUR(p.amount)}</span>
              <StatusBadge status={p.status} />
              {can("envoyer_relances") && p.status !== "paye" && p.status !== "annule" && (
                <button onClick={() => relancer(p.id)} disabled={remindingId === p.id} className="btn-secondary text-xs px-2 py-1">
                  {remindingId === p.id ? "Envoi…" : "Relancer"}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
