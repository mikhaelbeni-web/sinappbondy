"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatEUR, formatDate } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";

interface Pending {
  donorId: string;
  donorName: string;
  amount: number;
  paymentIds: string[];
  hasAddress: boolean;
  hasEmail: boolean;
}

type PanelMode = "edit" | "delete" | "cancel" | "replace";

function stateOf(r: any): "brouillon" | "envoye" | "annule" {
  if (r.cancelled) return "annule";
  if (r.emailedAt || r.deliveredAt) return "envoye";
  return "brouillon";
}

export default function ReceiptsPage() {
  const { can, user } = useAuth();
  const isAdmin = !!user?.role?.isAdmin;
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [missing, setMissing] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [send, setSend] = useState(true);
  const [holes, setHoles] = useState<string[]>([]);
  const [panel, setPanel] = useState<{ id: string; mode: PanelMode } | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/receipts?year=${year}`);
    const data = await res.json();
    setReceipts(data.receipts || []);
    setPending(data.pending || []);
    setMissing(data.missing || []);
    setHoles(data.missingNumbers || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  async function emit(donorId?: string) {
    setBusy(donorId || "all");
    setMessage("");
    try {
      const res = await fetch("/api/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ donorId, year, send }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const ok = data.results.filter((r: any) => r.ok);
      const ko = data.results.filter((r: any) => !r.ok);
      const mailed = ok.filter((r: any) => r.emailed).length;
      let msg = `${ok.length} reçu(s) émis${send ? `, ${mailed} envoyé(s) par e-mail` : ""}.`;
      if (ko.length) msg += ` Non émis : ${ko.map((r: any) => `${r.donorName} (${r.error})`).join(", ")}.`;
      setMessage(msg);
      await load();
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setBusy(null);
    }
  }

  async function resend(id: string) {
    setBusy(id);
    setMessage("");
    const res = await fetch(`/api/receipts/${id}/send`, { method: "POST" });
    const data = await res.json();
    setMessage(res.ok ? "Reçu renvoyé par e-mail." : data.error);
    setBusy(null);
    await load();
  }

  async function markDelivered(id: string, number: string) {
    if (!confirm(`Marquer le reçu ${number} comme remis en main propre ? Il ne pourra plus être modifié ni supprimé.`)) return;
    setBusy(id);
    setMessage("");
    const res = await fetch(`/api/receipts/${id}/delivered`, { method: "POST" });
    const data = await res.json();
    setMessage(res.ok ? `Reçu ${number} marqué remis.` : data.error);
    setBusy(null);
    await load();
  }

  if (!can("gerer_paiements")) return <p className="text-gray-500">Vous n'avez pas accès aux reçus fiscaux.</p>;

  const active = receipts.filter((r) => !r.cancelled);
  const totalReceipted = active.reduce((s, r) => s + r.amount, 0);
  const totalPending = pending.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-serif font-bold text-ink">Reçus fiscaux</h1>
        <select className="input w-full sm:w-32" value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {missing.length > 0 && (
        <div className="card p-4 border-amber-300 bg-amber-50 text-sm">
          <p className="font-medium text-amber-800">Les reçus fiscaux s'activeront dès que la fiche de l'association sera complète.</p>
          <p className="text-amber-700 mt-1">À renseigner : {missing.join(", ")}.</p>
          <Link href="/admin" className="text-gold hover:underline mt-2 inline-block tap">
            Compléter dans Administration → Association
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="card p-4">
          <p className="text-xs text-gray-500 uppercase">Reçus émis {year}</p>
          <p className="text-xl font-bold text-ink">{active.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 uppercase">Montant couvert</p>
          <p className="text-xl font-bold text-green-700">{formatEUR(totalReceipted)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 uppercase">Encaissé sans reçu</p>
          <p className="text-xl font-bold text-amber-700">{formatEUR(totalPending)}</p>
        </div>
      </div>

      {message && <p className="text-sm text-gray-600">{message}</p>}

      {pending.length > 0 && (
        <div className="card">
          <div className="p-4 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="font-semibold text-ink">Paiements {year} sans reçu</h2>
              <p className="text-xs text-gray-500">Un reçu récapitulatif regroupe tous les paiements de l'année d'un fidèle.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="tap flex items-center gap-2 text-sm">
                <input type="checkbox" checked={send} onChange={(e) => setSend(e.target.checked)} />
                Envoyer par e-mail
              </label>
              <button className="btn-gold" disabled={!!busy || missing.length > 0} onClick={() => emit()}>
                {busy === "all" ? "Émission…" : "Émettre tous les récapitulatifs"}
              </button>
            </div>
          </div>
          <div className="divide-y">
            {pending.map((p) => (
              <div key={p.donorId} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm">
                <div className="min-w-0">
                  <Link href={`/donors/${p.donorId}`} className="font-medium text-ink hover:underline tap">
                    {p.donorName}
                  </Link>
                  <p className="text-gray-500">
                    {p.paymentIds.length} paiement(s)
                    {!p.hasAddress && <span className="text-red-600"> · adresse manquante</span>}
                    {!p.hasEmail && <span className="text-amber-700"> · pas d'e-mail</span>}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 shrink-0">
                  <span className="font-semibold">{formatEUR(p.amount)}</span>
                  <button
                    className="btn-secondary text-xs px-2 py-1"
                    disabled={!!busy || !p.hasAddress || missing.length > 0}
                    onClick={() => emit(p.donorId)}
                  >
                    {busy === p.donorId ? "Émission…" : "Émettre"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {holes.length > 0 && (
        <div className="card p-4 border-amber-300 bg-amber-50 text-sm text-amber-800">
          <p className="font-medium">Numéros manquants dans la suite {year} : {holes.join(", ")}.</p>
          <p className="mt-1">
            La numérotation doit être continue. Comblez ces trous en renumérotant un brouillon, ou gardez une trace écrite de la raison
            (le journal d'audit, dans Administration, garde l'historique des suppressions).
          </p>
        </div>
      )}

      <div className="card">
        <div className="p-4 border-b space-y-2">
          <h2 className="font-semibold text-ink">Reçus émis</h2>
          <details className="text-xs text-gray-600">
            <summary className="tap cursor-pointer text-gold">Ce qu'on peut modifier, et pourquoi</summary>
            <ul className="list-disc pl-5 mt-2 space-y-1">
              <li>
                <b>Brouillon</b> (jamais envoyé, téléchargé par le fidèle ni remis) : l'Administrateur peut changer le numéro (vers un
                numéro libre), le fidèle, le montant (sans dépasser les sommes encaissées), la date, ou le supprimer.
              </li>
              <li>
                <b>Envoyé</b> : il ne peut plus être modifié ni supprimé. On l'annule (il garde son numéro, marqué « annulé ») et on le
                remplace par un nouveau reçu au numéro suivant, pour le bon fidèle ou le bon montant.
              </li>
              <li>
                Pourquoi : l'administration fiscale exige une numérotation continue et la conservation des reçus 6 ans. Un reçu envoyé
                puis effacé ou renuméroté expose l'association à une amende (art. 1740 A du CGI) et le donateur à perdre sa réduction
                d'impôt.
              </li>
              <li>Chaque action est enregistrée (qui, quand, avant/après, motif) dans Administration → Journal des reçus.</li>
            </ul>
          </details>
        </div>
        <div className="divide-y">
          {loading && <p className="p-4 text-sm text-gray-500">Chargement…</p>}
          {!loading && receipts.length === 0 && <p className="p-4 text-sm text-gray-500">Aucun reçu pour {year}.</p>}
          {receipts.map((r) => {
            const st = stateOf(r);
            return (
              <div key={r.id} className="p-4 text-sm space-y-3">
                <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 ${r.cancelled ? "opacity-60" : ""}`}>
                  <div className="min-w-0">
                    <p className="font-medium text-ink">
                      N° {r.number} · {r.donor.name}
                      <StateBadge state={st} />
                      {r.test && <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">Test</span>}
                    </p>
                    <p className="text-gray-500">
                      {r.kind === "annuel" ? `Récapitulatif ${r.year}` : "Reçu unitaire"} · émis le {formatDate(r.issuedAt)}
                      {r.emailedAt
                        ? ` · envoyé le ${formatDate(r.emailedAt)}`
                        : r.deliveredAt
                        ? ` · ${r.deliveredVia === "espace" ? "téléchargé par le fidèle" : "remis"} le ${formatDate(r.deliveredAt)}`
                        : ""}
                    </p>
                    {r.replacesNumber && <p className="text-xs text-gray-500">Remplace le n° {r.replacesNumber}</p>}
                    {r.cancelled && (
                      <p className="text-xs text-red-700">
                        Annulé{r.cancelledAt ? ` le ${formatDate(r.cancelledAt)}` : ""}
                        {r.cancelledBy ? ` par ${r.cancelledBy}` : ""}
                        {r.cancelReason ? ` : ${r.cancelReason}` : ""}
                        {r.replacedByNumber ? ` · remplacé par le n° ${r.replacedByNumber}` : ""}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 shrink-0">
                    <span className="font-semibold">{formatEUR(r.amount)}</span>
                    <a href={`/api/receipts/${r.id}/pdf`} target="_blank" rel="noreferrer" className="text-gold text-xs hover:underline tap">
                      {st === "brouillon" ? "Aperçu PDF" : "PDF"}
                    </a>
                    {!r.cancelled && (
                      <button className="text-xs text-ink hover:underline tap" disabled={!!busy} onClick={() => resend(r.id)}>
                        {busy === r.id ? "Envoi…" : st === "envoye" ? "Renvoyer" : "Envoyer"}
                      </button>
                    )}
                    {st === "brouillon" && (
                      <button className="text-xs text-ink hover:underline tap" disabled={!!busy} onClick={() => markDelivered(r.id, r.number)}>
                        Remis en main propre
                      </button>
                    )}
                    {isAdmin && st === "brouillon" && (
                      <>
                        <button className="text-xs text-ink hover:underline tap" onClick={() => setPanel({ id: r.id, mode: "edit" })}>
                          Modifier
                        </button>
                        <button className="text-xs text-red-600 hover:underline tap" onClick={() => setPanel({ id: r.id, mode: "delete" })}>
                          Supprimer
                        </button>
                      </>
                    )}
                    {isAdmin && st === "envoye" && (
                      <>
                        <button className="text-xs text-ink hover:underline tap" onClick={() => setPanel({ id: r.id, mode: "replace" })}>
                          Remplacer
                        </button>
                        <button className="text-xs text-red-600 hover:underline tap" onClick={() => setPanel({ id: r.id, mode: "cancel" })}>
                          Annuler
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {panel?.id === r.id && (
                  <ReceiptPanel
                    receipt={r}
                    mode={panel!.mode}
                    onClose={() => setPanel(null)}
                    onDone={async (msg) => {
                      setPanel(null);
                      setMessage(msg);
                      await load();
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StateBadge({ state }: { state: "brouillon" | "envoye" | "annule" }) {
  const map = {
    brouillon: ["Brouillon", "bg-amber-100 text-amber-800"],
    envoye: ["Envoyé", "bg-green-100 text-green-800"],
    annule: ["Annulé", "bg-red-100 text-red-700"],
  } as const;
  const [label, cls] = map[state];
  return <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${cls}`}>{label}</span>;
}

function ReceiptPanel({
  receipt,
  mode,
  onClose,
  onDone,
}: {
  receipt: any;
  mode: PanelMode;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const covered = receipt.payments.reduce((s: number, p: any) => s + p.amount, 0);
  const [donors, setDonors] = useState<any[]>([]);
  const [number, setNumber] = useState(receipt.number);
  const [donorId, setDonorId] = useState(receipt.donorId);
  const [amount, setAmount] = useState(String(receipt.amount));
  const [issuedAt, setIssuedAt] = useState(String(receipt.issuedAt).slice(0, 10));
  const [reason, setReason] = useState("");
  const [confirmNumber, setConfirmNumber] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (mode !== "edit" && mode !== "replace") return;
    fetch("/api/donors")
      .then((r) => r.json())
      .then((d) => setDonors(d.donors || []))
      .catch(() => setDonors([]));
  }, [mode]);

  const titles: Record<PanelMode, string> = {
    edit: `Modifier le brouillon n° ${receipt.number}`,
    delete: `Supprimer définitivement le brouillon n° ${receipt.number}`,
    cancel: `Annuler le reçu n° ${receipt.number}`,
    replace: `Remplacer le reçu n° ${receipt.number}`,
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const confirmText: Partial<Record<PanelMode, string>> = {
      delete: `Supprimer définitivement le reçu ${receipt.number} ? Cette action est irréversible.`,
      cancel: `Annuler le reçu ${receipt.number} ? Il restera dans la liste, marqué annulé, et son numéro ne sera jamais réutilisé.`,
      replace: `Annuler le reçu ${receipt.number} et émettre un nouveau reçu au numéro suivant ?`,
    };
    if (confirmText[mode] && !confirm(confirmText[mode]!)) return;
    setSaving(true);
    try {
      let res: Response;
      if (mode === "edit") {
        res = await fetch(`/api/receipts/${receipt.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ number, donorId, amount, issuedAt, reason }),
        });
      } else if (mode === "delete") {
        res = await fetch(`/api/receipts/${receipt.id}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ confirmNumber, reason }),
        });
      } else {
        res = await fetch(`/api/receipts/${receipt.id}/${mode}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mode === "replace" ? { donorId, amount, confirmNumber, reason } : { confirmNumber, reason }),
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      onDone(
        mode === "edit"
          ? `Reçu ${data.receipt?.number || receipt.number} modifié.`
          : mode === "delete"
          ? `Reçu ${receipt.number} supprimé.`
          : mode === "cancel"
          ? `Reçu ${receipt.number} annulé.`
          : `Reçu ${receipt.number} annulé et remplacé par le n° ${data.receipt.number} (à envoyer).`
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const donorSelect = (
    <label className="block">
      <span className="text-xs text-gray-500">Fidèle bénéficiaire du reçu</span>
      <select className="input w-full" value={donorId} onChange={(e) => setDonorId(e.target.value)}>
        {!donors.some((d) => d.id === receipt.donorId) && <option value={receipt.donorId}>{receipt.donor.name}</option>}
        {donors.map((d) => (
          <option key={d.id} value={d.id}>
            {d.lastName} {d.firstName}
            {!(d.address && d.postalCode && d.city) ? " (adresse manquante)" : ""}
          </option>
        ))}
      </select>
      {donorId !== receipt.donorId && (
        <span className="text-xs text-gray-500">Les paiements restent enregistrés au nom de {receipt.donor.name}.</span>
      )}
    </label>
  );
  const amountInput = (
    <label className="block">
      <span className="text-xs text-gray-500">Montant (au plus {formatEUR(covered)} encaissés)</span>
      <input className="input w-full" type="number" step="0.01" min="0.01" max={covered} value={amount} onChange={(e) => setAmount(e.target.value)} />
    </label>
  );
  const needsConfirm = mode !== "edit";

  return (
    <form onSubmit={submit} className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-3">
      <p className="font-medium text-ink">{titles[mode]}</p>
      {mode === "edit" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs text-gray-500">Numéro (un numéro libre de {receipt.year})</span>
            <input className="input w-full" value={number} onChange={(e) => setNumber(e.target.value)} />
          </label>
          <label className="block">
            <span className="text-xs text-gray-500">Date du reçu</span>
            <input className="input w-full" type="date" value={issuedAt} onChange={(e) => setIssuedAt(e.target.value)} />
          </label>
          {donorSelect}
          {amountInput}
        </div>
      )}
      {mode === "replace" && (
        <>
          <p className="text-xs text-gray-600">
            Le reçu n° {receipt.number} sera conservé et marqué annulé. Un nouveau reçu, au numéro suivant, couvrira les mêmes paiements.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {donorSelect}
            {amountInput}
          </div>
        </>
      )}
      {mode === "delete" && (
        <p className="text-xs text-gray-600">
          Le reçu disparaît et ses paiements redeviennent « sans reçu ». S'il portait le dernier numéro, ce numéro sera réutilisé par le
          prochain reçu ; sinon il laissera un trou à combler.
        </p>
      )}
      {mode === "cancel" && (
        <p className="text-xs text-gray-600">
          Le reçu reste dans la liste, marqué « REÇU ANNULÉ », et ses paiements redeviennent « sans reçu ». Prévenez le fidèle qu'il ne doit
          plus l'utiliser.
        </p>
      )}
      <label className="block">
        <span className="text-xs text-gray-500">Motif{mode === "edit" ? " (facultatif)" : ""}</span>
        <input className="input w-full" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex. erreur de fidèle à la saisie" />
      </label>
      {needsConfirm && (
        <label className="block">
          <span className="text-xs text-gray-500">Recopiez le numéro {receipt.number} pour confirmer</span>
          <input className="input w-full" value={confirmNumber} onChange={(e) => setConfirmNumber(e.target.value)} />
        </label>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex flex-col sm:flex-row gap-2">
        <button
          type="submit"
          className={mode === "delete" || mode === "cancel" ? "btn-secondary text-red-700" : "btn-gold"}
          disabled={saving || (needsConfirm && (confirmNumber.trim() !== receipt.number || reason.trim().length < 3))}
        >
          {saving
            ? "Enregistrement…"
            : mode === "edit"
            ? "Enregistrer"
            : mode === "delete"
            ? "Supprimer définitivement"
            : mode === "cancel"
            ? "Annuler le reçu"
            : "Annuler et remplacer"}
        </button>
        <button type="button" className="btn-secondary" onClick={onClose}>
          Fermer
        </button>
      </div>
    </form>
  );
}
