"use client";

import { useEffect, useState } from "react";
import { SALON_STATUS_LABELS, type KiddushSettings } from "@/lib/kiddush";
import { formatEUR } from "@/lib/format";

type Msg = { ok: boolean; text: string } | null;

const frDate = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

// Back-office, menu Kiddouch & salons : prix et textes des pages publiques
// /kiddouch et /salons, Chabbatot parrainés, demandes de salon à traiter.
export default function KiddushAdminTab() {
  const [s, setS] = useState<KiddushSettings | null>(null);
  const [sponsors, setSponsors] = useState<any[]>([]);
  const [salons, setSalons] = useState<any[]>([]);
  const [message, setMessage] = useState<Msg>(null);
  const [listMessage, setListMessage] = useState<Msg>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState("");

  async function load() {
    const res = await fetch("/api/kiddush");
    const d = await res.json();
    if (!res.ok) return setMessage({ ok: false, text: d.error || "Chargement impossible." });
    setS(d.settings);
    setSponsors(d.sponsors || []);
    setSalons(d.salons || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    if (!s) return;
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/kiddush", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(s) });
    const d = await res.json();
    if (res.ok) setS(d.settings);
    setMessage(res.ok ? { ok: true, text: "Enregistré : les pages Kiddouch et Salons sont à jour." } : { ok: false, text: d.error });
    setSaving(false);
  }

  async function answer(id: string, status: string) {
    setBusy(id);
    setListMessage(null);
    const res = await fetch("/api/kiddush", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) });
    const d = await res.json();
    setListMessage(
      res.ok
        ? { ok: true, text: d.emailed ? "Réponse enregistrée, le demandeur a été prévenu par e-mail." : "Réponse enregistrée. L'e-mail n'est pas parti : prévenez le demandeur par téléphone." }
        : { ok: false, text: d.error }
    );
    setBusy("");
    if (res.ok) load();
  }

  async function release(sp: any) {
    if (!window.confirm(`Libérer « ${sp.optionLabel} » du ${frDate(sp.date)} (${sp.donorName}) ? La somme due non réglée sera annulée.`)) return;
    setBusy(sp.id);
    setListMessage(null);
    const res = await fetch(`/api/kiddush?id=${encodeURIComponent(sp.id)}`, { method: "DELETE" });
    const d = await res.json();
    setListMessage(res.ok ? { ok: true, text: "Chabbat libéré : il est de nouveau proposé sur le portail." } : { ok: false, text: d.error });
    setBusy("");
    if (res.ok) load();
  }

  const note = (m: Msg) =>
    m && (
      <p role={m.ok ? "status" : "alert"} className={`text-sm rounded-xl px-3 py-2 ${m.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>
        {m.text}
      </p>
    );

  if (!s) return message ? note(message) : <p className="text-gray-500">Chargement…</p>;

  const setOption = (i: number, k: "label" | "price", v: string) =>
    setS({ ...s, options: s.options.map((o, j) => (j === i ? { ...o, [k]: k === "price" ? Number(v) || 0 : v } : o)) });
  const today = new Date().toISOString().slice(0, 10);
  const pending = salons.filter((r) => r.status === "nouvelle");

  return (
    <div className="space-y-4">
      {/* Demandes de salon */}
      <div className="card p-4 space-y-3">
        <h2 className="font-semibold text-ink">
          Demandes de salon {pending.length > 0 && <span className="ml-1 rounded-full bg-gold-sand/40 px-2 py-0.5 text-xs">{pending.length} à traiter</span>}
        </h2>
        {note(listMessage)}
        {salons.length === 0 ? (
          <p className="text-sm text-gray-600">Aucune demande pour le moment.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {salons.map((r) => (
              <li key={r.id} className="py-3 flex flex-col sm:flex-row sm:items-start gap-3">
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-semibold text-ink first-letter:uppercase">
                    {frDate(r.date)} · {r.eventType} · {r.guests} invités
                  </p>
                  <p className="text-gray-700 break-words">
                    {r.name} · <a className="underline" href={`tel:${String(r.phone).replace(/\s/g, "")}`}>{r.phone}</a> ·{" "}
                    <a className="underline" href={`mailto:${r.email}`}>{r.email}</a>
                  </p>
                  {r.message && <p className="text-gray-600 mt-1 whitespace-pre-line break-words">{r.message}</p>}
                  <p className="text-xs text-gray-500 mt-1">{SALON_STATUS_LABELS[r.status] || r.status}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  {r.status !== "confirmee" && (
                    <button type="button" className="btn-primary" disabled={busy === r.id} onClick={() => answer(r.id, "confirmee")}>Confirmer</button>
                  )}
                  {r.status !== "refusee" && (
                    <button type="button" className="btn-secondary" disabled={busy === r.id} onClick={() => answer(r.id, "refusee")}>Refuser</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Chabbatot parrainés */}
      <div className="card p-4 space-y-3">
        <h2 className="font-semibold text-ink">Chabbatot parrainés</h2>
        <p className="text-sm text-gray-600">Un Chabbat payant n'est réservé qu'une fois payé en ligne. Le paiement apparaît dans Encaissements.</p>
        {sponsors.length === 0 ? (
          <p className="text-sm text-gray-600">Aucun parrainage pour le moment.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {sponsors.map((sp) => (
              <li key={sp.id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-semibold text-ink first-letter:uppercase">
                    {frDate(sp.date)} · {sp.parasha}
                  </p>
                  <p className="text-gray-700 break-words">
                    {sp.optionLabel} ({sp.price > 0 ? formatEUR(sp.price) : "sur devis"}) · {sp.donorName}
                  </p>
                  {sp.dedication && <p className="text-gray-600 break-words">{sp.dedication}</p>}
                  <p className={`text-xs mt-1 ${sp.pending ? "text-amber-700" : "text-green-700"}`}>
                    {sp.pending ? "En attente de paiement : gardé quelques minutes, libéré automatiquement sans paiement" : sp.price > 0 ? "Payé, réservé" : "Réservé (sur devis)"}
                  </p>
                </div>
                {sp.date >= today && (
                  <button type="button" className="btn-secondary shrink-0" disabled={busy === sp.id} onClick={() => release(sp)}>Libérer</button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Réglages kiddouch */}
      <div className="card p-4 space-y-4">
        <h2 className="font-semibold text-ink">Parrainage du kiddouch (page /kiddouch)</h2>
        <label className="flex items-center gap-2 text-sm tap">
          <input type="checkbox" checked={s.enabled} onChange={(e) => setS({ ...s, enabled: e.target.checked })} />
          Parrainage en ligne ouvert
        </label>
        <div>
          <label className="label" htmlFor="kid-intro">Texte de présentation</label>
          <textarea id="kid-intro" className="input" rows={3} value={s.intro} onChange={(e) => setS({ ...s, intro: e.target.value })} />
        </div>
        <fieldset className="space-y-2">
          <legend className="label">Formules et prix (0 € = sur devis, sans règlement en ligne)</legend>
          {s.options.map((o, i) => (
            <div key={o.key} className="flex flex-col sm:flex-row gap-2">
              <input aria-label={`Nom de la formule ${i + 1}`} className="input flex-1" value={o.label} onChange={(e) => setOption(i, "label", e.target.value)} />
              <div className="flex gap-2">
                <input aria-label={`Prix de la formule ${i + 1} en euros`} type="number" min={0} step="1" inputMode="decimal" className="input w-28" value={o.price} onChange={(e) => setOption(i, "price", e.target.value)} />
                <button type="button" className="btn-secondary" onClick={() => setS({ ...s, options: s.options.filter((_, j) => j !== i) })}>Retirer</button>
              </div>
            </div>
          ))}
          {s.options.length < 6 && (
            <button type="button" className="btn-secondary" onClick={() => setS({ ...s, options: [...s.options, { key: `f${Date.now().toString(36)}`, label: "Nouvelle formule", price: 0 }] })}>
              Ajouter une formule
            </button>
          )}
        </fieldset>
        <div className="max-w-xs">
          <label className="label" htmlFor="kid-weeks">Nombre de semaines proposées</label>
          <input id="kid-weeks" type="number" min={4} max={60} className="input" value={s.weeksAhead} onChange={(e) => setS({ ...s, weeksAhead: Number(e.target.value) || 26 })} />
        </div>
      </div>

      {/* Réglages salons */}
      <div className="card p-4 space-y-4">
        <h2 className="font-semibold text-ink">Réservation des salons (page /salons)</h2>
        <label className="flex items-center gap-2 text-sm tap">
          <input type="checkbox" checked={s.salonsEnabled} onChange={(e) => setS({ ...s, salonsEnabled: e.target.checked })} />
          Demandes en ligne ouvertes
        </label>
        <div>
          <label className="label" htmlFor="sal-intro">Texte de présentation</label>
          <textarea id="sal-intro" className="input" rows={3} value={s.salonsIntro} onChange={(e) => setS({ ...s, salonsIntro: e.target.value })} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="sal-cap">Capacité affichée</label>
            <input id="sal-cap" className="input" value={s.salonsCapacity} onChange={(e) => setS({ ...s, salonsCapacity: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="sal-mail">E-mail qui reçoit les demandes (vide = e-mail du portail)</label>
            <input id="sal-mail" type="email" autoComplete="email" className="input" value={s.notifyEmail} onChange={(e) => setS({ ...s, notifyEmail: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="sal-types">Types d'événement (un par ligne)</label>
          <textarea
            id="sal-types"
            className="input"
            rows={5}
            value={s.salonEventTypes.join("\n")}
            onChange={(e) => setS({ ...s, salonEventTypes: e.target.value.split("\n") })}
          />
        </div>
      </div>

      {note(message)}
      <button type="button" className="btn-primary" disabled={saving} onClick={save}>
        {saving ? "Enregistrement…" : "Enregistrer"}
      </button>
    </div>
  );
}
