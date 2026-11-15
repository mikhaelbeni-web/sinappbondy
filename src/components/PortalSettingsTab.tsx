"use client";

import { useEffect, useState } from "react";
import { PHOTO_CATEGORIES, type PortalSettings } from "@/lib/portal";

// Administration > Portail des fidèles : textes, contacts, activités et photos
// affichés sur les pages publiques. Les horaires viennent de l'onglet Écran louah.
export default function PortalSettingsTab() {
  const [p, setP] = useState<PortalSettings | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/portal")
      .then((r) => r.json())
      .then((d) => setP(d.portal));
  }, []);

  async function save() {
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/portal", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) });
    const d = await res.json();
    if (res.ok) setP(d.portal);
    setMessage(res.ok ? { ok: true, text: "Enregistré : le portail est à jour." } : { ok: false, text: d.error });
    setSaving(false);
  }

  if (!p) return <p className="text-gray-500">Chargement…</p>;

  const field = (key: keyof PortalSettings, label: string, opts: { type?: string; auto?: string; area?: number } = {}) => (
    <div>
      <label className="label" htmlFor={`portal-${key}`}>{label}</label>
      {opts.area ? (
        <textarea id={`portal-${key}`} className="input" rows={opts.area} value={p[key] as string} onChange={(e) => setP({ ...p, [key]: e.target.value })} />
      ) : (
        <input
          id={`portal-${key}`}
          type={opts.type || "text"}
          autoComplete={opts.auto || "off"}
          className="input"
          value={p[key] as string}
          onChange={(e) => setP({ ...p, [key]: e.target.value })}
        />
      )}
    </div>
  );

  const setService = (i: number, k: "title" | "text", v: string) => setP({ ...p, services: p.services.map((s, j) => (j === i ? { ...s, [k]: v } : s)) });
  const setPhoto = (i: number, k: string, v: string) => setP({ ...p, photos: p.photos.map((s, j) => (j === i ? { ...s, [k]: v } : s)) });
  const movePhoto = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= p.photos.length) return;
    const photos = [...p.photos];
    [photos[i], photos[j]] = [photos[j], photos[i]];
    setP({ ...p, photos });
  };

  return (
    <div className="space-y-4">
      <div className="card p-4 space-y-4">
        <p className="text-sm text-gray-600">
          Ces informations s'affichent sur le <a href="/" target="_blank" rel="noreferrer" className="text-gold underline">portail des fidèles</a>.
          Les horaires des offices et les annonces se règlent dans l'onglet « Écran louah ».
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {field("displayName", "Nom affiché")}
          {field("tagline", "Sous-titre")}
          {field("phone", "Téléphone", { type: "tel", auto: "tel" })}
          {field("email", "E-mail de contact", { type: "email", auto: "email" })}
          {field("address", "Adresse", { auto: "street-address" })}
          <div className="grid grid-cols-2 gap-3">
            {field("postalCode", "Code postal", { auto: "postal-code" })}
            {field("city", "Ville", { auto: "address-level2" })}
          </div>
        </div>
        {field("intro", "Phrase d'accueil", { area: 2 })}
        {field("history", "Notre histoire (une ligne vide entre deux paragraphes)", { area: 8 })}
        {field("heroPhoto", "Photo du bandeau d'accueil (chemin ou adresse https)")}
      </div>

      <div className="card p-4 space-y-3">
        <h2 className="font-semibold text-ink">Activités de la communauté</h2>
        {p.services.map((s, i) => (
          <div key={i} className="flex flex-col sm:flex-row gap-2">
            <input aria-label={`Titre de l'activité ${i + 1}`} className="input sm:w-56" value={s.title} onChange={(e) => setService(i, "title", e.target.value)} />
            <input aria-label={`Description de l'activité ${i + 1}`} className="input" value={s.text} onChange={(e) => setService(i, "text", e.target.value)} />
            <button className="text-red-600 hover:underline text-sm shrink-0 text-left tap" onClick={() => setP({ ...p, services: p.services.filter((_, j) => j !== i) })}>
              Retirer
            </button>
          </div>
        ))}
        <button className="text-gold hover:underline text-sm tap" onClick={() => setP({ ...p, services: [...p.services, { title: "", text: "" }] })}>
          + Ajouter une activité
        </button>
      </div>

      <div className="card p-4 space-y-3">
        <h2 className="font-semibold text-ink">Photos de la galerie</h2>
        <p className="text-xs text-gray-500">
          La description est lue par les lecteurs d'écran : décrivez ce que montre la photo. Ne publiez une personne reconnaissable qu'avec son accord.
        </p>
        <ul className="space-y-3">
          {p.photos.map((ph, i) => (
            <li key={i} className="flex flex-col sm:flex-row gap-3 sm:items-center border-b border-gray-100 pb-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {ph.src ? <img src={ph.src} alt="" className="w-24 h-16 object-cover rounded-lg bg-gray-100 shrink-0" /> : <div className="w-24 h-16 rounded-lg bg-gray-100 shrink-0" />}
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input aria-label={`Chemin de la photo ${i + 1}`} className="input" value={ph.src} onChange={(e) => setPhoto(i, "src", e.target.value)} />
                <input aria-label={`Description de la photo ${i + 1}`} className="input sm:col-span-2" value={ph.alt} onChange={(e) => setPhoto(i, "alt", e.target.value)} />
                <select aria-label={`Catégorie de la photo ${i + 1}`} className="input" value={ph.category} onChange={(e) => setPhoto(i, "category", e.target.value)}>
                  {PHOTO_CATEGORIES.map((c) => (
                    <option key={c.key} value={c.key}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 shrink-0">
                <button className="btn-secondary px-3" aria-label="Monter" onClick={() => movePhoto(i, -1)}>↑</button>
                <button className="btn-secondary px-3" aria-label="Descendre" onClick={() => movePhoto(i, 1)}>↓</button>
                <button className="text-red-600 hover:underline text-sm tap" onClick={() => setP({ ...p, photos: p.photos.filter((_, j) => j !== i) })}>
                  Retirer
                </button>
              </div>
            </li>
          ))}
        </ul>
        <button className="text-gold hover:underline text-sm tap" onClick={() => setP({ ...p, photos: [...p.photos, { src: "", alt: "", category: "synagogue" }] })}>
          + Ajouter une photo (adresse https)
        </button>
      </div>

      {message && (
        <p role={message.ok ? "status" : "alert"} className={`text-sm ${message.ok ? "text-green-700" : "text-red-600"}`}>{message.text}</p>
      )}
      <button className="btn-primary" disabled={saving} onClick={save}>{saving ? "Enregistrement…" : "Enregistrer"}</button>
    </div>
  );
}
