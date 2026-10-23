"use client";

import { useState } from "react";
import { formatEUR, paidOf } from "@/lib/format";
import { readJson, type Notice } from "@/components/Toast";
import { useAuth } from "@/context/AuthContext";

// Modifier / annuler / supprimer une promesse saisie à la main.
// Les places des fêtes et les cotisations se gèrent depuis leur page.
export function canManagePledge(p: any, user: any, can: (perm: any) => boolean): boolean {
  if (!can("saisir_promesses")) return false;
  if (p.kind === "place" || p.kind === "cotisation") return false;
  return can("voir_tout") || p.createdBy === user?.uid;
}

export type PledgeMode = "edit" | "delete";

// Boutons à placer dans la ligne de la promesse.
export function PledgeActionButtons({
  pledge,
  onOpen,
  onChanged,
  onNotice,
}: {
  pledge: any;
  onOpen: (mode: PledgeMode) => void;
  onChanged: (updated: any | null) => void;
  onNotice: (n: Notice) => void;
}) {
  const { user, can } = useAuth();
  const [busy, setBusy] = useState(false);
  if (!canManagePledge(pledge, user, can)) return null;

  const paid = paidOf(pledge);
  const cancelled = pledge.status === "annule";

  async function setStatus(status: "annule" | "en_attente") {
    const text =
      status === "annule"
        ? `Annuler la promesse de ${pledge.donorName} (${formatEUR(pledge.amount)}) ?${paid > 0 ? `\n\nLes ${formatEUR(paid)} déjà réglés restent enregistrés ; le reste ne sera plus demandé.` : ""}`
        : `Rétablir la promesse de ${pledge.donorName} (${formatEUR(pledge.amount)}) ?`;
    if (!confirm(text)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/pledges/${pledge.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await readJson(res);
      onChanged(data.pledge);
      onNotice({ ok: true, text: status === "annule" ? "Promesse annulée." : "Promesse rétablie." });
    } catch (err: any) {
      onNotice({ ok: false, text: err.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {!cancelled && (
        <button onClick={() => onOpen("edit")} disabled={busy} className="btn-secondary text-xs px-2 py-1 print:hidden">
          Modifier
        </button>
      )}
      {cancelled ? (
        <button onClick={() => setStatus("en_attente")} disabled={busy} className="btn-secondary text-xs px-2 py-1 print:hidden">
          Rétablir
        </button>
      ) : paid > 0 ? (
        paid < pledge.amount && (
          <button onClick={() => setStatus("annule")} disabled={busy} className="btn-secondary text-xs px-2 py-1 print:hidden">
            Annuler la promesse
          </button>
        )
      ) : (
        <button
          onClick={() => {
            if (confirm(`Supprimer la promesse de ${pledge.donorName} (${formatEUR(pledge.amount)}, ${pledge.catalogItemName}) ?`)) onOpen("delete");
          }}
          disabled={busy}
          className="btn-secondary text-xs px-2 py-1 text-red-700 print:hidden"
        >
          Supprimer
        </button>
      )}
    </>
  );
}

// Panneau affiché sous la ligne : formulaire de modification ou seconde
// validation de la suppression.
export function PledgeEditPanel({
  pledge,
  mode,
  onClose,
  onChanged,
  onNotice,
}: {
  pledge: any;
  mode: PledgeMode;
  onClose: () => void;
  onChanged: (updated: any | null) => void;
  onNotice: (n: Notice) => void;
}) {
  const paid = paidOf(pledge);
  const [amount, setAmount] = useState(String(pledge.amount));
  const [item, setItem] = useState(pledge.catalogItemName || "");
  const [notes, setNotes] = useState(pledge.notes || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const n = Number(amount);
    if (!(n > 0)) return setError("Le montant doit être positif.");
    if (n < paid) return setError(`Le montant ne peut pas être inférieur à ce qui est déjà réglé (${formatEUR(paid)}).`);
    setBusy(true);
    try {
      const res = await fetch(`/api/pledges/${pledge.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: n, catalogItemName: item, notes }),
      });
      const data = await readJson(res);
      onChanged(data.pledge);
      onNotice({ ok: true, text: `Promesse de ${pledge.donorName} modifiée.` });
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/pledges/${pledge.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      await readJson(res);
      onChanged(null);
      onNotice({ ok: true, text: `Promesse de ${pledge.donorName} supprimée.` });
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (mode === "delete") {
    return (
      <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 space-y-2 text-sm print:hidden">
        <p className="text-red-800">
          Supprimer définitivement cette promesse de {formatEUR(pledge.amount)} ? Elle disparaîtra de la fiche du fidèle et des
          relances. Un lien de paiement déjà envoyé ne fonctionnera plus.
        </p>
        {error && <p className="text-red-700">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <button className="btn-danger text-sm" disabled={busy} onClick={remove}>
            {busy ? "Suppression…" : "Supprimer définitivement"}
          </button>
          <button className="btn-secondary text-sm" disabled={busy} onClick={onClose}>
            Garder la promesse
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={save} className="mt-3 rounded-md bg-gray-50 p-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm print:hidden">
      <div>
        <label className="label">Montant promis (€)</label>
        <input type="number" min={paid > 0 ? paid : 1} step="0.01" className="input" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        {paid > 0 && <p className="text-xs text-gray-500 mt-1">Déjà réglé : {formatEUR(paid)}</p>}
      </div>
      <div>
        <label className="label">Objet</label>
        <input className="input" value={item} onChange={(e) => setItem(e.target.value)} required />
      </div>
      <div>
        <label className="label">Notes</label>
        <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      {error && <p className="sm:col-span-3 text-red-700">{error}</p>}
      <p className="sm:col-span-3 text-xs text-gray-500">
        Les liens de paiement déjà envoyés demanderont automatiquement le nouveau reste dû.
      </p>
      <div className="sm:col-span-3 flex flex-wrap gap-2">
        <button type="submit" className="btn-primary text-sm" disabled={busy}>
          {busy ? "Enregistrement…" : "Enregistrer"}
        </button>
        <button type="button" className="btn-secondary text-sm" disabled={busy} onClick={onClose}>
          Annuler
        </button>
      </div>
    </form>
  );
}
