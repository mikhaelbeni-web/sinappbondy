"use client";

import { useEffect } from "react";

export type Notice = { ok: boolean; text: string };

// Message fixé en bas de l'écran : toujours visible, quelle que soit la
// position de défilement au moment du clic.
export default function Toast({ notice, onClose }: { notice: Notice | null; onClose: () => void }) {
  useEffect(() => {
    if (!notice?.ok) return; // une erreur reste affichée jusqu'à fermeture
    const t = setTimeout(onClose, 8000);
    return () => clearTimeout(t);
  }, [notice, onClose]);

  if (!notice) return null;
  return (
    <div
      role="status"
      className={`fixed bottom-4 inset-x-4 sm:left-auto sm:right-6 sm:max-w-md z-50 rounded-xl px-4 py-3 shadow-soft text-sm text-white flex items-start gap-3 print:hidden ${
        notice.ok ? "bg-green-700" : "bg-red-700"
      }`}
    >
      <p className="flex-1 break-words">{notice.text}</p>
      <button onClick={onClose} className="font-bold leading-none" aria-label="Fermer">
        ×
      </button>
    </div>
  );
}

// Lit une réponse JSON ; une page d'erreur (délai dépassé, plantage) donne un message clair.
export async function readJson(res: Response): Promise<any> {
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `le serveur n'a pas répondu correctement (code ${res.status}).`);
  return data || {};
}
