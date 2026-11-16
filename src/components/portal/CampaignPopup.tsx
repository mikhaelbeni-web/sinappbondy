"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { HeartHandshake, X } from "lucide-react";
import { formatEUR } from "@/lib/format";
import type { FeaturedCampaign } from "@/lib/campaigns";

// Fenêtre d'accueil de la campagne mise en avant : s'ouvre une fois par
// visite, peu après l'arrivée sur le portail. Se ferme par la croix, la
// touche Échap ou un clic à côté ; respecte « réduire les animations ».
export default function CampaignPopup({ campaign, photo }: { campaign: FeaturedCampaign; photo?: string }) {
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false); // déclenche l'animation d'entrée
  const closeRef = useRef<HTMLButtonElement>(null);
  const key = `campagne-vue-${campaign.id}`;
  const pct = campaign.goal > 0 ? Math.min(100, Math.round((campaign.raised / campaign.goal) * 100)) : null;

  useEffect(() => {
    try {
      if (sessionStorage.getItem(key)) return;
    } catch {}
    const t = setTimeout(() => setOpen(true), 700);
    return () => clearTimeout(t);
  }, [key]);

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => setShown(true));
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function close() {
    try {
      sessionStorage.setItem(key, "1");
    } catch {}
    setShown(false);
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-ink-dark/70 backdrop-blur-sm transition-opacity duration-300 motion-reduce:transition-none ${shown ? "opacity-100" : "opacity-0"}`}
      onClick={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="campagne-titre"
        onClick={(e) => e.stopPropagation()}
        className={`relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl transition-all duration-500 ease-out motion-reduce:transition-none ${
          shown ? "translate-y-0 sm:scale-100 opacity-100" : "translate-y-10 sm:scale-95 opacity-0"
        }`}
      >
        <div className="relative bg-ink-dark text-white px-6 pt-8 pb-6 overflow-hidden">
          {photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover opacity-30" />
          )}
          <div className="absolute inset-0 bg-gradient-to-br from-ink-dark/95 via-ink/80 to-ink-light/60" aria-hidden />
          <div className="relative">
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-gold-sand">
              <span className="relative flex w-2 h-2" aria-hidden>
                <span className="absolute inline-flex h-full w-full rounded-full bg-gold-sand opacity-75 animate-ping motion-reduce:hidden" />
                <span className="relative inline-flex rounded-full w-2 h-2 bg-gold-sand" />
              </span>
              Campagne de dons en cours
            </p>
            <h2 id="campagne-titre" className="text-2xl sm:text-3xl font-extrabold mt-2 leading-tight pr-8">{campaign.title}</h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={close}
            aria-label="Fermer"
            className="absolute top-3 right-3 tap inline-flex items-center justify-center w-11 h-11 rounded-full text-white/90 hover:bg-white/15"
          >
            <X className="w-5 h-5" aria-hidden />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {campaign.description && <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line line-clamp-5">{campaign.description}</p>}
          {pct !== null ? (
            <div>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-2xl font-extrabold text-ink">{formatEUR(campaign.raised)}</p>
                <p className="text-sm text-gray-600">sur {formatEUR(campaign.goal)}</p>
              </div>
              <div className="mt-2 h-3 rounded-full bg-cream overflow-hidden" role="img" aria-label={`${pct} % de l'objectif atteint`}>
                <div
                  className="h-full rounded-full bg-gradient-to-r from-gold to-gold-sand transition-[width] duration-1000 ease-out delay-300 motion-reduce:transition-none"
                  style={{ width: shown ? `${Math.max(pct, 3)}%` : "0%" }}
                />
              </div>
              <p className="text-xs text-gray-600 mt-1">
                {pct} % de l'objectif{campaign.donations > 0 ? ` · ${campaign.donations} don${campaign.donations > 1 ? "s" : ""}` : ""}
              </p>
            </div>
          ) : (
            campaign.raised > 0 && (
              <p className="text-sm text-gray-700">
                <strong className="text-ink text-lg">{formatEUR(campaign.raised)}</strong> déjà collectés
              </p>
            )
          )}
          <div className="flex flex-col gap-2">
            <Link href={`/don/${campaign.slug}`} onClick={close} className="btn bg-gold-sand text-ink-dark hover:bg-gold-light px-6 py-3 text-base w-full">
              <HeartHandshake className="w-5 h-5" aria-hidden /> Je participe
            </Link>
            <button type="button" onClick={close} className="tap justify-center text-sm font-semibold text-gray-600 hover:text-ink w-full">
              Plus tard
            </button>
          </div>
          <p className="text-xs text-gray-500 text-center">Paiement sécurisé, reçu fiscal automatique.</p>
        </div>
      </div>
    </div>
  );
}
