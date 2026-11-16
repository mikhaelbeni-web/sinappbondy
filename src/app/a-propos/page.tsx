import type { Metadata } from "next";
import { MapPin, Phone, Mail } from "lucide-react";
import PortalShell, { PortalHero } from "@/components/portal/PortalShell";
import { getPortal } from "@/lib/portalServer";
import { fullAddress, mapUrl, telHref } from "@/lib/portal";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Notre histoire et contact" };

export default async function AProposPage() {
  const portal = await getPortal();
  const photo = portal.photos.find((p) => p.category === "synagogue");
  return (
    <PortalShell portal={portal}>
      <PortalHero photo={portal.heroPhoto} eyebrow="À propos" title="Notre histoire" subtitle={portal.tagline} />
      <div className="max-w-6xl mx-auto px-4 -mt-8 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <article className="card p-6 lg:col-span-2 space-y-4 text-gray-700 leading-relaxed">
          {portal.history.split(/\n\s*\n/).map((para, i) => (
            <p key={i}>{para.trim()}</p>
          ))}
          {photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo.src} alt={photo.alt} width={photo.width} height={photo.height} className="w-full h-auto rounded-2xl mt-2" />
          )}
        </article>
        <aside className="card p-6 space-y-4 self-start" aria-labelledby="titre-contact">
          <h2 id="titre-contact" className="text-xl font-bold text-ink">Contact et accès</h2>
          <a href={mapUrl(portal)} target="_blank" rel="noreferrer" className="tap flex gap-3 text-gray-700 hover:text-ink">
            <MapPin className="w-5 h-5 text-gold shrink-0" aria-hidden /> {fullAddress(portal)}
          </a>
          {portal.phone && (
            <a href={telHref(portal.phone)} className="tap flex gap-3 text-gray-700 hover:text-ink">
              <Phone className="w-5 h-5 text-gold shrink-0" aria-hidden /> {portal.phone}
            </a>
          )}
          {portal.email && (
            <a href={`mailto:${portal.email}`} className="tap flex gap-3 text-gray-700 hover:text-ink break-all">
              <Mail className="w-5 h-5 text-gold shrink-0" aria-hidden /> {portal.email}
            </a>
          )}
          <a href={mapUrl(portal)} target="_blank" rel="noreferrer" className="btn-primary w-full">Ouvrir l'itinéraire</a>
        </aside>
      </div>
    </PortalShell>
  );
}
