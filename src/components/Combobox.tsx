"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { filterByQuery } from "@/lib/search";

export interface ComboOption {
  value: string;
  label: string;
  hint?: string; // texte secondaire (date…), aussi pris en compte par la recherche
}

// Liste déroulante avec recherche : la liste complète s'ouvre au clic, et la
// saisie la filtre (casse et accents ignorés, n'importe quel mot du libellé).
// Clavier : flèches, Entrée, Échap. Au doigt : toucher une ligne la choisit.
export default function Combobox({
  options,
  value,
  onChange,
  placeholder = "Rechercher…",
  emptyLabel,
  required,
  className = "",
}: {
  options: ComboOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyLabel?: string; // choix « vide » (value "") proposé en tête de liste
  required?: boolean;
  className?: string;
}) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const selected = options.find((o) => o.value === value);
  const selectedText = selected ? selected.label + (selected.hint ? ` · ${selected.hint}` : "") : "";

  const shown = useMemo(() => {
    const found = filterByQuery(options, query, (o) => `${o.label} ${o.hint || ""}`);
    return emptyLabel !== undefined && !query ? [{ value: "", label: emptyLabel }, ...found] : found;
  }, [options, query, emptyLabel]);

  // À l'ouverture, se placer sur l'élément choisi ; pendant la saisie, sur le premier résultat.
  useEffect(() => {
    if (!open) return;
    const i = query ? 0 : shown.findIndex((o) => o.value === value);
    setActive(i >= 0 ? i : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, query]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.children[active] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  function openList() {
    setQuery("");
    setOpen(true);
  }

  function choose(o: ComboOption) {
    onChange(o.value);
    setQuery("");
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return openList();
      const n = shown.length;
      if (n) setActive((a) => (e.key === "ArrowDown" ? (a + 1) % n : (a - 1 + n) % n));
    } else if (e.key === "Enter") {
      if (open && shown[active]) {
        e.preventDefault();
        choose(shown[active]);
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        setQuery("");
        setOpen(false);
      }
    } else if (e.key === "Tab" && open && query && shown[active]) {
      choose(shown[active]);
    }
  }

  return (
    <div className={`relative ${className}`}>
      <input
        ref={inputRef}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && shown[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
        required={required}
        className="input pr-14 [@media(pointer:coarse)]:pr-24"
        placeholder={open ? "Tapez pour filtrer…" : placeholder}
        value={open ? query : selectedText}
        onFocus={openList}
        onClick={() => !open && openList()}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onBlur={() => {
          setQuery("");
          setOpen(false);
        }}
        onKeyDown={onKeyDown}
      />
      <div className="absolute inset-y-0 right-2 flex items-center gap-1 text-gray-400">
        {value && emptyLabel !== undefined && !open && (
          <button
            type="button"
            aria-label="Effacer"
            className="tap grid place-items-center p-1 hover:text-ink"
            onClick={() => onChange("")}
          >
            <X size={14} />
          </button>
        )}
        <button
          type="button"
          tabIndex={-1}
          aria-label={open ? "Fermer la liste" : "Ouvrir la liste"}
          className="tap grid place-items-center p-1 hover:text-ink"
          // mousedown évite que le champ perde le focus avant le clic.
          onMouseDown={(e) => {
            e.preventDefault();
            if (open) setOpen(false);
            else inputRef.current?.focus();
          }}
        >
          <ChevronDown size={16} className={open ? "rotate-180 transition" : "transition"} />
        </button>
      </div>
      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          onMouseDown={(e) => e.preventDefault()}
          className="absolute z-20 mt-1 w-full max-h-64 overflow-auto rounded-xl border border-gray-200 bg-white py-1 shadow-soft"
        >
          {shown.map((o, i) => (
            <li
              key={o.value || "__empty"}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={o.value === value}
              className={`flex cursor-pointer items-baseline justify-between gap-3 px-3 py-3 text-sm ${
                i === active ? "bg-cream" : ""
              } ${o.value === value ? "font-semibold text-ink" : "text-gray-800"} ${!o.value ? "text-gray-500" : ""}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(o)}
            >
              <span>{o.label}</span>
              {o.hint && <span className="shrink-0 text-xs text-gray-400">{o.hint}</span>}
            </li>
          ))}
          {shown.length === 0 && <li className="px-3 py-2.5 text-sm text-gray-400">Aucun résultat.</li>}
        </ul>
      )}
    </div>
  );
}
