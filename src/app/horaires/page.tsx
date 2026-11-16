import type { Metadata } from "next";
import { Clock, Flame, Sun, CalendarDays, Megaphone } from "lucide-react";
import PortalShell, { PortalHero } from "@/components/portal/PortalShell";
import { getPortal, upcomingHolidays, weekInfo } from "@/lib/portalServer";
import { frDay, frRange } from "@/lib/portal";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Horaires des offices" };

// Horaires publics : offices fixes (saisis dans Administration > Écran louah),
// offices datés de la semaine, Chabbat, zmanim et fêtes à venir.
export default async function HorairesPage() {
  const [portal, week] = await Promise.all([getPortal(), weekInfo().catch(() => null)]);
  const holidays = upcomingHolidays(330).slice(0, 8);

  return (
    <PortalShell portal={portal}>
      <PortalHero photo={portal.heroPhoto} eyebrow="Prières" title="Horaires des offices" subtitle={week ? `${week.hebrewDate} · Chabbat ${week.parasha.name}` : undefined} />
      <div className="max-w-6xl mx-auto px-4 -mt-8 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="space-y-4 lg:col-span-2">
          {week && week.announcements.length > 0 && (
            <section className="card p-5 border-l-4 border-gold-sand" aria-labelledby="titre-annonces">
              <h2 id="titre-annonces" className="font-bold text-ink flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-gold" aria-hidden /> Annonces
              </h2>
              <ul className="mt-2 space-y-1 text-sm text-gray-700 list-disc pl-5">
                {week.announcements.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </section>
          )}

          <section className="card p-5" aria-labelledby="titre-offices">
            <h2 id="titre-offices" className="font-bold text-ink text-lg flex items-center gap-2">
              <Clock className="w-5 h-5 text-gold" aria-hidden /> Offices de l'année
            </h2>
            {week && week.times.length > 0 ? (
              <table className="mt-3 w-full text-sm">
                <caption className="sr-only">Horaires habituels des offices</caption>
                <tbody>
                  {week.times.map((t, i) => (
                    <tr key={i} className="border-b border-gray-100 last:border-0">
                      <th scope="row" className="py-2.5 pr-3 text-left font-medium text-gray-700">{t.label}</th>
                      <td className="py-2.5 text-right font-bold text-ink whitespace-nowrap">{t.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="mt-3 text-sm text-gray-600">Les horaires seront bientôt publiés. Renseignez-vous au {portal.phone}.</p>
            )}
          </section>

          {week && week.services.length > 0 && (
            <section className="card p-5" aria-labelledby="titre-semaine">
              <h2 id="titre-semaine" className="font-bold text-ink text-lg flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-gold" aria-hidden /> Cette semaine
              </h2>
              <ul className="mt-3 divide-y divide-gray-100 text-sm">
                {week.services.map((s, i) => (
                  <li key={i} className="py-2.5 flex flex-col sm:flex-row sm:justify-between gap-1">
                    <span className="font-medium text-ink">{s.label}</span>
                    <span className="text-gray-600 capitalize">{frDay(s.date)}{s.notes ? ` · ${s.notes}` : ""}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="card p-5" aria-labelledby="titre-fetes">
            <h2 id="titre-fetes" className="font-bold text-ink text-lg">Fêtes et jeûnes à venir</h2>
            <ul className="mt-3 divide-y divide-gray-100 text-sm">
              {holidays.map((h) => (
                <li key={h.key + h.start} className="py-2.5 flex flex-col sm:flex-row sm:justify-between gap-1">
                  <span className="font-semibold text-ink">
                    {h.name} {h.hebrew && <span lang="he" dir="rtl" className="font-normal text-gray-500 ml-1">{h.hebrew}</span>}
                  </span>
                  <span className="text-gray-600 first-letter:uppercase">
                    {frRange(h.start, h.end)}
                    {h.fromErev ? " (veille au soir)" : ""}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-gray-500">Dates calculées pour la diaspora (deux jours de fête).</p>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="card p-5" aria-labelledby="titre-chabbat">
            <h2 id="titre-chabbat" className="font-bold text-ink text-lg flex items-center gap-2">
              <Flame className="w-5 h-5 text-gold" aria-hidden /> Chabbat
            </h2>
            {week ? (
              <dl className="mt-3 space-y-3">
                <div>
                  <dt className="text-xs font-semibold uppercase text-gray-500">Paracha</dt>
                  <dd className="font-bold text-ink">
                    {week.parasha.name} <span lang="he" dir="rtl" className="font-normal text-gray-500">{week.parasha.hebrew}</span>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-gray-500">Allumage des bougies</dt>
                  <dd className="font-bold text-ink text-xl">
                    {week.candle?.time || "–"} {week.candle && <span className="text-sm font-normal text-gray-600 capitalize">{frDay(week.candle.date)}</span>}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase text-gray-500">Sortie</dt>
                  <dd className="font-bold text-ink text-xl">
                    {week.havdalah?.time || "–"} {week.havdalah && <span className="text-sm font-normal text-gray-600 capitalize">{frDay(week.havdalah.date)}</span>}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="mt-3 text-sm text-gray-500">Momentanément indisponible.</p>
            )}
          </section>

          {week && week.zmanim.length > 0 && (
            <section className="card p-5" aria-labelledby="titre-zmanim">
              <h2 id="titre-zmanim" className="font-bold text-ink text-lg flex items-center gap-2">
                <Sun className="w-5 h-5 text-gold" aria-hidden /> Heures du jour
              </h2>
              <p className="text-xs text-gray-500 mt-1">À {week.city}, aujourd'hui.</p>
              <table className="mt-2 w-full text-sm">
                <caption className="sr-only">Zmanim du jour</caption>
                <tbody>
                  {week.zmanim.map((z) => (
                    <tr key={z.label} className="border-b border-gray-100 last:border-0">
                      <th scope="row" className="py-1.5 text-left font-normal text-gray-700">{z.label}</th>
                      <td className="py-1.5 text-right font-semibold text-ink">{z.time || "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </aside>
      </div>
    </PortalShell>
  );
}
