"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { formatEUR } from "@/lib/format";
import { rowLetter, seatId, seatLabel } from "@/lib/seating";
import { filterByQuery } from "@/lib/search";

interface Donor { id: string; firstName: string; lastName: string; }

// Plan de salle : cliquer des places libres, choisir la famille, attribuer.
// Couleurs : libre (blanc), sélectionnée (or), attribuée à régler (ambre),
// réglée ou offerte (vert).
export default function SeatingPlanPage() {
  const { planId } = useParams<{ planId: string }>();
  const [plan, setPlan] = useState<any>(null);
  const [seats, setSeats] = useState<any[]>([]);
  const [donors, setDonors] = useState<Donor[]>([]);
  const [selected, setSelected] = useState<{ sectionId: string; row: number; seat: number }[]>([]);
  const [focus, setFocus] = useState<any>(null);
  const [donorQuery, setDonorQuery] = useState("");
  const [donorId, setDonorId] = useState("");
  const [bill, setBill] = useState(true);
  const [highlight, setHighlight] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [deleteError, setDeleteError] = useState("");

  async function load() {
    const [pRes, dRes] = await Promise.all([fetch(`/api/seating/${planId}`), fetch("/api/donors")]);
    const [p, d] = await Promise.all([pRes.json(), dRes.json()]);
    setPlan(p.plan);
    setSeats(p.seats || []);
    setDonors(d.donors || []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId]);

  const byId = useMemo(() => new Map(seats.map((s) => [s.id, s])), [seats]);
  const matches = useMemo(() => {
    if (!donorQuery) return [];
    return filterByQuery(donors, donorQuery, (d) => `${d.firstName} ${d.lastName}`).slice(0, 8);
  }, [donors, donorQuery]);

  function click(sectionId: string, row: number, seat: number) {
    const taken = byId.get(seatId(planId, sectionId, row, seat));
    if (taken) {
      setFocus(taken);
      setSelected([]);
      return;
    }
    setFocus(null);
    setSelected((prev) =>
      prev.some((s) => s.sectionId === sectionId && s.row === row && s.seat === seat)
        ? prev.filter((s) => !(s.sectionId === sectionId && s.row === row && s.seat === seat))
        : [...prev, { sectionId, row, seat }]
    );
  }

  async function assign() {
    setBusy(true);
    setMessage("");
    const res = await fetch(`/api/seating/${planId}/seats`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ donorId, seats: selected, bill }),
    });
    const d = await res.json();
    setMessage(res.ok ? `${d.assigned} place(s) attribuée(s).` : d.error);
    if (res.ok) {
      setSelected([]);
      setDonorId("");
      setDonorQuery("");
    }
    setBusy(false);
    await load();
  }

  async function release(id: string) {
    if (!confirm("Libérer cette place ? La somme due correspondante sera annulée.")) return;
    const res = await fetch(`/api/seating/${planId}/seats`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seatId: id }),
    });
    const d = await res.json();
    setMessage(res.ok ? "Place libérée." : d.error);
    setFocus(null);
    await load();
  }

  async function confirmAll(onlyNew: boolean) {
    setBusy(true);
    setMessage("");
    const res = await fetch(`/api/seating/${planId}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ onlyNew }),
    });
    const d = await res.json();
    setMessage(res.ok ? `${d.sent} confirmation(s) envoyée(s)${d.skipped.length ? ` ; sans e-mail : ${d.skipped.join(", ")}` : ""}.` : d.error);
    setBusy(false);
    await load();
  }

  // Première validation : boîte de confirmation. La seconde (saisie du nom
  // du plan) se fait dans l'encadré qui s'ouvre ensuite.
  function askDelete() {
    const paidSeats = seats.filter((s) => s.pledgeId && s.paid > 0).length;
    if (paidSeats) {
      setDeleteError(`${paidSeats} place(s) déjà (en partie) réglée(s) : ce plan ne peut pas être supprimé. Supprimez d'abord ces paiements.`);
      setDeleting(true);
      return;
    }
    if (!confirm(`Supprimer définitivement le plan « ${plan.name} » ?\n\n${seats.length} place(s) attribuée(s) seront supprimées et les sommes dues correspondantes annulées. Cette action est irréversible.`)) return;
    setDeleteError("");
    setConfirmName("");
    setDeleting(true);
  }

  async function removePlan() {
    setBusy(true);
    setDeleteError("");
    const res = await fetch(`/api/seating/${planId}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmName }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setDeleteError(d.error || "Suppression impossible.");
      return;
    }
    router.push(`/seating?deleted=${encodeURIComponent(plan.name)}`);
  }

  if (!plan) return <p className="text-gray-500">Chargement…</p>;

  const capacity = plan.sections.reduce((s: number, x: any) => s + x.rows * x.seatsPerRow, 0);
  const families = new Set(seats.map((s) => s.donorId)).size;
  const due = seats.reduce((s, x) => s + x.remaining, 0);
  const hasPaid = seats.some((s) => s.pledgeId && s.paid > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 print:hidden">
        <div>
          <Link href="/seating" className="text-sm text-gray-500 hover:underline tap">← Places des fêtes</Link>
          <h1 className="text-2xl font-serif font-bold text-ink">{plan.name}</h1>
          <p className="text-sm text-gray-500">
            {seats.length} / {capacity} places · {families} famille(s) · reste à encaisser {formatEUR(due)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" disabled={busy} onClick={() => confirmAll(true)}>Confirmer les nouvelles</button>
          <button className="btn-secondary" disabled={busy} onClick={() => confirmAll(false)}>Tout reconfirmer</button>
          <button className="btn-secondary" onClick={() => window.print()}>Imprimer</button>
        </div>
      </div>
      <h1 className="hidden print:block text-xl font-bold">{plan.name}</h1>

      <input
        className="input max-w-sm print:hidden"
        placeholder="Repérer une famille sur le plan…"
        value={highlight}
        onChange={(e) => setHighlight(e.target.value)}
      />

      {message && <p className="text-sm text-gray-700 print:hidden">{message}</p>}

      {(selected.length > 0 || focus) && (
        <div className="card p-4 space-y-3 print:hidden [@media(min-height:560px)]:sticky top-14 md:top-2 z-20">
          {focus ? (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm">
              <p>
                <strong>{seatLabel(plan.sections.find((s: any) => s.id === focus.sectionId)?.name || "", focus.row, focus.seat)}</strong> :{" "}
                <Link href={`/donors/${focus.donorId}`} className="text-gold hover:underline tap">{focus.donorName}</Link>
                {focus.pledgeId ? (focus.remaining > 0 ? ` · reste ${formatEUR(focus.remaining)}` : " · réglée") : " · offerte"}
                {focus.confirmedAt ? " · confirmée" : ""}
              </p>
              <button className="text-red-600 text-sm hover:underline tap" onClick={() => release(focus.id)}>Libérer</button>
            </div>
          ) : (
            <>
              <p className="text-sm">
                {selected.length} place(s) :{" "}
                {selected.map((s) => seatLabel(plan.sections.find((x: any) => x.id === s.sectionId)?.name || "", s.row, s.seat)).join(", ")}
              </p>
              <div className="relative">
                <input
                  className="input"
                  placeholder="Famille (rechercher un fidèle)…"
                  value={donorQuery}
                  onChange={(e) => {
                    setDonorQuery(e.target.value);
                    setDonorId("");
                  }}
                />
                {donorQuery && !donorId && (
                  <div className="absolute z-10 bg-white border border-gray-200 rounded-md shadow-md w-full mt-1 max-h-56 overflow-auto">
                    {matches.map((d) => (
                      <button
                        type="button"
                        key={d.id}
                        className="block w-full text-left px-3 py-3 text-sm hover:bg-gray-50"
                        onClick={() => {
                          setDonorId(d.id);
                          setDonorQuery(`${d.firstName} ${d.lastName}`);
                        }}
                      >
                        {d.firstName} {d.lastName}
                      </button>
                    ))}
                    {matches.length === 0 && <p className="px-3 py-2 text-sm text-gray-400">Aucun résultat.</p>}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="tap flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={bill} onChange={(e) => setBill(e.target.checked)} />
                  Facturer au tarif de la section
                </label>
                <button className="btn-gold" disabled={busy || !donorId} onClick={assign}>Attribuer</button>
                <button className="btn-secondary" onClick={() => setSelected([])}>Annuler</button>
              </div>
            </>
          )}
        </div>
      )}

      {plan.sections.map((sec: any) => (
        <div key={sec.id} className="card p-4 space-y-3 break-inside-avoid">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-semibold text-ink">{sec.name}</h2>
            <span className="text-xs text-gray-500">{sec.price > 0 ? `${formatEUR(sec.price)} la place` : "gratuit"}</span>
          </div>
          <div className="overflow-x-auto">
            <div className="inline-block space-y-1">
              {Array.from({ length: sec.rows }, (_, r) => r + 1).map((row) => (
                <div key={row} className="flex items-center gap-1">
                  <span className="w-6 text-xs text-gray-500 text-right">{rowLetter(row)}</span>
                  {Array.from({ length: sec.seatsPerRow }, (_, s) => s + 1).map((seat) => {
                    const taken = byId.get(seatId(planId, sec.id, row, seat));
                    const isSel = selected.some((x) => x.sectionId === sec.id && x.row === row && x.seat === seat);
                    const hl = highlight && taken && taken.donorName.toLowerCase().includes(highlight.toLowerCase());
                    const color = isSel
                      ? "bg-gold text-white border-gold"
                      : taken
                        ? taken.remaining > 0
                          ? "bg-amber-100 border-amber-300 text-amber-900"
                          : "bg-green-100 border-green-300 text-green-900"
                        : "bg-white border-gray-300 text-gray-500 hover:border-gold";
                    return (
                      <button
                        key={seat}
                        type="button"
                        title={taken ? `${rowLetter(row)}${seat} · ${taken.donorName}` : `${rowLetter(row)}${seat} · libre`}
                        onClick={() => click(sec.id, row, seat)}
                        className={`w-9 h-9 sm:w-11 sm:h-11 rounded border text-[10px] leading-tight overflow-hidden ${color} ${hl ? "ring-2 ring-ink" : ""}`}
                      >
                        {taken ? taken.donorName.split(" ").slice(-1)[0].slice(0, 6) : seat}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}

      <div className="flex flex-wrap gap-4 text-xs text-gray-600 print:hidden">
        <span><span className="inline-block w-3 h-3 border border-gray-300 bg-white align-middle mr-1" />Libre</span>
        <span><span className="inline-block w-3 h-3 bg-gold align-middle mr-1" />Sélectionnée</span>
        <span><span className="inline-block w-3 h-3 bg-amber-100 border border-amber-300 align-middle mr-1" />À régler</span>
        <span><span className="inline-block w-3 h-3 bg-green-100 border border-green-300 align-middle mr-1" />Réglée ou offerte</span>
      </div>

      <div className="card p-4 space-y-3 border-red-200 print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="font-semibold text-red-700">Supprimer ce plan</h2>
            <p className="text-sm text-gray-500">Supprime le plan et ses {seats.length} place(s) attribuée(s), et annule les sommes dues non réglées. Irréversible.</p>
          </div>
          {!deleting && (
            <button className="btn-danger shrink-0 self-start sm:self-auto" onClick={askDelete}>Supprimer le plan</button>
          )}
        </div>
        {deleting && (
          <div className="space-y-3">
            {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}
            {!hasPaid && (
              <>
                <label className="block text-sm text-gray-700">
                  Pour confirmer, saisissez le nom du plan : <strong className="text-ink">{plan.name}</strong>
                </label>
                <input className="input max-w-sm" value={confirmName} onChange={(e) => setConfirmName(e.target.value)} autoComplete="off" />
              </>
            )}
            <div className="flex flex-wrap gap-2">
              {!hasPaid && (
                <button className="btn-danger" disabled={busy || confirmName.trim() !== plan.name} onClick={removePlan}>
                  {busy ? "Suppression…" : "Supprimer définitivement"}
                </button>
              )}
              <button className="btn-secondary" disabled={busy} onClick={() => { setDeleting(false); setDeleteError(""); setConfirmName(""); }}>Annuler</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
