"use client";

import { useEffect, useRef, useState } from "react";
import RoomPlanView from "@/components/RoomPlanView";
import { formatEUR } from "@/lib/format";
import type { LayoutSeat } from "@/lib/roomLayout";

// Choix des places sur le plan publié. Aucun compte n'est demandé pour
// choisir : le nom et l'e-mail ne sont saisis qu'à la validation (la fiche
// du fidèle est alors créée ou retrouvée). Les places des autres familles
// apparaissent occupées, sans nom.
const HOLD = 20; // minutes de garde d'une place payante (HOLD_MINUTES côté serveur)
type Sel = { row: number; seat: number; label: string; price: number };

export default function SeatPicker() {
  const [data, setData] = useState<any>(null);
  const [planId, setPlanId] = useState("");
  const [selected, setSelected] = useState<Sel[]>([]);
  const [step, setStep] = useState<"choose" | "identify">("choose");
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<any>(null);
  const [info, setInfo] = useState("");
  const [redirecting, setRedirecting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function load() {
    const res = await fetch("/api/public/seating");
    const d = await res.json().catch(() => ({ plans: [] }));
    setData(d);
    setPlanId((cur) => (d.plans?.some((p: any) => p.id === cur) ? cur : d.plans?.[0]?.id || ""));
  }

  useEffect(() => {
    load();
    const q = new URLSearchParams(window.location.search);
    if (q.get("annule")) setError("Paiement interrompu : vos places n'ont pas été réservées et sont de nouveau libres. Vous pouvez recommencer.");
    if (q.get("expire")) setError("Le délai de paiement est dépassé : ces places n'ont pas été réservées. Vous pouvez les choisir de nouveau si elles sont encore libres.");
    if (q.get("annule") || q.get("expire")) window.history.replaceState(null, "", "/places");
  }, []);

  if (!data) return <div className="card p-6 text-sm text-gray-500">Chargement du plan…</div>;
  const plan = data.plans.find((p: any) => p.id === planId);
  if (!plan) return <div className="card p-6 text-sm text-gray-600">Aucun plan n'est ouvert à la réservation pour le moment.</div>;

  const taken = new Set<string>(plan.taken);
  const mine = new Map<string, any>(plan.mine.map((m: any) => [`${m.row}:${m.seat}`, m]));
  const priceOf = (sectionId: string) => plan.sections.find((s: any) => s.id === sectionId)?.price || 0;
  const left = plan.max - plan.mine.length - selected.length;
  const total = selected.reduce((s, x) => s + x.price, 0);
  const bookLabel = total > 0 ? `Payer ${formatEUR(total)} pour réserver` : "Réserver ces places";
  const payNote = total > 0 ? `Une place payante n'est réservée qu'une fois payée. Vos places sont gardées ${HOLD} minutes le temps du paiement, puis remises en vente si rien n'est réglé.` : "";
  const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const pendingMine = plan.mine.filter((m: any) => m.pending);
  const isSel = (s: LayoutSeat) => selected.some((x) => x.row === s.rowNum && x.seat === s.k + 1);

  function look(s: LayoutSeat) {
    const key = `${s.rowNum}:${s.k + 1}`;
    const label = `${s.letter}${s.number}`;
    const price = priceOf(s.sectionId);
    if (mine.get(key)?.pending) return { fill: "#ede9fe", stroke: "#7c3aed", text: s.number, textColor: "#4c1d95", title: `${label} · en attente de votre paiement` };
    if (mine.has(key)) return { fill: "#dcfce7", stroke: "#16a34a", text: s.number, textColor: "#14532d", title: `${label} · votre place` };
    if (taken.has(key)) return { fill: "#d1d5db", stroke: "#9ca3af", text: s.number, textColor: "#6b7280", title: `${label} · occupée` };
    if (isSel(s)) return { fill: "#b8893a", stroke: "#8a6633", text: s.number, textColor: "#fff", title: `${label} · sélectionnée` };
    return { fill: "#ffffff", stroke: "#6b7280", text: s.number, textColor: "#1f2937", title: `${label} · libre · ${price > 0 ? formatEUR(price) : "gratuit"}` };
  }

  function click(s: LayoutSeat) {
    const key = `${s.rowNum}:${s.k + 1}`;
    setError("");
    setInfo("");
    setDone(null);
    if (mine.has(key) || taken.has(key)) return;
    if (!plan.salesOpen) return setError("Les réservations ne sont pas encore ouvertes pour ce plan.");
    if (!isSel(s) && left <= 0) return setError(`Une famille peut réserver ${plan.max} place(s) au plus sur ce plan. Contactez la synagogue pour davantage.`);
    setSelected((prev) => (isSel(s) ? prev.filter((x) => !(x.row === s.rowNum && x.seat === s.k + 1)) : [...prev, { row: s.rowNum, seat: s.k + 1, label: `${s.letter}${s.number}`, price: priceOf(s.sectionId) }]));
  }

  function next() {
    if (data.signedIn) return book();
    setStep("identify");
    setTimeout(() => formRef.current?.querySelector("input")?.focus(), 50);
  }

  async function book(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch(`/api/public/seating/${plan.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seats: selected.map(({ row, seat }) => ({ row, seat })), ...form }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(d.error || "Réservation impossible.");
      // Place prise entre-temps : on revient au plan, à jour.
      if (res.status === 409) {
        setSelected([]);
        setStep("choose");
      }
    } else if (d.total > 0 && d.payUrl) {
      // Place payante : réservée seulement une fois payée, on part au paiement.
      setRedirecting(true);
      window.location.href = d.payUrl;
      return;
    } else {
      setDone({ ...d, email: form.email });
      setSelected([]);
      setStep("choose");
    }
    await load();
  }

  async function release(m: any) {
    setBusy(true);
    setError("");
    setInfo("");
    const res = await fetch(`/api/espace/seating/${plan.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seatId: m.id }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) setError(d.error || "Impossible de rendre cette place.");
    else setInfo(`Place ${m.label} rendue.`);
    await load();
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <>
      {data.plans.length > 1 && (
        <div className="card p-4">
          <label htmlFor="plan" className="label">Plan</label>
          <select id="plan" className="input" value={planId} onChange={(e) => { setPlanId(e.target.value); setSelected([]); setStep("choose"); setError(""); setDone(null); }}>
            {data.plans.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      )}

      <div className="card p-4 space-y-2">
        <h2 className="font-semibold text-ink">{plan.name}</h2>
        <p className="text-sm text-gray-600">
          {plan.salesOpen
            ? `Touchez les places libres que vous souhaitez (${plan.max} au plus), puis validez. Aucun compte n'est nécessaire : votre e-mail vous sera demandé à la fin. Une place payante est réservée une fois payée en ligne.`
            : "Les réservations ne sont pas encore ouvertes. Vous pouvez déjà consulter le plan."}
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
          {plan.sections.map((s: any) => (
            <span key={s.id}><strong className="text-ink">{s.name}</strong> : {s.price > 0 ? `${formatEUR(s.price)} la place` : "gratuit"}</span>
          ))}
        </div>
      </div>

      {redirecting && <p role="status" className="card p-4 text-sm text-gray-700">Places gardées {HOLD} minutes. Ouverture du paiement sécurisé…</p>}
      {pendingMine.length > 0 && !redirecting && (
        <div role="status" className="card p-5 space-y-3 text-sm border-l-4 border-violet-600">
          <p className="font-semibold text-ink">Pas encore réservée(s) : {pendingMine.map((m: any) => m.label).join(", ")}.</p>
          <p className="text-gray-700">Ces places sont gardées jusqu'à {hhmm(pendingMine[0].holdUntil)} dans l'attente de votre paiement, puis remises en vente.</p>
          {data.balanceUrl && <a href={data.balanceUrl} className="btn-gold w-full sm:w-auto">Payer {formatEUR(data.due)} pour réserver</a>}
        </div>
      )}
      {error && <p role="alert" className="card p-4 text-sm text-red-700">{error}</p>}
      {info && <p role="status" className="card p-4 text-sm text-green-800">{info}</p>}

      {done && (
        <div role="status" className="card p-5 space-y-3 text-sm border-l-4 border-green-600">
          <p className="font-semibold text-green-800">Place(s) réservée(s) : {done.booked.join(", ")}.</p>
          {done.emailed
            ? <p className="text-gray-700">Un e-mail récapitulatif vous a été envoyé{done.email ? ` à ${done.email}` : ""}, avec l'accès à votre espace fidèle. Pensez à vérifier vos indésirables.</p>
            : <p className="text-gray-700">L'e-mail récapitulatif n'a pas pu être envoyé. Notez vos places et contactez la synagogue en cas de besoin.</p>}
          {done.created && <p className="text-gray-700">Votre espace fidèle vient d'être créé : <a href="/espace" className="text-gold hover:underline tap">ouvrir mon espace</a>.</p>}
        </div>
      )}

      {selected.length > 0 && step === "choose" && (
        <div className="card p-4 space-y-3 [@media(min-height:560px)]:sticky top-2 z-20">
          <p className="text-sm">
            <strong>{selected.length} place(s)</strong> : {selected.map((s) => s.label).join(", ")} · {total > 0 ? formatEUR(total) : "gratuit"}
          </p>
          <div className="flex flex-wrap gap-2">
            <button className="btn-gold" disabled={busy} onClick={next}>{data.signedIn ? (busy ? "Un instant…" : bookLabel) : "Continuer"}</button>
            <button className="btn-secondary" disabled={busy} onClick={() => setSelected([])}>Tout désélectionner</button>
          </div>
          {payNote && <p className="text-xs text-gray-600">{payNote}</p>}
        </div>
      )}

      {selected.length > 0 && step === "identify" && (
        <form ref={formRef} onSubmit={book} className="card p-5 space-y-4 border-l-4 border-gold-sand">
          <div>
            <h2 className="font-semibold text-ink">Vos coordonnées</h2>
            <p className="text-sm text-gray-600 mt-1">
              {selected.length} place(s) : {selected.map((s) => s.label).join(", ")} · {total > 0 ? formatEUR(total) : "gratuit"}. Votre espace fidèle est créé avec cet e-mail (ou retrouvé s'il existe déjà).
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="pl-prenom" className="label">Prénom</label>
              <input id="pl-prenom" required autoComplete="given-name" className="input" value={form.firstName} onChange={set("firstName")} />
            </div>
            <div>
              <label htmlFor="pl-nom" className="label">Nom</label>
              <input id="pl-nom" required autoComplete="family-name" className="input" value={form.lastName} onChange={set("lastName")} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="pl-email" className="label">E-mail</label>
              <input id="pl-email" type="email" required autoComplete="email" className="input" value={form.email} onChange={set("email")} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn-gold" disabled={busy}>{busy ? "Un instant…" : bookLabel}</button>
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => setStep("choose")}>Modifier mon choix</button>
          </div>
          {payNote && <p className="text-xs text-gray-600">{payNote}</p>}
        </form>
      )}

      <div className="card p-4 space-y-3">
        <div className="overflow-x-auto">
          <RoomPlanView layout={plan.layout} look={look} onSeat={step === "choose" ? click : undefined} />
        </div>
        <div className="flex flex-wrap gap-4 text-xs text-gray-600">
          <span><span className="inline-block w-3 h-3 border border-gray-500 bg-white align-middle mr-1" />Libre</span>
          <span><span className="inline-block w-3 h-3 bg-gold align-middle mr-1" />Sélectionnée</span>
          <span><span className="inline-block w-3 h-3 bg-green-100 border border-green-600 align-middle mr-1" />Votre place</span>
          {pendingMine.length > 0 && <span><span className="inline-block w-3 h-3 bg-violet-100 border border-violet-600 align-middle mr-1" />En attente de votre paiement</span>}
          <span><span className="inline-block w-3 h-3 bg-gray-300 border border-gray-400 align-middle mr-1" />Occupée</span>
        </div>
      </div>

      {plan.mine.length > 0 && (
        <div className="card">
          <div className="p-4 border-b"><h2 className="font-semibold text-ink">Mes places</h2></div>
          <div className="divide-y">
            {plan.mine.map((m: any) => (
              <div key={m.id} className="p-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
                <span className="font-medium text-ink">Place {m.label}</span>
                <span className="flex items-center gap-3">
                  <span className={m.remaining > 0 ? "text-amber-700" : "text-green-700"}>{m.pending ? "en attente de paiement, pas encore réservée" : m.remaining > 0 ? `reste ${formatEUR(m.remaining)}` : "réglée ou offerte"}</span>
                  {m.canRelease && plan.salesOpen && <button className="tap text-red-600 hover:underline" disabled={busy} onClick={() => release(m)}>Rendre</button>}
                </span>
              </div>
            ))}
          </div>
          {data.due > 0 && data.balanceUrl && !done && pendingMine.length === 0 && (
            <div className="p-4 border-t"><a href={data.balanceUrl} className="btn-gold w-full sm:w-auto">Régler {formatEUR(data.due)} en ligne</a></div>
          )}
        </div>
      )}
    </>
  );
}
