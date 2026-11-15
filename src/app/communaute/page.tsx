import Link from "next/link";
import type { Metadata } from "next";
import { HeartHandshake, Droplets, Phone } from "lucide-react";
import PortalShell, { PortalHero } from "@/components/portal/PortalShell";
import { getPortal, upcomingEvents } from "@/lib/portalServer";
import { formatEUR } from "@/lib/format";
import { frDay, telHref } from "@/lib/portal";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Vie de la communauté" };

export default async function CommunautePage() {
  const [portal, events] = await Promise.all([getPortal(), upcomingEvents(12).catch(() => [])]);

  return (
    <PortalShell portal={portal}>
      <PortalHero eyebrow="Communauté" title="La vie de la communauté" subtitle="Prières, cours, enfants, fêtes de famille et entraide." />
      <div className="max-w-6xl mx-auto px-4 -mt-8 space-y-12">
        <section aria-label="Activités" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {portal.services.map((s) => (
            <article key={s.title} className="card p-5">
              <h2 className="font-bold text-ink text-lg">{s.title}</h2>
              <span className="block w-8 h-0.5 rounded-full bg-gold-sand mt-2" aria-hidden />
              <p className="text-sm text-gray-600 mt-3">{s.text}</p>
            </article>
          ))}
        </section>

        <section aria-labelledby="titre-agenda">
          <h2 id="titre-agenda" className="text-2xl font-bold text-ink">Agenda</h2>
          {events.length === 0 ? (
            <p className="mt-3 text-sm text-gray-600">Aucun événement ouvert aux inscriptions pour le moment.</p>
          ) : (
            <ul className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {events.map((e) => (
                <li key={e.slug}>
                  <Link href={`/evenement/${e.slug}`} className="card p-5 flex flex-col sm:flex-row sm:items-center gap-3 hover:ring-2 hover:ring-gold-sand/60">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold uppercase text-gold capitalize">{frDay(e.date)}</p>
                      <p className="font-bold text-ink mt-1">{e.title}</p>
                      <p className="text-sm text-gray-600">{e.price > 0 ? `${formatEUR(e.price)} par place` : "Entrée libre"}{e.location ? ` · ${e.location}` : ""}</p>
                    </div>
                    <span className="btn-secondary shrink-0">S'inscrire</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card p-5">
            <Droplets className="w-6 h-6 text-gold" aria-hidden />
            <h2 className="font-bold text-ink mt-2">Mikvé</h2>
            <p className="text-sm text-gray-600 mt-1">Réservez votre créneau en ligne, en toute discrétion.</p>
            <Link href="/mikve" className="btn-secondary mt-4">Réserver</Link>
          </div>
          <div className="card p-5">
            <HeartHandshake className="w-6 h-6 text-gold" aria-hidden />
            <h2 className="font-bold text-ink mt-2">Soutenir la synagogue</h2>
            <p className="text-sm text-gray-600 mt-1">Chaque don finance l'entretien, les cours et l'entraide. Reçu fiscal automatique.</p>
            <Link href="/don" className="btn-primary mt-4">Faire un don</Link>
          </div>
          <div className="card p-5">
            <Phone className="w-6 h-6 text-gold" aria-hidden />
            <h2 className="font-bold text-ink mt-2">Kiddouch, salons, Bar Mitsva</h2>
            <p className="text-sm text-gray-600 mt-1">Pour parrainer un kiddouch, réserver les salons ou préparer une Bar Mitsva, contactez le secrétariat.</p>
            {portal.phone && <a href={telHref(portal.phone)} className="btn-secondary mt-4">{portal.phone}</a>}
          </div>
        </section>
      </div>
    </PortalShell>
  );
}
