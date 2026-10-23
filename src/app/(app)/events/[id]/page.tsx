"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { formatEUR } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";

const CHECKIN_LABELS: Record<string, string> = {
  ok: "Entrée validée",
  deja_utilise: "Billet déjà utilisé",
  autre_evenement: "Billet d'un autre événement",
};

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const [data, setData] = useState<any>(null);
  const [code, setCode] = useState("");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [filter, setFilter] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    const res = await fetch(`/api/events/${id}`);
    const d = await res.json();
    if (res.ok) setData(d);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function checkin(c: string) {
    setResult(null);
    const res = await fetch(`/api/events/${id}/checkin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: c }),
    });
    const d = await res.json();
    if (!res.ok) {
      setResult({ ok: false, text: d.error });
      return;
    }
    const r = d.registration;
    setResult({
      ok: d.status === "ok",
      text: `${CHECKIN_LABELS[d.status]} : ${r.name} (${r.qty} place${r.qty > 1 ? "s" : ""})${
        d.status === "deja_utilise" ? `, le ${new Date(r.checkedInAt).toLocaleString("fr-FR")} par ${r.checkedInBy}` : ""
      }`,
    });
    setCode("");
    await load();
  }

  async function toggle() {
    await fetch(`/api/events/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !data.event.active }),
    });
    await load();
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(data.url);
      setMessage("Lien copié.");
    } catch {
      setMessage(data.url);
    }
  }

  if (!can("gerer_paiements")) return <p className="text-gray-500">Vous n'avez pas accès aux événements.</p>;
  if (!data) return <p className="text-gray-500">Chargement…</p>;

  const { event, registrations } = data;
  const qty = registrations.reduce((s: number, r: any) => s + r.qty, 0);
  const inside = registrations.filter((r: any) => r.checkedInAt).reduce((s: number, r: any) => s + r.qty, 0);
  const amount = registrations.reduce((s: number, r: any) => s + r.amount, 0);
  const f = filter.trim().toLowerCase();
  const shown = f ? registrations.filter((r: any) => `${r.name} ${r.email} ${r.code}`.toLowerCase().includes(f)) : registrations;

  return (
    <div className="space-y-6">
      <Link href="/events" className="text-sm text-gold hover:underline tap">← Événements</Link>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-serif font-bold text-ink">{event.title}</h1>
          <p className="text-gray-600 text-sm first-letter:uppercase">
            {new Date(`${event.date}:00`).toLocaleString("fr-FR", { dateStyle: "full", timeStyle: "short" })}
            {event.location ? ` · ${event.location}` : ""}
          </p>
        </div>
        <button className="btn-secondary shrink-0" onClick={toggle}>
          {event.active ? "Clore les inscriptions" : "Rouvrir les inscriptions"}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="card p-4">
          <p className="text-xs text-gray-500">Inscrits</p>
          <p className="text-xl font-semibold text-ink">{qty}{event.capacity > 0 ? ` / ${event.capacity}` : ""}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500">Entrées validées</p>
          <p className="text-xl font-semibold text-ink">{inside}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500">Encaissé</p>
          <p className="text-xl font-semibold text-green-700">{event.price > 0 ? formatEUR(amount) : "Gratuit"}</p>
        </div>
      </div>

      <div className="card p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm">
        <div className="min-w-0">
          <p className="font-medium text-ink">Page d'inscription</p>
          <p className="text-gray-500 break-all">{data.url}</p>
          {message && <p className="text-gray-600">{message}</p>}
        </div>
        <div className="flex flex-wrap gap-3 shrink-0">
          <button className="text-gold hover:underline tap" onClick={copy}>Copier le lien</button>
          <a className="text-gold hover:underline tap" href={`/api/events/${id}/qr`} target="_blank" rel="noreferrer">QR code</a>
          <a className="text-gold hover:underline tap" href={data.url} target="_blank" rel="noreferrer">Voir</a>
        </div>
      </div>

      <form
        className="card p-4 space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (code.trim()) checkin(code);
        }}
      >
        <label className="label">Contrôle à l'entrée</label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input className="input font-mono uppercase" placeholder="Code du billet" value={code} onChange={(e) => setCode(e.target.value)} />
          <button type="submit" className="btn-gold shrink-0">Valider</button>
        </div>
        <p className="text-xs text-gray-500">
          Vous pouvez aussi scanner le QR code du billet avec l'appareil photo du téléphone, connecté à l'application.
        </p>
        {result && <p className={`text-sm font-medium ${result.ok ? "text-green-700" : "text-red-600"}`}>{result.text}</p>}
      </form>

      <div className="card">
        <div className="p-4 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h2 className="font-semibold text-ink">Inscriptions ({registrations.length})</h2>
          <input className="input sm:w-64" placeholder="Rechercher…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        </div>
        <div className="divide-y">
          {shown.length === 0 && <p className="p-4 text-sm text-gray-500">Aucune inscription.</p>}
          {shown.map((r: any) => (
            <div key={r.id} className="p-4 text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-ink">
                  {r.name} · {r.qty} place{r.qty > 1 ? "s" : ""}
                </p>
                <p className="text-gray-500 break-all">
                  {r.email} · <span className="font-mono">{r.code}</span>
                  {r.amount > 0 ? ` · ${formatEUR(r.amount)}` : ""}
                </p>
              </div>
              {r.checkedInAt ? (
                <span className="text-green-700 shrink-0">Entré à {new Date(r.checkedInAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
              ) : (
                <button className="text-gold hover:underline shrink-0 text-left tap" onClick={() => checkin(r.code)}>Valider l'entrée</button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
