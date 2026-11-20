import Link from "next/link";
import { MapPin, Phone, Mail } from "lucide-react";
import PortalNav from "./PortalNav";
import StaffLink from "./StaffLink";
import { PORTAL_LINKS, fullAddress, mapUrl, telHref, type PortalSettings } from "@/lib/portal";

// Gabarit des pages du portail public : barre de navigation, contenu,
// pied de page avec contacts, liens utiles et mentions obligatoires.
export default function PortalShell({ portal, children }: { portal: PortalSettings; children: React.ReactNode }) {
  const year = new Date().getFullYear();
  // Bas de page : une photo du lieu, différente de celle du bandeau si possible.
  const footerPhoto = portal.photos.find((p) => p.src !== portal.heroPhoto && p.category === "synagogue")?.src || portal.photos.find((p) => p.src !== portal.heroPhoto)?.src || portal.heroPhoto;
  return (
    <div className="theme-portail min-h-screen bg-cream flex flex-col">
      {/* Barre de contact, au-dessus de la navigation. */}
      <div className="bg-ink-dark text-white/85 text-xs">
        <div className="max-w-6xl mx-auto px-4 py-2 [@media(pointer:coarse)]:py-0 flex flex-wrap gap-x-5 gap-y-1">
          {portal.phone && (
            <a href={telHref(portal.phone)} className="tap inline-flex items-center gap-1.5 hover:text-white">
              <Phone className="w-3.5 h-3.5" aria-hidden /> {portal.phone}
            </a>
          )}
          <a href={mapUrl(portal)} target="_blank" rel="noreferrer" className="tap hidden sm:inline-flex items-center gap-1.5 hover:text-white">
            <MapPin className="w-3.5 h-3.5" aria-hidden /> {fullAddress(portal)}
          </a>
        </div>
      </div>
      <PortalNav name={portal.displayName} tagline={portal.tagline} />
      <main id="contenu" className="flex-1">
        {children}
      </main>
      <footer className="bg-ink-dark text-white/80 mt-16">
        {footerPhoto && (
          <div className="relative h-44 sm:h-64 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={footerPhoto} alt="" aria-hidden loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-ink-dark/10 via-ink-dark/20 to-ink-dark" aria-hidden />
          </div>
        )}
        <div className="max-w-6xl mx-auto px-4 py-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 text-sm">
          <div className="space-y-3">
            <p className="titre-serif text-white text-xl">{portal.displayName}</p>
            <p>{portal.tagline}</p>
            <span className="block w-12 h-1 rounded-full bg-gold-sand" />
          </div>
          <div className="space-y-2">
            <p className="font-semibold text-white">Nous trouver</p>
            <a href={mapUrl(portal)} target="_blank" rel="noreferrer" className="tap flex gap-2 hover:text-white">
              <MapPin className="w-4 h-4 mt-0.5 shrink-0" aria-hidden /> {fullAddress(portal)}
            </a>
            {portal.phone && (
              <a href={telHref(portal.phone)} className="tap flex gap-2 hover:text-white">
                <Phone className="w-4 h-4 mt-0.5 shrink-0" aria-hidden /> {portal.phone}
              </a>
            )}
            {portal.email && (
              <a href={`mailto:${portal.email}`} className="tap flex gap-2 hover:text-white break-all">
                <Mail className="w-4 h-4 mt-0.5 shrink-0" aria-hidden /> {portal.email}
              </a>
            )}
          </div>
          <nav aria-label="Liens du portail" className="space-y-2">
            <p className="font-semibold text-white">Le portail</p>
            <ul className="space-y-1">
              {PORTAL_LINKS.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="tap hover:text-white">{l.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label="Services en ligne" className="space-y-2">
            <p className="font-semibold text-white">En ligne</p>
            <ul className="space-y-1">
              <li><Link href="/don" className="tap hover:text-white">Faire un don</Link></li>
              <li><Link href="/espace" className="tap hover:text-white">Mon espace fidèle</Link></li>
              <li><Link href="/places" className="tap hover:text-white">Réserver ma place</Link></li>
              <li><Link href="/kiddouch" className="tap hover:text-white">Parrainer un kiddouch</Link></li>
              <li><Link href="/salons" className="tap hover:text-white">Réserver les salons</Link></li>
              <li><Link href="/mikve" className="tap hover:text-white">Réserver le mikvé</Link></li>
            </ul>
          </nav>
        </div>
        <div className="border-t border-white/10">
          <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between text-xs text-white/70">
            <p>© {year} {portal.displayName}</p>
            <div className="flex flex-wrap gap-x-4">
              <Link href="/mentions-legales" className="tap hover:text-white">Mentions légales</Link>
              <Link href="/confidentialite" className="tap hover:text-white">Confidentialité</Link>
              <StaffLink />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Titre dont le dernier mot est en or (un seul mot : laissé tel quel).
export function MotOr({ text }: { text: string }) {
  const words = text.trim().split(/\s+/);
  if (words.length < 2) return <>{text}</>;
  const last = words.pop();
  return (
    <>
      {words.join(" ")} <span className="mot-or">{last}</span>
    </>
  );
}

// En-tête de page intérieure du portail (titre + sous-titre + trait doré).
// En-tête des pages du portail. Avec une photo, celle-ci reste bien visible :
// le voile n'est dense que du côté du texte (à gauche) et s'efface vers
// la droite ; sur téléphone il reste plus soutenu, le texte couvrant la largeur.
// La photo est un fond CSS et la section n'est pas positionnée : les cartes
// qui remontent sur l'en-tête (-mt-8) passent ainsi devant lui.
export function PortalHero({ eyebrow, title, subtitle, photo }: { eyebrow?: string; title: string; subtitle?: string; photo?: string }) {
  const veil = "linear-gradient(90deg, rgb(var(--ink-dark) / 0.92) 0%, rgb(var(--ink-dark) / var(--veil-mid)) 50%, rgb(var(--ink-dark) / var(--veil-end)) 100%)";
  return (
    <section
      className={`text-white rounded-b-[2rem] bg-cover bg-center [--veil-mid:0.72] [--veil-end:0.45] sm:[--veil-mid:0.55] sm:[--veil-end:0.05] ${photo ? "bg-ink-dark" : "bg-gradient-to-br from-ink-dark via-ink to-ink-light"}`}
      style={photo ? { backgroundImage: `${veil}, url("${photo.replace(/"/g, "%22")}")` } : undefined}
    >
      <div className="max-w-6xl mx-auto px-4 pt-12 pb-16 sm:pt-16 sm:pb-20 [text-shadow:0_1px_8px_rgb(var(--ink-dark)_/_0.7)]">
        {eyebrow && <p className="text-xs font-semibold uppercase tracking-widest text-gold-sand">{eyebrow}</p>}
        <h1 className="sur-sombre text-4xl sm:text-5xl font-bold mt-1"><MotOr text={title} /></h1>
        {subtitle && <p className="text-white/90 mt-2 max-w-2xl">{subtitle}</p>}
        <span className="block w-14 h-1 rounded-full bg-gold-sand mt-4" />
      </div>
    </section>
  );
}
