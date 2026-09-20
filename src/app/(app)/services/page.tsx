"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { fr } from "date-fns/locale";
import { formatDate } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";

const TYPE_LABELS: Record<string, string> = { shabbat: "Shabbat", fete: "Fête", autre: "Autre" };
const TYPE_DOT: Record<string, string> = { shabbat: "bg-gold", fete: "bg-ink", autre: "bg-gray-400" };
const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export default function ServicesPage() {
  const { can } = useAuth();
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ date: "", type: "shabbat", label: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showList, setShowList] = useState(false);

  const [importYear, setImportYear] = useState(new Date().getFullYear());
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState("");

  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/services");
    const data = await res.json();
    setServices(data.services || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setForm({ date: "", type: "shabbat", label: "", notes: "" });
      setShowForm(false);
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleImport() {
    setImporting(true);
    setImportMessage("");
    try {
      const res = await fetch("/api/services/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: importYear }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setImportMessage(
        `${data.created} office(s) ajouté(s), ${data.skipped} déjà présent(s) (sur ${data.total} dates ${importYear}).`
      );
      await load();
    } catch (err: any) {
      setImportMessage(err.message);
    } finally {
      setImporting(false);
    }
  }

  const byDate = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const s of services) {
      const list = map.get(s.date) || [];
      list.push(s);
      map.set(s.date, list);
    }
    return map;
  }, [services]);

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  const selectedServices = selectedDay ? byDate.get(selectedDay) || [] : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-serif font-bold text-ink">Offices</h1>
        {can("gerer_offices") && (
          <button onClick={() => setShowForm((s) => !s)} className="btn-primary">
            {showForm ? "Annuler" : "+ Nouvel office"}
          </button>
        )}
      </div>

      {can("gerer_offices") && (
        <div className="card p-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="label">Importer le calendrier hébraïque (Shabbat + fêtes, Paris)</label>
            <div className="flex gap-2">
              <input
                type="number"
                className="input w-28"
                value={importYear}
                onChange={(e) => setImportYear(Number(e.target.value))}
              />
              <button onClick={handleImport} disabled={importing} className="btn-gold whitespace-nowrap">
                {importing ? "Import…" : "Importer l'année"}
              </button>
            </div>
          </div>
          {importMessage && <p className="text-sm text-gray-600">{importMessage}</p>}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="card p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          {error && <p className="md:col-span-2 text-sm text-red-600">{error}</p>}
          <div>
            <label className="label">Date</label>
            <input type="date" required className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div>
            <label className="label">Type</label>
            <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="shabbat">Shabbat</option>
              <option value="fete">Fête</option>
              <option value="autre">Autre</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="label">Intitulé</label>
            <input required className="input" placeholder="ex : Shabbat Bereshit" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <label className="label">Notes</label>
            <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <button type="submit" disabled={saving} className="btn-gold">
              {saving ? "Création…" : "Créer l'office"}
            </button>
          </div>
        </form>
      )}

      {/* Calendrier */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="order-2 sm:order-1 flex items-center gap-2">
            <h2 className="font-semibold text-ink capitalize">{format(month, "MMMM yyyy", { locale: fr })}</h2>
            <button onClick={() => setMonth(startOfMonth(new Date()))} className="text-xs text-gold hover:underline whitespace-nowrap">
              Aujourd'hui
            </button>
          </div>
          <div className="order-1 sm:order-2 flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            <button onClick={() => setMonth((m) => subMonths(m, 1))} className="btn-secondary px-3 py-1.5 text-sm">
              ← Précédent
            </button>
            <button onClick={() => setMonth((m) => addMonths(m, 1))} className="btn-secondary px-3 py-1.5 text-sm">
              Suivant →
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-500 mb-1">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-1">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
          {calendarDays.map((day) => {
            const dateStr = format(day, "yyyy-MM-dd");
            const dayServices = byDate.get(dateStr) || [];
            const inMonth = isSameMonth(day, month);
            const today = isToday(day);
            const selected = selectedDay === dateStr;
            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDay(selected ? null : dateStr)}
                className={`min-h-[56px] sm:min-h-[76px] rounded-md border p-1 sm:p-1.5 text-left align-top transition-colors ${
                  inMonth ? "bg-white" : "bg-gray-50 text-gray-300"
                } ${today ? "border-gold" : "border-gray-100"} ${selected ? "ring-2 ring-gold" : ""} hover:bg-cream`}
              >
                <div className={`text-xs ${today ? "font-bold text-gold" : inMonth ? "text-gray-600" : "text-gray-300"}`}>
                  {format(day, "d")}
                </div>
                <div className="mt-1 space-y-0.5">
                  {dayServices.slice(0, 2).map((s) => (
                    <div key={s.id} className="flex items-center gap-1">
                      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${TYPE_DOT[s.type] || "bg-gray-400"}`} />
                      <span className="truncate text-[11px] leading-tight text-ink">{s.label}</span>
                    </div>
                  ))}
                  {dayServices.length > 2 && (
                    <div className="text-[10px] text-gray-400">+{dayServices.length - 2} autre(s)</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-4 mt-4 text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-gold" /> Shabbat</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-ink" /> Fête</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-gray-400" /> Autre</span>
        </div>
      </div>

      {/* Détail du jour sélectionné */}
      {selectedDay && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-ink">{formatDate(selectedDay)}</h3>
            <button onClick={() => setSelectedDay(null)} className="text-xs text-gray-400 hover:text-ink">Fermer</button>
          </div>
          {selectedServices.length === 0 && <p className="text-sm text-gray-500">Aucun office ce jour-là.</p>}
          <div className="divide-y">
            {selectedServices.map((s) => (
              <Link key={s.id} href={`/services/${s.id}`} className="flex flex-wrap items-center justify-between gap-1 py-2 hover:bg-gray-50 text-sm">
                <span className="text-ink min-w-0 break-words">{s.label}</span>
                <span className="text-gray-500 shrink-0">{TYPE_LABELS[s.type] || s.type} · <span className="text-gold">Voir →</span></span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Liste complète, repliable */}
      <div className="card">
        <button
          onClick={() => setShowList((s) => !s)}
          className="w-full flex items-center justify-between p-4 text-sm font-medium text-ink"
        >
          Liste complète ({services.length})
          <span className="text-gray-400">{showList ? "▲" : "▼"}</span>
        </button>
        {showList && (
          <div className="divide-y border-t">
            {loading && <p className="p-4 text-sm text-gray-500">Chargement…</p>}
            {!loading && services.length === 0 && <p className="p-4 text-sm text-gray-500">Aucun office créé.</p>}
            {services.map((s) => (
              <Link key={s.id} href={`/services/${s.id}`} className="flex items-center justify-between p-4 hover:bg-gray-50">
                <div>
                  <p className="font-medium text-ink">{s.label}</p>
                  <p className="text-sm text-gray-500">{formatDate(s.date)} · {TYPE_LABELS[s.type] || s.type}</p>
                </div>
                <span className="text-gold text-sm">Voir →</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
