"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { OCCASIONS, type KiddushOption, type KiddushSlot } from "@/lib/kiddush";
import { formatEUR } from "@/lib/format";

const dayLabel = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const monthLabel = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });

// Parrainage d'un kiddouch : 1) Chabbat, 2) formule, 3) dédicace,
// 4) coordonnées demandées seulement à la fin (aucun compte à créer avant).
export default function KiddushPicker() {
  const [data, setData] = useState<{ enabled: boolean; intro: string; options: KiddushOption[]; slots: KiddushSlot[]; known: boolean } | null>(null);
  const [date, setDate] = useState("");
  const [option, setOption] = useState("");
  const [form, setForm] = useState({ occasion: "", dedication: "", firstName: "", lastName: "", email: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<any>(null);

  const load = () =>
    fetch("/api/public/kiddush", { cache: "no-store" })
      .then((r) => r.json())
      .then(setData)
      .catch(() => setError("Chargement impossible. Réessayez dans un instant."));
  useEffect(() => {
    load();
  }, []);

  if (!data) return <p className="card p-5 text-sm text-gray-600" role={error ? "alert" : "status"}>{error || "Chargement…"}</p>;
  if (!data.enabled) return <p className="card p-5 text-sm text-gray-600">Le parrainage en ligne est fermé pour le moment. Contactez le secrétariat.</p>;

  if (done) {
    return (
      <div className="card p-6 space-y-3" role="status">
        <p className="flex items-center gap-2 text-lg font-bold text-ink">
          <Check className="w-5 h-5 text-green-700" aria-hidden /> Merci pour votre parrainage
        </p>
        <p className="text-sm text-gray-700">
          {done.label}, {done.serviceLabel}.
          {done.emailed ? " Un e-mail de confirmation vous a été envoyé." : ""}
        </p>
        {done.payUrl ? (
          <a href={done.payUrl} className="btn-primary">Régler {formatEUR(done.price)} en ligne</a>
        ) : (
          <p className="text-sm text-gray-700">Le secrétariat vous recontacte pour l'organisation et le règlement.</p>
        )}
      </div>
    );
  }

  const slot = data.slots.find((s) => s.date === date);
  const opt = data.options.find((o) => o.key === option);
  const months = Array.from(new Set(data.slots.map((s) => s.date.slice(0, 7))));
  const full = (s: KiddushSlot) => data.options.every((o) => s.taken.includes(o.key));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/public/kiddush", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date, option, ...form }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(d.error || "Envoi impossible. Réessayez.");
      if (res.status === 409) {
        setOption("");
        load();
      }
      return;
    }
    setDone(d);
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <p className="card p-5 text-sm text-gray-700 leading-relaxed">{data.intro}</p>

      <fieldset className="card p-5">
        <legend className="font-bold text-ink text-lg float-left w-full mb-3">1. Choisissez un Chabbat</legend>
        <div className="clear-both space-y-4">
          {months.map((m) => (
            <div key={m}>
              <p className="text-xs font-semibold uppercase text-gray-500 mb-2">{monthLabel(`${m}-01`)}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {data.slots
                  .filter((s) => s.date.startsWith(m))
                  .map((s) => {
                    const isFull = full(s);
                    const active = s.date === date;
                    return (
                      <button
                        key={s.date}
                        type="button"
                        disabled={isFull}
                        aria-pressed={active}
                        onClick={() => {
                          setDate(s.date);
                          if (s.taken.includes(option)) setOption("");
                        }}
                        className={`tap rounded-xl border-2 px-3 py-2 text-left transition-colors ${
                          active ? "border-ink bg-ink text-white" : isFull ? "border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed" : "border-gray-200 bg-white text-ink hover:border-ink"
                        }`}
                      >
                        <span className="block font-semibold text-sm">{s.parasha}</span>
                        <span className={`block text-xs ${active ? "text-white/80" : "text-gray-500"}`}>
                          {new Date(`${s.date}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" })}
                          {isFull ? " · déjà parrainé" : ""}
                        </span>
                      </button>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      </fieldset>

      {slot && (
        <fieldset className="card p-5">
          <legend className="font-bold text-ink text-lg float-left w-full mb-1">2. Choisissez la formule</legend>
          <p className="clear-both text-sm text-gray-600 mb-3">
            Chabbat {slot.parasha} <span lang="he" dir="rtl">{slot.parashaHe}</span>, samedi {dayLabel(slot.date)}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {data.options.map((o) => {
              const taken = slot.taken.includes(o.key);
              const active = option === o.key;
              return (
                <button
                  key={o.key}
                  type="button"
                  disabled={taken}
                  aria-pressed={active}
                  onClick={() => setOption(o.key)}
                  className={`tap rounded-xl border-2 px-4 py-3 text-left transition-colors ${
                    active ? "border-ink bg-ink text-white" : taken ? "border-gray-200 bg-gray-50 text-gray-500 cursor-not-allowed" : "border-gray-200 bg-white text-ink hover:border-ink"
                  }`}
                >
                  <span className="block font-semibold">{o.label}</span>
                  <span className={`block text-sm ${active ? "text-white/80" : "text-gray-600"}`}>{taken ? "Déjà parrainé" : o.price > 0 ? formatEUR(o.price) : "Sur devis"}</span>
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {slot && opt && (
        <div className="card p-5 space-y-4">
          <h2 className="font-bold text-ink text-lg">3. Dédicace (facultatif)</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="label" htmlFor="kd-occasion">Formule</label>
              <select id="kd-occasion" className="input" value={form.occasion} onChange={(e) => setForm({ ...form, occasion: e.target.value })}>
                <option value="">Sans dédicace</option>
                {OCCASIONS.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="kd-dedication">Nom ou événement</label>
              <input id="kd-dedication" className="input" maxLength={120} value={form.dedication} onChange={(e) => setForm({ ...form, dedication: e.target.value })} placeholder="ex : la Bar Mitsva de David" />
            </div>
          </div>

          {!data.known && (
            <>
              <h2 className="font-bold text-ink text-lg pt-2">4. Vos coordonnées</h2>
              <p className="text-sm text-gray-600 -mt-2">Aucun compte à créer : votre espace fidèle est ouvert automatiquement avec votre e-mail.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="kd-first">Prénom</label>
                  <input id="kd-first" required autoComplete="given-name" className="input" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
                </div>
                <div>
                  <label className="label" htmlFor="kd-last">Nom</label>
                  <input id="kd-last" required autoComplete="family-name" className="input" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
                </div>
                <div>
                  <label className="label" htmlFor="kd-email">E-mail</label>
                  <input id="kd-email" type="email" required autoComplete="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
                <div>
                  <label className="label" htmlFor="kd-phone">Téléphone (facultatif)</label>
                  <input id="kd-phone" type="tel" autoComplete="tel" className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
              </div>
            </>
          )}

          <div className="rounded-xl bg-cream p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-sm text-ink">
              <strong>{opt.label}</strong>, Chabbat {slot.parasha} ({dayLabel(slot.date)})
              <br />
              <span className="text-lg font-bold">{opt.price > 0 ? formatEUR(opt.price) : "Sur devis"}</span>
            </p>
            <button type="submit" className="btn-primary px-6 py-3" disabled={busy}>
              {busy ? "Envoi…" : "Valider mon parrainage"}
            </button>
          </div>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        </div>
      )}
      {error && !(slot && opt) && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
