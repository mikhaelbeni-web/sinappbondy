"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { formatEUR, formatDate, METHOD_LABELS, paidOf, remainingOf } from "@/lib/format";
import StatusBadge from "@/components/StatusBadge";
import PaymentForm from "@/components/PaymentForm";
import HazkarotSection from "@/components/HazkarotSection";
import Toast, { readJson, type Notice } from "@/components/Toast";
import { useAuth } from "@/context/AuthContext";

export default function DonorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const [donor, setDonor] = useState<any>(null);
  const [pledges, setPledges] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [balancePayUrl, setBalancePayUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reminding, setReminding] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  // Résultat des envois (relance, relevé) : en bas de l'écran, toujours visible.
  const [notice, setNotice] = useState<Notice | null>(null);
  const closeNotice = useCallback(() => setNotice(null), []);
  const [showPayment, setShowPayment] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});

  // `quiet` : rafraîchit sans repasser par « Chargement… » (garde le défilement).
  async function load(quiet = false) {
    if (!quiet) setLoading(true);
    const res = await fetch(`/api/donors/${id}`);
    const data = await res.json();
    setDonor(data.donor);
    setPledges(data.pledges || []);
    setPayments(data.payments || []);
    setReceipts(data.receipts || []);
    setBalancePayUrl(data.balancePayUrl || null);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function relancer(pledgeId: string) {
    setReminding(pledgeId);
    setNotice(null);
    try {
      const res = await fetch(`/api/pledges/${pledgeId}/remind`, { method: "POST" });
      const data = await readJson(res);
      setNotice({ ok: true, text: `Relance envoyée${data.to ? ` à ${data.to}` : ""}.` });
      await load(true);
    } catch (err: any) {
      setNotice({ ok: false, text: `Relance non envoyée : ${err.message}` });
    } finally {
      setReminding(null);
    }
  }

  async function envoyerReleve() {
    setReminding("releve");
    setNotice(null);
    try {
      const res = await fetch(`/api/donors/${id}/statement`, { method: "POST" });
      const data = await readJson(res);
      setNotice({ ok: true, text: `Relevé envoyé à ${donor.email} (${formatEUR(data.total)} à régler).` });
      await load(true);
    } catch (err: any) {
      setNotice({ ok: false, text: `Relevé non envoyé : ${err.message}` });
    } finally {
      setReminding(null);
    }
  }

  async function copierLien() {
    if (!balancePayUrl) return;
    try {
      await navigator.clipboard.writeText(balancePayUrl);
      setMessage("Lien de paiement du solde copié.");
    } catch {
      setMessage(balancePayUrl);
    }
  }

  async function saveDonor(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/donors/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, groups: String(form.groups || "").split(",").map((g: string) => g.trim()).filter(Boolean) }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error);
      return;
    }
    setEditing(false);
    await load();
  }

  if (loading) return <p className="text-gray-500">Chargement…</p>;
  if (!donor) return <p className="text-gray-500">Fidèle introuvable.</p>;

  const totalDu = pledges.reduce((s, p) => s + remainingOf(p), 0);
  const totalPaye = pledges.reduce((s, p) => s + paidOf(p), 0);
  const totalPromis = pledges.filter((p) => p.status !== "annule").reduce((s, p) => s + p.amount, 0);
  const addressLine = [donor.address, [donor.postalCode, donor.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-serif font-bold text-ink">{donor.firstName} {donor.lastName}</h1>
          <p className="text-sm text-gray-500">{donor.email || "Pas d'e-mail"} {donor.phone && `· ${donor.phone}`}</p>
          {addressLine && <p className="text-sm text-gray-500">{addressLine}</p>}
          {donor.groups?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {donor.groups.map((g: string) => (
                <span key={g} className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">{g}</span>
              ))}
            </div>
          )}
          <p className="hidden print:block text-sm text-gray-500 mt-1">Relevé au {formatDate(new Date().toISOString())}</p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          {can("gerer_fideles") && (
            <button
              className="btn-secondary"
              onClick={() => {
                setForm({
                  firstName: donor.firstName,
                  lastName: donor.lastName,
                  email: donor.email || "",
                  phone: donor.phone || "",
                  address: donor.address || "",
                  postalCode: donor.postalCode || "",
                  city: donor.city || "",
                  groups: (donor.groups || []).join(", "),
                  emailOptOut: !!donor.emailOptOut,
                  membershipTier: donor.membershipTier || "",
                });
                setEditing((v) => !v);
              }}
            >
              Modifier
            </button>
          )}
          <button className="btn-secondary" onClick={() => window.print()}>
            Imprimer le relevé
          </button>
        </div>
      </div>

      {editing && (
        <form onSubmit={saveDonor} className="card p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 print:hidden">
          {[
            ["firstName", "Prénom"],
            ["lastName", "Nom"],
            ["email", "E-mail"],
            ["phone", "Téléphone"],
            ["address", "Adresse"],
            ["postalCode", "Code postal"],
            ["city", "Ville"],
          ].map(([key, label]) => (
            <div key={key} className={key === "address" ? "sm:col-span-2" : ""}>
              <label className="label">{label}</label>
              <input className="input" value={form[key] || ""} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
            </div>
          ))}
          <p className="sm:col-span-2 text-xs text-gray-500">L'adresse postale est obligatoire pour émettre un reçu fiscal.</p>
          <div className="sm:col-span-2">
            <label className="label">Groupes (séparés par des virgules)</label>
            <input className="input" placeholder="ex : Conseil, Jeunes, Cours du mardi" value={form.groups || ""} onChange={(e) => setForm({ ...form, groups: e.target.value })} />
          </div>
          <div>
            <label className="label">Formule de cotisation</label>
            <input className="input" placeholder="ex : Famille" value={form.membershipTier || ""} onChange={(e) => setForm({ ...form, membershipTier: e.target.value })} />
          </div>
          <label className="sm:col-span-2 tap flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!form.emailOptOut} onChange={(e) => setForm({ ...form, emailOptOut: e.target.checked })} />
            Ne reçoit pas les messages groupés (désinscrit)
          </label>
          <div className="sm:col-span-2 flex flex-wrap gap-2">
            <button type="submit" className="btn-primary">Enregistrer</button>
            <button type="button" className="btn-secondary" onClick={() => setEditing(false)}>Annuler</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 max-w-2xl">
        <div className="card p-4">
          <p className="text-xs text-gray-500 uppercase">Total promis</p>
          <p className="text-xl font-bold text-ink">{formatEUR(totalPromis)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 uppercase">Total réglé</p>
          <p className="text-xl font-bold text-green-700">{formatEUR(totalPaye)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 uppercase">Solde dû</p>
          <p className="text-xl font-bold text-amber-700">{formatEUR(totalDu)}</p>
        </div>
      </div>

      {totalDu > 0 && (
        <div className="flex flex-wrap gap-2 print:hidden">
          {can("gerer_paiements") && (
            <button className="btn-gold" onClick={() => setShowPayment((v) => !v)}>
              {showPayment ? "Fermer" : "Enregistrer un paiement"}
            </button>
          )}
          {can("envoyer_relances") && donor.email && (
            <button className="btn-primary" onClick={envoyerReleve} disabled={reminding === "releve"}>
              {reminding === "releve" ? "Envoi…" : "Envoyer le relevé par e-mail"}
            </button>
          )}
          {balancePayUrl && (
            <button className="btn-secondary" onClick={copierLien}>
              Copier le lien « régler le solde »
            </button>
          )}
        </div>
      )}

      {showPayment && (
        <div className="card p-4 print:hidden">
          <PaymentForm
            fixedDonorId={id}
            pledges={pledges}
            onSaved={(info) => {
              setShowPayment(false);
              setMessage(info?.receiptNumber ? `Paiement enregistré, reçu fiscal n° ${info.receiptNumber} émis.` : "Paiement enregistré.");
              load();
            }}
          />
        </div>
      )}

      {message && <p className="text-sm text-gray-600 break-all print:hidden">{message}</p>}
      <Toast notice={notice} onClose={closeNotice} />

      <div className="card">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-ink">Promesses de dons</h2>
        </div>
        <div className="divide-y">
          {pledges.length === 0 && <p className="p-4 text-sm text-gray-500">Aucune promesse pour ce fidèle.</p>}
          {pledges.map((p) => {
            const reste = remainingOf(p);
            const regle = paidOf(p);
            return (
              <div key={p.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-ink">{p.catalogItemName}</p>
                  <p className="text-gray-500">{p.serviceLabel} · {formatDate(p.createdAt)} · saisi par {p.createdByName}</p>
                  {regle > 0 && reste > 0 && (
                    <p className="text-purple-700 text-xs">Réglé {formatEUR(regle)} · reste {formatEUR(reste)}</p>
                  )}
                  {p.notes && <p className="text-gray-400 italic">{p.notes}</p>}
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
                  <span className="font-semibold">{formatEUR(p.amount)}</span>
                  <StatusBadge status={p.status} />
                  {can("envoyer_relances") && reste > 0 && (
                    <button
                      onClick={() => relancer(p.id)}
                      disabled={reminding === p.id}
                      className="btn-secondary text-xs px-2 py-1 print:hidden"
                    >
                      {reminding === p.id ? "Envoi…" : "Relancer"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {can("gerer_paiements") && (
        <div className="card">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-ink">Paiements reçus</h2>
          </div>
          <div className="divide-y">
            {payments.length === 0 && <p className="p-4 text-sm text-gray-500">Aucun paiement enregistré.</p>}
            {payments.map((p) => (
              <div key={p.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-ink">
                    {formatDate(p.date)} · {METHOD_LABELS[p.method] || p.method}
                  </p>
                  <p className="text-gray-500">
                    {p.reference && `${p.reference} · `}saisi par {p.createdByName}
                  </p>
                  {p.unallocated > 0 && (
                    <p className="text-purple-700 text-xs">Dont {formatEUR(p.unallocated)} non affecté (avoir)</p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {p.receiptId && <span className="text-xs text-gray-500">reçu émis</span>}
                  <span className="font-semibold text-green-700">{formatEUR(p.amount)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {can("gerer_paiements") && receipts.length > 0 && (
        <div className="card print:hidden">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-ink">Reçus fiscaux</h2>
          </div>
          <div className="divide-y">
            {receipts.map((r) => (
              <div key={r.id} className={`p-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm ${r.cancelled ? "opacity-60" : ""}`}>
                <span className="min-w-0">
                  N° {r.number} · {r.kind === "annuel" ? `récapitulatif ${r.year}` : formatDate(r.periodStart)}
                  {r.cancelled && " · annulé"}
                </span>
                <span className="flex items-center gap-3 shrink-0">
                  <span className="font-semibold">{formatEUR(r.amount)}</span>
                  <a href={`/api/receipts/${r.id}/pdf`} target="_blank" rel="noreferrer" className="text-gold text-xs hover:underline tap">
                    PDF
                  </a>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <HazkarotSection donorId={id} canEdit={can("gerer_fideles")} />
    </div>
  );
}
