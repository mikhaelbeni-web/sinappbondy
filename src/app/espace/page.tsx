"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatEUR, formatDate, METHOD_LABELS, STATUS_LABELS } from "@/lib/format";

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

  useEffect(() => {
    fetch("/api/espace/me")
      .then(async (r) => (r.ok ? setData(await r.json()) : null))
      .finally(() => setLoading(false));
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
                {error && <p className="text-sm text-red-600">{error}</p>}
                <p className="text-sm text-gray-600">Saisissez l'e-mail communiqué à la synagogue : vous recevrez un lien de connexion, sans mot de passe.</p>
                <div>
                  <label className="label">E-mail</label>
                  <input type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
                </div>
                <button type="submit" className="btn-gold w-full">Recevoir mon lien</button>
              </form>
            )}
          </div>
          <p className="text-center text-sm text-gray-500 mt-4">
            <a href="/don" className="text-gold hover:underline">Faire un don</a>
          </p>
        </div>
      </div>
    );
  }

  const totalPaid = data.payments.reduce((s: number, p: any) => s + p.amount, 0);

  return (
    <div className="min-h-screen bg-cream px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <p className="text-sm text-gray-500">{name}</p>
            <h1 className="text-2xl font-serif font-bold text-ink">
              Chalom {data.donor.firstName} {data.donor.lastName}
            </h1>
          </div>
          <button onClick={logout} className="text-sm text-gray-500 hover:text-ink self-start sm:self-auto">
            Déconnexion
          </button>
        </div>

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
            <Empty>{data.donor.hasAddress ? "Aucun reçu pour l'instant." : "Aucun reçu : communiquez votre adresse postale à la synagogue pour en recevoir."}</Empty>
          )}
          {data.receipts.map((r: any) => (
            <div key={r.id} className="p-4 flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">
                N° {r.number} · {r.kind === "annuel" ? `récapitulatif ${r.year}` : formatDate(r.issuedAt)}
              </span>
              <span className="flex items-center gap-3 shrink-0">
                <span className="font-semibold">{formatEUR(r.amount)}</span>
                <a href={`/api/espace/receipts/${r.id}/pdf`} target="_blank" rel="noreferrer" className="text-gold hover:underline">
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
      </div>
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
