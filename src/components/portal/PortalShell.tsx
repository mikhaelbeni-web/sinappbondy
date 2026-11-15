import Link from "next/link";
import { MapPin, Phone, Mail } from "lucide-react";
import PortalNav from "./PortalNav";
import StaffLink from "./StaffLink";
import { PORTAL_LINKS, fullAddress, mapUrl, telHref, type PortalSettings } from "@/lib/portal";

// Gabarit des pages du portail public : barre de navigation, contenu,
// pied de page avec contacts, liens utiles et mentions obligatoires.
export default function PortalShell({ portal, children }: { portal: PortalSettings; children: React.ReactNode }) {
  const year = new Date().getFullYear();
  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <PortalNav name={portal.displayName} tagline={portal.tagline} />
      <main id="contenu" className="flex-1">
        {children}
      </main>
      <footer className="bg-ink-dark text-white/80 mt-16">
        <div className="max-w-6xl mx-auto px-4 py-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 text-sm">
          <div className="space-y-3">
            <p className="font-bold text-white text-base">{portal.displayName}</p>
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

// En-tête de page intérieure du portail (titre + sous-titre + trait doré).
export function PortalHero({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  return (
    <section className="bg-gradient-to-br from-ink-dark via-ink to-ink-light text-white rounded-b-[2rem]">
      <div className="max-w-6xl mx-auto px-4 pt-10 pb-14">
        {eyebrow && <p className="text-xs font-semibold uppercase tracking-widest text-gold-sand">{eyebrow}</p>}
        <h1 className="text-3xl sm:text-4xl font-bold mt-1">{title}</h1>
        {subtitle && <p className="text-white/80 mt-2 max-w-2xl">{subtitle}</p>}
        <span className="block w-14 h-1 rounded-full bg-gold-sand mt-4" />
      </div>
    </section>
  );
}
