"use client";

import { useEffect, useState } from "react";
import { formatDate } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";

const AUDIENCE_LABELS: Record<string, string> = {
  tous: "Tous les fidèles",
  groupes: "Groupes",
  solde: "Fidèles avec un solde dû",
  donateurs: "Donateurs de l'année",
};

export default function MessagesPage() {
  const { can } = useAuth();
  const [history, setHistory] = useState<any[]>([]);
  const [groups, setGroups] = useState<string[]>([]);
  const [type, setType] = useState("tous");
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const audience = type === "groupes" ? { type, groups: selectedGroups } : type === "donateurs" ? { type, year } : { type };

  async function load() {
    const res = await fetch("/api/messages");
    const data = await res.json();
    setHistory(data.history || []);
    setGroups(data.groups || []);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (type === "groupes" && !selectedGroups.length) {
      setCount(0);
      return;
    }
    setCount(null);
    fetch(`/api/messages?audience=${encodeURIComponent(JSON.stringify(audience))}`)
      .then((r) => r.json())
      .then((d) => setCount(d.count ?? 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, selectedGroups.join("|"), year]);

  async function send(test: boolean) {
    if (!test && !confirm(`Envoyer ce message à ${count} destinataire(s) ?`)) return;
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body, audience, test }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessage(test ? "Message test envoyé à votre adresse." : `${data.sent} message(s) envoyé(s)${data.failed ? `, ${data.failed} en échec` : ""}.`);
      if (!test) {
        setSubject("");
        setBody("");
        await load();
      }
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!can("envoyer_messages")) return <p className="text-gray-500">Vous n'avez pas accès aux messages.</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-serif font-bold text-ink">Messages aux fidèles</h1>

      <div className="card p-4 space-y-4">
        <div>
          <label className="label">Destinataires</label>
          <div className="flex flex-wrap gap-2">
            {Object.entries(AUDIENCE_LABELS).map(([k, v]) => (
              <button
                key={k}
                type="button"
                onClick={() => setType(k)}
                className={`rounded-full border px-3 py-1 text-sm ${type === k ? "bg-ink text-white border-ink" : "bg-white border-gray-300 text-ink"}`}
              >
                {v}
              </button>
            ))}
          </div>
          {type === "groupes" && (
            <div className="flex flex-wrap gap-3 mt-3">
              {groups.length === 0 && (
                <p className="text-sm text-gray-500">Aucun groupe : ajoutez-en depuis la fiche d'un fidèle (bouton Modifier).</p>
              )}
              {groups.map((g) => (
                <label key={g} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedGroups.includes(g)}
                    onChange={(e) => setSelectedGroups((prev) => (e.target.checked ? [...prev, g] : prev.filter((x) => x !== g)))}
                  />
                  {g}
                </label>
              ))}
            </div>
          )}
          {type === "donateurs" && (
            <input type="number" className="input w-32 mt-3" value={year} onChange={(e) => setYear(Number(e.target.value))} />
          )}
          <p className="text-xs text-gray-500 mt-2">
            {count === null ? "Calcul…" : `${count} destinataire(s) avec e-mail`} · les fidèles désinscrits sont exclus.
          </p>
        </div>

        <div>
          <label className="label">Objet</label>
          <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="ex : Horaires des offices de Souccot" />
        </div>
        <div>
          <label className="label">Message</label>
          <textarea className="input" rows={8} value={body} onChange={(e) => setBody(e.target.value)} />
          <p className="text-xs text-gray-500 mt-1">
            Variables : <code>{"{prenom}"}</code>, <code>{"{nom}"}</code>, <code>{"{solde}"}</code>. Laissez une ligne vide entre deux paragraphes.
          </p>
        </div>

        {message && <p className="text-sm text-gray-700">{message}</p>}

        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" disabled={busy || !subject || !body} onClick={() => send(true)}>
            M'envoyer un test
          </button>
          <button className="btn-gold" disabled={busy || !subject || !body || !count} onClick={() => send(false)}>
            {busy ? "Envoi…" : `Envoyer à ${count ?? "…"} fidèle(s)`}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-ink">Messages envoyés</h2>
        </div>
        <div className="divide-y">
          {history.length === 0 && <p className="p-4 text-sm text-gray-500">Aucun message envoyé.</p>}
          {history.map((h, i) => (
            <div key={i} className="p-4 text-sm">
              <p className="font-medium text-ink">{h.subject}</p>
              <p className="text-gray-500">
                {formatDate(h.sentAt)} · {AUDIENCE_LABELS[h.audience?.type] || ""}
                {h.audience?.groups?.length ? ` (${h.audience.groups.join(", ")})` : ""} · {h.sent} envoyé(s)
                {h.failed ? `, ${h.failed} en échec` : ""} · par {h.sentBy}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
