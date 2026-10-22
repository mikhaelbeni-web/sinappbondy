"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatDate } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";

// Hazkarot à venir (toutes familles) + réglage des rappels.
export default function HazkarotPage() {
  const { can } = useAuth();
  const [days, setDays] = useState(60);
  const [list, setList] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [message, setMessage] = useState("");

  async function load() {
    const res = await fetch(`/api/hazkarot?days=${days}`);
    const data = await res.json();
    setList(data.hazkarot || []);
    setSettings(data.settings);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  async function saveSettings(next: any) {
    setSettings(next);
    const res = await fetch("/api/hazkarot", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    setMessage(res.ok ? "Réglage enregistré." : (await res.json()).error);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-serif font-bold text-ink">Hazkarot</h1>
        <select className="input w-full sm:w-48" value={days} onChange={(e) => setDays(Number(e.target.value))}>
          <option value={14}>2 prochaines semaines</option>
          <option value={30}>30 prochains jours</option>
          <option value={60}>60 prochains jours</option>
          <option value={365}>12 prochains mois</option>
        </select>
      </div>

      {settings && can("envoyer_relances") && (
        <div className="card p-4 flex flex-col sm:flex-row sm:items-center gap-3 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={!!settings.enabled} onChange={(e) => saveSettings({ ...settings, enabled: e.target.checked })} />
            Prévenir la famille par e-mail
          </label>
          <label className="flex items-center gap-2">
            <input
              type="number"
              min="1"
              max="60"
              className="input w-20"
              value={settings.daysBefore}
              onChange={(e) => setSettings({ ...settings, daysBefore: e.target.value })}
              onBlur={() => saveSettings(settings)}
            />
            jours avant
          </label>
          {message && <span className="text-gray-500">{message}</span>}
        </div>
      )}

      <div className="card divide-y">
        {list.length === 0 && <p className="p-4 text-sm text-gray-500">Aucune hazkara sur cette période. Elles s'ajoutent depuis la fiche d'un fidèle.</p>}
        {list.map((h) => (
          <div key={h.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm">
            <div className="min-w-0">
              <p className="font-medium text-ink">
                {h.deceasedName} {h.relation && <span className="text-gray-500 font-normal">({h.relation})</span>}
              </p>
              <Link href={`/donors/${h.donorId}`} className="text-gray-500 hover:underline">
                Famille : {h.donorName}
              </Link>
            </div>
            <div className="text-right shrink-0">
              <p className="font-semibold text-ink">{formatDate(h.next.date)}</p>
              <p className="text-gray-500 text-xs">{h.next.hebrew} · commence la veille au soir</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
