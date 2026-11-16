"use client";

import { Suspense, useEffect, useState } from "react";
import PublicPage from "@/components/PublicPage";
import { useSearchParams } from "next/navigation";
import { formatEUR, formatDate, METHOD_LABELS, STATUS_LABELS } from "@/lib/format";
import { SALON_STATUS_LABELS } from "@/lib/kiddush";

const frDay = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

const SHORTCUTS = [
  { href: "/places", label: "Places des fêtes" },
  { href: "/kiddouch", label: "Parrainer un kiddouch" },
  { href: "/salons", label: "Réserver les salons" },
  { href: "/mikve", label: "Mikvé" },
  { href: "/horaires", label: "Horaires" },
];

// Espace fidèle : promesses, paiements, reçus fiscaux et règlement en ligne.
export default function EspacePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-cream" />}>
      <EspaceInner />
    </Suspense>
  );
}

function EspaceInner() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(searchParams.get("expire") ? "Ce lien a expiré : demandez-en un nouveau." : "");

  const load = () =>
    fetch("/api/espace/me")
      .then(async (r) => (r.ok ? setData(await r.json()) : null))
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  async function requestLink(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/espace/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const d = await res.json();
    if (!res.ok) setError(d.error);
    else setSent(true);
  }

  async function logout() {
    await fetch("/api/espace/logout", { method: "POST" });
    setData(null);
  }

  const name = process.env.NEXT_PUBLIC_SYNAGOGUE_NAME || "Synagogue";

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-cream text-gray-500">Chargement…</div>;

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-serif font-bold text-ink">Espace fidèle</h1>
            <p className="text-sm text-gray-500 mt-1">{name}</p>
          </div>
          <div className="card p-6 space-y-4">
            {sent ? (
              <p className="text-sm text-gray-700">
                Si cette adresse est connue de la synagogue, vous allez recevoir un e-mail avec votre lien d'accès. Pensez à vérifier vos indésirables.
              </p>
            ) : (
              <form onSubmit={requestLink} className="space-y-4">
                {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
                <p className="text-sm text-gray-600">Saisissez l'e-mail communiqué à la synagogue : vous recevrez un lien de connexion, sans mot de passe.</p>
                <div>
                  <label htmlFor="espace-email" className="label">E-mail</label>
                  <input id="espace-email" type="email" autoComplete="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
                </div>
                <button type="submit" className="btn-gold w-full">Recevoir mon lien</button>
              </form>
            )}
          </div>
          <p className="text-center text-sm text-gray-500 mt-4">
            <a href="/" className="text-gold hover:underline tap">Accueil</a> · <a href="/don" className="text-gold hover:underline tap">Faire un don</a>
          </p>
        </div>
      </div>
    );
  }

  const totalPaid = data.payments.reduce((s: number, p: any) => s + p.amount, 0);

  return (
    <PublicPage
      width="max-w-2xl"
      title={`Chalom ${data.donor.firstName || data.donor.lastName}`}
      subtitle={name}
      aside={
        <button onClick={logout} className="tap text-sm text-white/80 hover:text-white shrink-0">
          Déconnexion
        </button>
      }
    >

        <nav aria-label="Services en ligne" className="card p-3 flex flex-wrap gap-2">
          <a href="/" className="chip">← Accueil</a>
          {SHORTCUTS.map((s) => (
            <a key={s.href} href={s.href} className="chip">{s.label}</a>
          ))}
        </nav>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="card p-4">
            <p className="text-xs text-gray-500 uppercase">Solde à régler</p>
            <p className="text-2xl font-bold text-amber-700">{formatEUR(data.balance)}</p>
            {data.balanceUrl && (
              <a href={data.balanceUrl} className="btn-gold mt-3 w-full">
                Régler mon solde en ligne
              </a>
            )}
          </div>
          <div className="card p-4">
            <p className="text-xs text-gray-500 uppercase">Total versé</p>
            <p className="text-2xl font-bold text-green-700">{formatEUR(totalPaid)}</p>
            <a href="/don" className="btn-secondary mt-3 w-full">
              Faire un don
            </a>
          </div>
        </div>

        {data.seatingPlans?.length > 0 && (
          <div className="card p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-semibold text-ink">Places des fêtes</h2>
              <p className="text-sm text-gray-600">
                {data.seatingPlans.map((p: any) => `${p.name}${p.salesOpen ? "" : " (réservations pas encore ouvertes)"}`).join(" · ")}
              </p>
            </div>
            <a href="/places" className="btn-gold shrink-0">
              {data.seatingPlans.some((p: any) => p.salesOpen) ? "Choisir mes places" : "Voir le plan"}
            </a>
          </div>
        )}

        {data.seats?.length > 0 && (
          <Section title="Mes places">
            {data.seats.map((s: any) => (
              <div key={s.id} className="p-4 flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0">
                  <span className="font-medium text-ink">{s.label}</span>
                  <span className="text-gray-500"> · {s.plan}</span>
                </span>
                <span className={`text-xs shrink-0 ${s.pending ? "text-amber-700" : "text-green-700"}`}>{s.pending ? "en attente de paiement" : "réservée"}</span>
              </div>
            ))}
          </Section>
        )}

        {data.kiddush?.length > 0 && (
          <Section title="Mes parrainages">
            {data.kiddush.map((k: any) => (
              <div key={k.id} className="p-4 text-sm">
                <p className="font-medium text-ink">{k.label} · Chabbat {k.parasha}</p>
                {k.pending && <p className="text-xs text-amber-700">En attente de paiement : pas encore réservé</p>}
                <p className="text-gray-500 first-letter:uppercase">{frDay(k.date)}{k.dedication ? ` · ${k.dedication}` : ""}</p>
              </div>
            ))}
          </Section>
        )}

        {data.salons?.length > 0 && (
          <Section title="Mes demandes de salon">
            {data.salons.map((r: any) => (
              <div key={r.id} className="p-4 flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-ink">{r.eventType} · {r.guests} invités</p>
                  <p className="text-gray-500 first-letter:uppercase">{frDay(r.date)}</p>
                </div>
                <span className={`text-xs shrink-0 ${r.status === "confirmee" ? "text-green-700" : r.status === "refusee" ? "text-red-700" : "text-amber-700"}`}>
                  {r.status === "nouvelle" ? "En attente de réponse" : SALON_STATUS_LABELS[r.status] || r.status}
                </span>
              </div>
            ))}
          </Section>
        )}

        {data.hazkarot?.length > 0 && (
          <Section title="Mes hazkarot">
            {data.hazkarot.map((h: any) => (
              <div key={h.id} className="p-4 text-sm">
                <p className="font-medium text-ink">{h.name}{h.relation ? ` (${h.relation})` : ""}</p>
                <p className="text-gray-500">
                  {h.hebrewDate}
                  {h.next ? ` · prochaine hazkara le ${frDay(h.next)}` : ""}
                </p>
              </div>
            ))}
          </Section>
        )}

        <Section title="Mes promesses">
          {data.pledges.length === 0 && <Empty>Aucune promesse.</Empty>}
          {data.pledges.map((p: any) => (
            <div key={p.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-sm">
              <div className="min-w-0">
                <p className="font-medium text-ink">{p.label}</p>
                <p className="text-gray-500">{p.service} · {formatDate(p.date)}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-semibold">{formatEUR(p.amount)}</p>
                <p className={`text-xs ${p.remaining > 0 ? "text-amber-700" : "text-green-700"}`}>
                  {p.remaining > 0 ? `reste ${formatEUR(p.remaining)}` : STATUS_LABELS[p.status]}
                </p>
              </div>
            </div>
          ))}
        </Section>

        <Section title="Mes reçus fiscaux">
          {data.receipts.length === 0 && (
            <Empty>{data.donor.hasAddress ? "Aucun reçu pour l'instant." : "Aucun reçu : ajoutez votre adresse postale dans « Mes coordonnées », plus bas, pour en recevoir."}</Empty>
          )}
          {data.receipts.map((r: any) => (
            <div key={r.id} className="p-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
              <span className="min-w-0">
                N° {r.number} · {r.kind === "annuel" ? `récapitulatif ${r.year}` : formatDate(r.issuedAt)}
              </span>
              <span className="flex items-center gap-3 shrink-0">
                <span className="font-semibold">{formatEUR(r.amount)}</span>
                <a href={`/api/espace/receipts/${r.id}/pdf`} target="_blank" rel="noreferrer" className="text-gold hover:underline tap">
                  Télécharger
                </a>
              </span>
            </div>
          ))}
        </Section>

        <Section title="Mes paiements">
          {data.payments.length === 0 && <Empty>Aucun paiement.</Empty>}
          {data.payments.map((p: any) => (
            <div key={p.id} className="p-4 flex items-center justify-between gap-3 text-sm">
              <span className="text-gray-600">{formatDate(p.date)} · {METHOD_LABELS[p.method] || p.method}</span>
              <span className="font-semibold text-green-700">{formatEUR(p.amount)}</span>
            </div>
          ))}
        </Section>
        <AddressForm donor={data.donor} onSaved={load} />
    </PublicPage>
  );
}

