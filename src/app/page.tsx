import Link from "next/link";
import type { Metadata } from "next";
import { Armchair, CalendarDays, Wine, PartyPopper, Clock, Flame, HeartHandshake, UserRound, Images, Droplets, Sparkles, ArrowRight, MapPin, Phone } from "lucide-react";
import PortalShell from "@/components/portal/PortalShell";
import { getPortal, upcomingEvents, upcomingHolidays, weekInfo } from "@/lib/portalServer";
import { publishedPlans } from "@/lib/seatingServer";
import { featuredCampaign } from "@/lib/campaigns";
import CampaignPopup from "@/components/portal/CampaignPopup";
import { formatEUR } from "@/lib/format";
import { frDay, frRange, fullAddress, mapUrl, telHref } from "@/lib/portal";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const p = await getPortal();
  return { title: `${p.displayName} – ${p.tagline}`, description: p.intro };
}

// Accueil du portail des fidèles (page publique).
export default async function PortalHome() {
  const [portal, week, events, plans, campaign] = await Promise.all([
    getPortal(),
    weekInfo().catch(() => null),
    upcomingEvents(3).catch(() => []),
    publishedPlans().catch(() => []),
    featuredCampaign(),
  ]);
  const campaignPct = campaign && campaign.goal > 0 ? Math.min(100, Math.round((campaign.raised / campaign.goal) * 100)) : null;
  // Le bouton du bandeau n'apparaît que lorsqu'un plan a ses ventes ouvertes ;
  // la carte « Réserver ma place » de la rubrique En ligne est toujours là.
  const openPlan = plans.find((p) => p.salesOpen);
  const holidays = upcomingHolidays(120);
  const nextHoliday = holidays[0];

  const actions = [
    {
      href: "/places",
      icon: Armchair,
      title: "Réserver ma place",
      text: openPlan ? `${openPlan.name} : choisissez vos places sur le plan.` : "Places des fêtes, à choisir sur le plan de la synagogue.",
    },
    { href: "/don", icon: HeartHandshake, title: "Faire un don", text: "Paiement sécurisé, reçu fiscal automatique." },
    { href: "/espace", icon: UserRound, title: "Mon espace fidèle", text: "Promesses, paiements et reçus, sans mot de passe." },
    { href: "/kiddouch", icon: Wine, title: "Parrainer un kiddouch", text: "Choisissez un Chabbat et dédiez le kiddouch ou la séouda." },
    { href: "/salons", icon: PartyPopper, title: "Réserver les salons", text: "Mariage, Bar Mitsva, Brit Mila : envoyez votre demande." },
    { href: "/mikve", icon: Droplets, title: "Réserver le mikvé", text: "Choisissez un créneau en ligne." },
  ];

  return (
    <PortalShell portal={portal}>
      {/* Bandeau d'accueil */}
      <section className="relative overflow-hidden bg-ink-dark text-white rounded-b-[2rem]">
        {portal.heroPhoto && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={portal.heroPhoto} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover opacity-40" />
        )}
        <div className="absolute inset-0 bg-gradient-to-br from-ink-dark/95 via-ink/80 to-ink-light/60" aria-hidden />
        <div className="relative max-w-6xl mx-auto px-4 pt-14 pb-20 sm:pt-20 sm:pb-28">
          <p className="text-xs font-semibold uppercase tracking-widest text-gold-sand">{portal.tagline}</p>
          <h1 className="text-4xl sm:text-5xl font-extrabold mt-2 max-w-3xl leading-tight">{portal.displayName}</h1>
          <p className="text-white/85 mt-4 max-w-2xl text-base sm:text-lg">{portal.intro}</p>
          <span className="block w-16 h-1 rounded-full bg-gold-sand mt-6" />
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link href="/don" className="btn bg-gold-sand text-ink-dark hover:bg-gold-light px-6 py-3 text-base">
              <HeartHandshake className="w-5 h-5" aria-hidden /> Faire un don
            </Link>
            {openPlan && (
              <Link href="/places" className="btn bg-white text-ink hover:bg-cream px-6 py-3 text-base">
                <Armchair className="w-5 h-5" aria-hidden /> Réserver ma place
              </Link>
            )}
            <Link href="/horaires" className="btn border-2 border-white/70 text-white hover:bg-white/10 px-6 py-3 text-base">
              <Clock className="w-5 h-5" aria-hidden /> Horaires des offices
            </Link>
          </div>
        </div>
      </section>

      {campaign && <CampaignPopup campaign={campaign} photo={portal.heroPhoto} />}

      <div className="max-w-6xl mx-auto px-4 -mt-10 relative space-y-12">
        {/* Campagne mise en avant : reste visible une fois la fenêtre fermée. */}
        {campaign && (
          <Link href={`/don/${campaign.slug}`} className="card p-5 flex flex-col sm:flex-row sm:items-center gap-4 ring-2 ring-gold-sand/70 hover:ring-gold transition-shadow">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-widest text-gold">Campagne de dons en cours</p>
              <p className="text-xl font-bold text-ink mt-1">{campaign.title}</p>
              {campaignPct !== null && (
                <>
                  <div className="mt-3 h-2 rounded-full bg-cream overflow-hidden" role="img" aria-label={`${campaignPct} % de l'objectif atteint`}>
                    <div className="h-full rounded-full bg-gradient-to-r from-gold to-gold-sand" style={{ width: `${Math.max(campaignPct, 3)}%` }} />
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {formatEUR(campaign.raised)} sur {formatEUR(campaign.goal)} ({campaignPct} %)
                  </p>
                </>
              )}
            </div>
            <span className="btn-primary shrink-0">
              <HeartHandshake className="w-4 h-4" aria-hidden /> Je participe
            </span>
          </Link>
        )}
        {/* Cette semaine + prochaine fête */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card p-5 md:col-span-2">
            <div className="flex items-center gap-2 text-ink">
              <Flame className="w-5 h-5 text-gold" aria-hidden />
              <h2 className="font-bold text-lg">Chabbat {week?.parasha?.name ? `– ${week.parasha.name}` : ""}</h2>
              {week?.parasha?.hebrew && <span lang="he" dir="rtl" className="text-gray-500 text-sm ml-auto">{week.parasha.hebrew}</span>}
            </div>
            {week ? (
              <dl className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl bg-cream p-3">
                  <dt className="text-xs font-semibold uppercase text-gray-500">Allumage</dt>
                  <dd className="text-2xl font-bold text-ink">{week.candle?.time || "–"}</dd>
                  {week.candle && <dd className="text-xs text-gray-500 capitalize">{frDay(week.candle.date)}</dd>}
                </div>
                <div className="rounded-xl bg-cream p-3">
                  <dt className="text-xs font-semibold uppercase text-gray-500">Sortie</dt>
                  <dd className="text-2xl font-bold text-ink">{week.havdalah?.time || "–"}</dd>
                  {week.havdalah && <dd className="text-xs text-gray-500 capitalize">{frDay(week.havdalah.date)}</dd>}
                </div>
                <div className="rounded-xl bg-cream p-3">
                  <dt className="text-xs font-semibold uppercase text-gray-500">Aujourd'hui</dt>
                  <dd className="text-sm font-semibold text-ink mt-1">{week.hebrewDate}</dd>
                  <dd lang="he" dir="rtl" className="text-xs text-gray-500">{week.hebrewDateHe}</dd>
                </div>
              </dl>
            ) : (
              <p className="mt-3 text-sm text-gray-500">Horaires momentanément indisponibles.</p>
            )}
            <Link href="/horaires" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-gold hover:underline tap">
              Tous les horaires <ArrowRight className="w-4 h-4" aria-hidden />
            </Link>
          </div>

          <div className="card p-5">
            <div className="flex items-center gap-2 text-ink">
              <Sparkles className="w-5 h-5 text-gold" aria-hidden />
              <h2 className="font-bold text-lg">Prochaine fête</h2>
            </div>
            {nextHoliday ? (
              <div className="mt-4">
                <p className="text-2xl font-bold text-ink">{nextHoliday.name}</p>
                {nextHoliday.hebrew && <p lang="he" dir="rtl" className="text-gray-500">{nextHoliday.hebrew}</p>}
                <p className="text-sm text-gray-700 mt-2 first-letter:uppercase">{frRange(nextHoliday.start, nextHoliday.end)}</p>
                {nextHoliday.fromErev && <p className="text-xs text-gray-500 mt-1">Commence la veille au soir.</p>}
              </div>
            ) : (
              <p className="mt-3 text-sm text-gray-500">Aucune fête dans les prochains mois.</p>
            )}
            {holidays.length > 1 && (
              <ul className="mt-4 border-t border-gray-100 pt-3 space-y-1 text-sm">
                {holidays.slice(1, 4).map((h) => (
                  <li key={h.key} className="flex justify-between gap-2">
                    <span className="font-medium text-ink">{h.name}</span>
                    <span className="text-gray-500 text-right">{frDay(h.start).replace(/^\w+ /, "")}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Actions rapides */}
        <section aria-labelledby="titre-services-en-ligne">
          <h2 id="titre-services-en-ligne" className="text-2xl font-bold text-ink">En ligne</h2>
          <div className={`mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`}>
            {actions.map((a) => (
              <Link key={a.href} href={a.href} className="card p-5 group hover:ring-2 hover:ring-gold-sand/60 transition-shadow focus-visible:ring-2 focus-visible:ring-ink">
                <span className="inline-flex w-11 h-11 rounded-full bg-cream items-center justify-center text-ink group-hover:bg-ink group-hover:text-white transition-colors">
                  <a.icon className="w-5 h-5" aria-hidden />
                </span>
                <p className="mt-3 font-bold text-ink">{a.title}</p>
                <p className="text-sm text-gray-600 mt-1">{a.text}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* Événements */}
        {events.length > 0 && (
          <section aria-labelledby="titre-evenements">
            <h2 id="titre-evenements" className="text-2xl font-bold text-ink">Prochains événements</h2>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              {events.map((e) => (
                <Link key={e.slug} href={`/evenement/${e.slug}`} className="card p-5 hover:ring-2 hover:ring-gold-sand/60">
                  <p className="text-xs font-semibold uppercase text-gold flex items-center gap-1">
                    <CalendarDays className="w-4 h-4" aria-hidden /> {frDay(e.date)}
                    {e.date.length > 10 && ` · ${e.date.slice(11, 16).replace(":", "h")}`}
                  </p>
                  <p className="mt-2 font-bold text-ink">{e.title}</p>
                  <p className="text-sm text-gray-600 mt-1">{e.price > 0 ? formatEUR(e.price) + " par place" : "Entrée libre"}{e.location ? ` · ${e.location}` : ""}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Vie de la communauté */}
        <section aria-labelledby="titre-communaute">
          <div className="flex items-end justify-between gap-4">
            <h2 id="titre-communaute" className="text-2xl font-bold text-ink">La vie de la communauté</h2>
            <Link href="/communaute" className="text-sm font-semibold text-gold hover:underline tap shrink-0">Tout voir</Link>
          </div>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {portal.services.slice(0, 4).map((s) => (
              <div key={s.title} className="card p-5">
                <p className="font-bold text-ink">{s.title}</p>
                <p className="text-sm text-gray-600 mt-1">{s.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Galerie + contact */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Link href="/galerie" className="card overflow-hidden group relative min-h-[220px] flex items-end">
            {portal.photos[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={portal.photos[0].src} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 motion-reduce:transition-none" />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-ink via-ink-light to-gold-sand" aria-hidden />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-ink-dark/90 to-transparent" aria-hidden />
            <div className="relative p-5 text-white">
              <Images className="w-6 h-6" aria-hidden />
              <p className="text-xl font-bold mt-2">Notre synagogue en images</p>
              <p className="text-sm text-white/85">La salle de prière, les salons et les grands moments.</p>
            </div>
          </Link>
          <div className="card p-5 space-y-3">
            <h2 className="text-xl font-bold text-ink">Nous rendre visite</h2>
            <a href={mapUrl(portal)} target="_blank" rel="noreferrer" className="tap flex gap-2 text-gray-700 hover:text-ink">
              <MapPin className="w-5 h-5 text-gold shrink-0" aria-hidden /> {fullAddress(portal)}
            </a>
            {portal.phone && (
              <a href={telHref(portal.phone)} className="tap flex gap-2 text-gray-700 hover:text-ink">
                <Phone className="w-5 h-5 text-gold shrink-0" aria-hidden /> {portal.phone}
              </a>
            )}
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <a href={mapUrl(portal)} target="_blank" rel="noreferrer" className="btn-secondary">Itinéraire</a>
              <Link href="/a-propos" className="btn-secondary">Notre histoire</Link>
            </div>
          </div>
        </section>
      </div>
    </PortalShell>
  );
}
