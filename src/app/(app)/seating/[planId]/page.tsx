"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { formatEUR } from "@/lib/format";
import { isDrawn, planCapacity, planSeatLabel, rowLetter, seatId, type SeatSection } from "@/lib/seating";
import type { LayoutSeat, RoomLayout } from "@/lib/roomLayout";
import RoomPlanView from "@/components/RoomPlanView";
import PlanEditorModal from "@/components/PlanEditorModal";
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
  const search = useSearchParams();
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (search.get("edit")) {
      setEditing(true);
      window.history.replaceState(null, "", `/seating/${planId}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Réservation par les fidèles : publication, ouverture des ventes, plafond.
  async function setSales(patch: { published?: boolean; salesOpen?: boolean; maxPerDonor?: number; isBase?: boolean }) {
    setBusy(true);
    setMessage("");
    const res = await fetch(`/api/seating/${planId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) setMessage(d.error || "Modification impossible.");
    setBusy(false);
    await load();
  }

  async function saveLayout(layout: RoomLayout, sections: SeatSection[]): Promise<string | null> {
    const res = await fetch(`/api/seating/${planId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ layout, sections }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return d.error || "Enregistrement impossible.";
    await load();
    return null;
  }

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

  const capacity = planCapacity(plan);
  const drawn = isDrawn(plan);
  const label = (s: { sectionId: string; row: number; seat: number }) => planSeatLabel(plan, s.sectionId, s.row, s.seat);
  const lookOf = (s: LayoutSeat) => {
    const taken = byId.get(seatId(planId, s.sectionId, s.rowNum, s.k + 1));
    const isSel = selected.some((x) => x.sectionId === s.sectionId && x.row === s.rowNum && x.seat === s.k + 1);
    const hl = !!(highlight && taken && taken.donorName.toLowerCase().includes(highlight.toLowerCase()));
    const sec = plan.sections.find((x: any) => x.id === s.sectionId);
    const name = `${s.letter}${s.number}`;
    if (isSel) return { fill: "#b8893a", stroke: "#8a6633", text: s.number, textColor: "#fff", title: `${name} · sélectionnée`, ring: hl };
    if (taken?.pending) return { fill: "#ede9fe", stroke: "#7c3aed", text: s.number, textColor: "#4c1d95", title: `${name} · ${taken.donorName} · paiement en ligne en cours (pas encore réservée)`, ring: hl };
    if (taken)
      return taken.remaining > 0
        ? { fill: "#fef3c7", stroke: "#f59e0b", text: s.number, textColor: "#78350f", title: `${name} · ${taken.donorName} · à régler`, ring: hl }
        : { fill: "#dcfce7", stroke: "#22c55e", text: s.number, textColor: "#14532d", title: `${name} · ${taken.donorName}`, ring: hl };
    return { fill: "#ffffff", stroke: "#9ca3af", text: s.number, textColor: "#374151", title: `${name} · libre${sec ? ` · ${sec.name}${sec.price > 0 ? ` ${formatEUR(sec.price)}` : ""}` : ""}` };
  };
  const locked: Record<string, string> = {};
  if (drawn) for (const s of seats) locked[`${s.row}:${s.seat - 1}`] = s.donorName;
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
          {drawn && <button className="btn-secondary" onClick={() => setEditing(true)}>Modifier le plan de salle</button>}
          {drawn && plan.layout && (plan.isBase
            ? <button className="btn-secondary" disabled={busy} title="Les nouveaux plans ne partiront plus de celui-ci" onClick={() => setSales({ isBase: false })}>★ Plan de base (retirer)</button>
            : <button className="btn-secondary" disabled={busy} title="Les nouveaux plans partiront d'une copie de celui-ci" onClick={() => setSales({ isBase: true })}>Définir comme plan de base</button>)}
          {!drawn && seats.length === 0 && <button className="btn-secondary" onClick={() => setEditing(true)}>Dessiner le plan de salle</button>}
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
                <strong>{label(focus)}</strong> :{" "}
                <Link href={`/donors/${focus.donorId}`} className="text-gold hover:underline tap">{focus.donorName}</Link>
                {focus.pledgeId ? (focus.remaining > 0 ? ` · reste ${formatEUR(focus.remaining)}` : " · réglée") : " · offerte"}
                {focus.pending ? " · paiement en ligne en cours, pas encore réservée (remise en vente si rien n'est payé)" : ""}
                {focus.confirmedAt ? " · confirmée" : ""}
              </p>
              <button className="text-red-600 text-sm hover:underline tap" onClick={() => release(focus.id)}>Libérer</button>
            </div>
          ) : (
            <>
              <p className="text-sm">
                {selected.length} place(s) :{" "}
                {selected.map(label).join(", ")}
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
                  {drawn ? "Facturer au tarif de la rangée" : "Facturer au tarif de la section"}
                </label>
                <button className="btn-gold" disabled={busy || !donorId} onClick={assign}>Attribuer</button>
                <button className="btn-secondary" onClick={() => setSelected([])}>Annuler</button>
              </div>
            </>
          )}
        </div>
      )}

      {drawn && plan.layout && (
        <div className="card p-4 space-y-3 print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-ink">Réservation par les fidèles</h2>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${plan.salesOpen ? "bg-green-100 text-green-800" : plan.published ? "bg-amber-100 text-amber-900" : "bg-gray-100 text-gray-700"}`}>
              {plan.salesOpen ? "Ventes ouvertes" : plan.published ? "Publié, ventes fermées" : "Non publié"}
            </span>
          </div>
          <p className="text-sm text-gray-600">
            {plan.salesOpen
              ? "Tout le monde peut choisir ses places sur la page publique /places, sans compte : le nom et l'e-mail sont demandés à la fin, et la fiche du fidèle est créée. Chaque place crée une somme due au tarif de sa rangée."
              : plan.published
                ? "Le plan est visible sur la page publique /places, sans pouvoir réserver. Ouvrez les ventes quand vous êtes prêt."
                : "Le plan n'est visible que par l'équipe. Publiez-le pour le montrer aux fidèles, puis ouvrez les ventes."}
          </p>
          <div className="flex flex-wrap items-end gap-2">
            {!plan.published && <button className="btn-gold" disabled={busy} onClick={() => setSales({ published: true })}>Publier le plan</button>}
            {plan.published && !plan.salesOpen && <button className="btn-gold" disabled={busy} onClick={() => setSales({ salesOpen: true })}>Ouvrir les ventes</button>}
            {plan.salesOpen && <button className="btn-secondary" disabled={busy} onClick={() => setSales({ salesOpen: false })}>Fermer les ventes</button>}
            {plan.published && <button className="btn-secondary" disabled={busy} onClick={() => setSales({ published: false, salesOpen: false })}>Retirer de la page publique</button>}
            {plan.published && <a href="/places" target="_blank" rel="noreferrer" className="btn-secondary">Voir la page publique</a>}
            <div>
              <label htmlFor="maxPerDonor" className="text-xs text-gray-500 block">Places au plus par famille</label>
              <input
                id="maxPerDonor"
                type="number"
                min={1}
                max={50}
                className="input w-28"
                defaultValue={plan.maxPerDonor || 6}
                onBlur={(e) => {
                  const v = Number(e.target.value);
                  if (v >= 1 && v !== (plan.maxPerDonor || 6)) setSales({ maxPerDonor: v });
                }}
              />
            </div>
          </div>
          <p className="text-xs text-gray-500">En ligne, une place payante n'est réservée qu'une fois payée : elle est gardée 20 minutes le temps du paiement, puis remise en vente si rien n'est réglé. Une place gratuite est réservée aussitôt. Les places que vous attribuez vous-même ne sont jamais libérées.</p>
        </div>
      )}

      {drawn && (
        <div className="card p-4 space-y-3">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
            {plan.sections.map((s: any) => (
              <span key={s.id}><strong className="text-ink">{s.name}</strong> : {s.price > 0 ? `${formatEUR(s.price)} la place` : "gratuit"}</span>
            ))}
          </div>
          {plan.layout ? (
            <RoomPlanView layout={plan.layout} look={lookOf} onSeat={(s) => click(s.sectionId, s.rowNum, s.k + 1)} />
          ) : (
            <div className="text-sm text-gray-600 space-y-2">
              <p>Ce plan n'est pas encore dessiné.</p>
              <button className="btn-gold" onClick={() => setEditing(true)}>Dessiner le plan de salle</button>
            </div>
          )}
        </div>
      )}

      {editing && (
        <PlanEditorModal
          name={plan.name}
          layout={plan.layout || null}
          sections={plan.sections}
          locked={locked}
          onSave={saveLayout}
          onClose={() => setEditing(false)}
        />
      )}

      {!drawn && plan.sections.map((sec: any) => (
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
        <span><span className="inline-block w-3 h-3 bg-violet-100 border border-violet-600 align-middle mr-1" />Paiement en ligne en cours</span>
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