// Coordonnées : l'adresse postale est obligatoire sur un reçu fiscal.
function AddressForm({ donor, onSaved }: { donor: any; onSaved: () => void }) {
  const [open, setOpen] = useState(!donor.hasAddress);
  const [f, setF] = useState({ address: donor.address || "", postalCode: donor.postalCode || "", city: donor.city || "", phone: donor.phone || "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const res = await fetch("/api/espace/me", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    const d = await res.json().catch(() => ({}));
    setMsg(res.ok ? { ok: true, text: "Coordonnées enregistrées." } : { ok: false, text: d.error || "Enregistrement impossible." });
    setSaving(false);
    if (res.ok) {
      setOpen(false);
      onSaved();
    }
  }

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold text-ink">Mes coordonnées</h2>
          <p className="text-sm text-gray-600 break-words">
            {donor.hasAddress ? `${donor.address}, ${donor.postalCode} ${donor.city}` : "Ajoutez votre adresse postale : elle est obligatoire pour recevoir un reçu fiscal."}
          </p>
          <p className="text-sm text-gray-600 break-words">{donor.email}{donor.phone ? ` · ${donor.phone}` : ""}</p>
        </div>
        {!open && (
          <button type="button" className="btn-secondary shrink-0" onClick={() => setOpen(true)}>Modifier</button>
        )}
      </div>
      {msg && <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-green-700" : "text-red-600"}`}>{msg.text}</p>}
      {open && (
        <form onSubmit={save} className="space-y-3">
          <div>
            <label className="label" htmlFor="esp-address">Adresse</label>
            <input id="esp-address" className="input" autoComplete="street-address" required value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="label" htmlFor="esp-cp">Code postal</label>
              <input id="esp-cp" className="input" autoComplete="postal-code" inputMode="numeric" required value={f.postalCode} onChange={(e) => setF({ ...f, postalCode: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="esp-city">Ville</label>
              <input id="esp-city" className="input" autoComplete="address-level2" required value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="esp-phone">Téléphone (facultatif)</label>
            <input id="esp-phone" type="tel" className="input" autoComplete="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <button type="submit" className="btn-gold" disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</button>
            {donor.hasAddress && <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Annuler</button>}
          </div>
          <p className="text-xs text-gray-500">Pour changer de nom ou d'e-mail, contactez la synagogue.</p>
        </form>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <div className="p-4 border-b">
        <h2 className="font-semibold text-ink">{title}</h2>
      </div>
      <div className="divide-y">{children}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="p-4 text-sm text-gray-500">{children}</p>;
}
