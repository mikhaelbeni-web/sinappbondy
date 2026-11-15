"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { PHOTO_CATEGORIES, type PortalPhoto } from "@/lib/portal";

// Galerie filtrable avec visionneuse (clavier : Échap, flèches gauche/droite).
export default function Gallery({ photos }: { photos: PortalPhoto[] }) {
  const [filter, setFilter] = useState<string>("toutes");
  const [open, setOpen] = useState<number | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);

  const categories = PHOTO_CATEGORIES.filter((c) => photos.some((p) => p.category === c.key));
  const shown = filter === "toutes" ? photos : photos.filter((p) => p.category === filter);

  const close = useCallback(() => {
    setOpen(null);
    lastFocus.current?.focus();
  }, []);
  const move = useCallback((d: number) => setOpen((i) => (i === null ? null : (i + d + shown.length) % shown.length)), [shown.length]);

  useEffect(() => {
    if (open === null) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") move(1);
      if (e.key === "ArrowLeft") move(-1);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, close, move]);

  if (photos.length === 0) return <p className="card p-5 text-sm text-gray-600">Les photos arrivent bientôt.</p>;

  const current = open !== null ? shown[open] : null;

  return (
    <div>
      {categories.length > 1 && (
        <div role="group" aria-label="Filtrer les photos" className="flex flex-wrap gap-2">
          {[{ key: "toutes", label: "Toutes" }, ...categories].map((c) => (
            <button
              key={c.key}
              type="button"
              aria-pressed={filter === c.key}
              onClick={() => setFilter(c.key)}
              className={filter === c.key ? "chip-active" : "chip"}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      <ul className="mt-5 columns-1 sm:columns-2 lg:columns-3 gap-4 [&>li]:mb-4">
        {shown.map((p, i) => (
          <li key={p.src} className="break-inside-avoid">
            <button
              type="button"
              onClick={(e) => {
                lastFocus.current = e.currentTarget;
                setOpen(i);
              }}
              className="block w-full overflow-hidden rounded-2xl shadow-soft focus-visible:ring-4 focus-visible:ring-ink/40 group"
              aria-label={`Agrandir : ${p.alt}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.src}
                alt={p.alt}
                width={p.width}
                height={p.height}
                loading={i < 3 ? "eager" : "lazy"}
                className="w-full h-auto bg-gray-100 group-hover:scale-[1.03] transition-transform duration-300 motion-reduce:transition-none"
              />
            </button>
          </li>
        ))}
      </ul>

      {current && (
        <div role="dialog" aria-modal="true" aria-label={current.alt} className="fixed inset-0 z-50 bg-ink-dark/95 flex flex-col" onClick={close}>
          <div className="flex items-center justify-between p-3 text-white">
            <p className="text-sm px-2">
              {open! + 1} / {shown.length}
            </p>
            <button ref={closeRef} type="button" onClick={close} aria-label="Fermer" className="tap inline-flex items-center justify-center w-11 h-11 rounded-full hover:bg-white/10">
              <X className="w-6 h-6" aria-hidden />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center px-2 min-h-0" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => move(-1)} aria-label="Photo précédente" className="tap hidden sm:inline-flex items-center justify-center w-11 h-11 rounded-full text-white hover:bg-white/10 shrink-0">
              <ChevronLeft className="w-7 h-7" aria-hidden />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={current.src} alt={current.alt} className="max-h-full max-w-full object-contain rounded-xl" />
            <button type="button" onClick={() => move(1)} aria-label="Photo suivante" className="tap hidden sm:inline-flex items-center justify-center w-11 h-11 rounded-full text-white hover:bg-white/10 shrink-0">
              <ChevronRight className="w-7 h-7" aria-hidden />
            </button>
          </div>
          <div className="p-4 text-center text-white/90 text-sm" onClick={(e) => e.stopPropagation()}>
            <p>{current.alt}</p>
            <div className="sm:hidden mt-3 flex justify-center gap-3">
              <button type="button" onClick={() => move(-1)} className="btn border border-white/40 text-white">Précédente</button>
              <button type="button" onClick={() => move(1)} className="btn border border-white/40 text-white">Suivante</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
