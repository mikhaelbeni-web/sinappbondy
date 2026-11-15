"use client";

import { useEffect, useState } from "react";
import PublicPage from "@/components/PublicPage";
import RoomPlanView from "@/components/RoomPlanView";
import { formatEUR } from "@/lib/format";
import type { LayoutSeat } from "@/lib/roomLayout";

// Espace fidèle : choisir ses places sur le plan publié, une fois les ventes
// ouvertes. Les places des autres familles apparaissent occupées, sans nom.
export default function EspacePlacesPage() {
  const [data, setData] = useState<any>(null);
  const [state, setState] = useState<"loading" | "anon" | "ready">("loading");
  const [planId, setPlanId] = useState("");
  const [selected, setSelected] = useState<{ row: number; seat: number; label: string; price: number }[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [payUrl, setPayUrl] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/espace/seating");
    if (res.status === 401) return setState("anon");
    const d = await res.json();
    setData(d);
    setPlanId((cur) => (d.plans?.some((p: any) => p.id === cur) ? cur : d.plans?.[0]?.id || ""));
    setState("ready");
  }

  useEffect(() => {
    load();
  }, []);

  const name = process.env.NEXT_PUBLIC_SYNAGOGUE_NAME || "Synagogue";
  const back = <a href="/espace" className="tap text-sm text-white/80 hover:text-white shrink-0">← Mon espace</a>;

  if (state === "loading") return <div className="min-h-screen flex items-center justify-center bg-cream text-gray-500">Chargement…</div>;
  if (state === "anon") {
    return (
      <PublicPage title="Places des fêtes" subtitle={name}>
        <div className="card p-6 space-y-3 text-sm text-gray-700">
          <p>Connectez-vous à votre espace fidèle pour choisir vos places.</p>
          <a href="/espace" className="btn-gold w-full">Me connecter</a>
        </div>
      </PublicPage>
    );
  }

  const plan = data.plans.find((p: any) => p.id === planId);
  if (!plan) {
    return (
      <PublicPage title="Places des fêtes" subtitle={name} aside={back}>
        <div className="card p-6 text-sm text-gray-600">Aucun plan n'est publié pour le moment.</div>
      </PublicPage>
    );
  }

  const taken = new Set<string>(plan.taken);
  const mine = new Map<string, any>(plan.mine.map((m: any) => [`${m.row}:${m.seat}`, m]));
  const priceOf = (sectionId: string) => plan.sections.find((s: any) => s.id === sectionId)?.price || 0;
  const left = plan.max - plan.mine.length - selected.length;
  const total = selected.reduce((s, x) => s + x.price, 0);

  function look(s: LayoutSeat) {
    const key = `${s.rowNum}:${s.k + 1}`;
    const label = `${s.letter}${s.number}`;
    const price = priceOf(s.sectionId);
    if (mine.has(key)) return { fill: "#dcfce7", stroke: "#16a34a", text: s.number, textColor: "#14532d", title: `${label} · votre place` };
    if (taken.has(key)) return { fill: "#d1d5db", stroke: "#9ca3af", text: s.number, textColor: "#6b7280", title: `${label} · occupée` };
    if (selected.some((x) => x.row === s.rowNum && x.seat === s.k + 1)) return { fill: "#b8893a", stroke: "#8a6633", text: s.number, textColor: "#fff", title: `${label} · sélectionnée` };
    return { fill: "#ffffff", stroke: "#6b7280", text: s.number, textColor: "#1f2937", title: `${label} · libre · ${price > 0 ? formatEUR(price) : "gratuit"}` };
  }

  function click(s: LayoutSeat) {
    const key = `${s.rowNum}:${s.k + 1}`;
    setError("");
    setMessage("");
    if (mine.has(key) || taken.has(key)) return;
    if (!plan.salesOpen) return setError("Les réservations ne sont pas encore ouvertes pour ce plan.");
    const isSel = selected.some((x) => x.row === s.rowNum && x.seat === s.k + 1);
    if (!isSel && left <= 0) return setError(`Vous pouvez réserver ${plan.max} place(s) au plus sur ce plan. Contactez la synagogue pour davantage.`);
    setSelected((prev) => (isSel ? prev.filter((x) => !(x.row === s.rowNum && x.seat === s.k + 1)) : [...prev, { row: s.rowNum, seat: s.k + 1, label: `${s.letter}${s.number}`, price: priceOf(s.sectionId) }]));
  }

  async function book() {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/espace/seating/${plan.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seats: selected.map(({ row, seat }) => ({ row, seat })) }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) setError(d.error || "Réservation impossible.");
    else {
      setMessage(`Place(s) réservée(s) : ${d.booked.join(", ")}.`);
      setPayUrl(d.payUrl || null);
    }
    setSelected([]);
    await load();
  }

  async function release(m: any) {
    setBusy(true);
    setError("");
    setMessage("");
    const res = await fetch(`/api/espace/seating/${plan.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seatId: m.id }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) setError(d.error || "Impossible de rendre cette place.");
    else setMessage(`Place ${m.label} rendue.`);
    await load();
  }

  const url = payUrl || data.balanceUrl;

  return (
    <PublicPage width="max-w-4xl" title="Places des fêtes" subtitle={name} aside={back}>
      {data.plans.length > 1 && (
        <div className="card p-4">
          <label htmlFor="plan" className="label">Plan</label>
          <select id="plan" className="input" value={planId} onChange={(e) => { setPlanId(e.target.value); setSelected([]); setError(""); setMessage(""); }}>
            {data.plans.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      )}

      <div className="card p-4 space-y-2">
        <h2 className="font-semibold text-ink">{plan.name}</h2>
        <p className="text-sm text-gray-600">
          {plan.salesOpen
            ? `Touchez les places libres que vous souhaitez, puis validez. Vous pouvez en réserver ${plan.max} au plus.`
            : "Les réservations ne sont pas encore ouvertes. Vous pouvez déjà consulter le plan."}
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
          {plan.sections.map((s: any) => (
            <span key={s.id}><strong className="text-ink">{s.name}</strong> : {s.price > 0 ? `${formatEUR(s.price)} la place` : "gratuit"}</span>
          ))}
        </div>
      </div>

      {error && <p role="alert" className="card p-4 text-sm text-red-700">{error}</p>}
      {message && (
        <div role="status" className="card p-4 space-y-3 text-sm text-green-800">
          <p>{message}</p>
          {url && data.due > 0 && <a href={url} className="btn-gold w-full sm:w-auto">Régler {formatEUR(data.due)} en ligne</a>}
        </div>
      )}

      {selected.length > 0 && (
        <div className="card p-4 space-y-3 [@media(min-height:560px)]:sticky top-2 z-20">
          <p className="text-sm">
            <strong>{selected.length} place(s)</strong> : {selected.map((s) => s.label).join(", ")} · {total > 0 ? formatEUR(total) : "gratuit"}
          </p>
          <div className="flex flex-wrap gap-2">
            <button className="btn-gold" disabled={busy} onClick={book}>{busy ? "Réservation…" : "Réserver ces places"}</button>
            <button className="btn-secondary" disabled={busy} onClick={() => setSelected([])}>Annuler</button>
          </div>
        </div>
      )}

      <div className="card p-4 space-y-3">
        <div className="overflow-x-auto">
          <RoomPlanView layout={plan.layout} look={look} onSeat={click} />
        </div>
        <div className="flex flex-wrap gap-4 text-xs text-gray-600">
          <span><span className="inline-block w-3 h-3 border border-gray-500 bg-white align-middle mr-1" />Libre</span>
          <span><span className="inline-block w-3 h-3 bg-gold align-middle mr-1" />Sélectionnée</span>
          <span><span className="inline-block w-3 h-3 bg-green-100 border border-green-600 align-middle mr-1" />Votre place</span>
          <span><span className="inline-block w-3 h-3 bg-gray-300 border border-gray-400 align-middle mr-1" />Occupée</span>
        </div>
      </div>

      <div className="card">
        <div className="p-4 border-b"><h2 className="font-semibold text-ink">Mes places</h2></div>
        <div className="divide-y">
          {plan.mine.length === 0 && <p className="p-4 text-sm text-gray-500">Vous n'avez pas encore de place sur ce plan.</p>}
          {plan.mine.map((m: any) => (
            <div key={m.id} className="p-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
              <span className="font-medium text-ink">Place {m.label}</span>
              <span className="flex items-center gap-3">
                <span className={m.remaining > 0 ? "text-amber-700" : "text-green-700"}>{m.remaining > 0 ? `reste ${formatEUR(m.remaining)}` : "réglée ou offerte"}</span>
                {m.canRelease && plan.salesOpen && <button className="tap text-red-600 hover:underline" disabled={busy} onClick={() => release(m)}>Rendre</button>}
              </span>
            </div>
          ))}
        </div>
        {data.due > 0 && url && !message && (
          <div className="p-4 border-t"><a href={url} className="btn-gold w-full sm:w-auto">Régler {formatEUR(data.due)} en ligne</a></div>
        )}
      </div>
    </PublicPage>
  );
}
