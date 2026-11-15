import type { Metadata } from "next";
import PortalShell, { PortalHero } from "@/components/portal/PortalShell";
import SalonRequestForm from "@/components/portal/SalonRequestForm";
import { getPortal } from "@/lib/portalServer";
import { getKiddushSettings } from "@/lib/kiddushServer";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Réserver les salons" };

// Page publique : demande de réservation de la salle de réception.
export default async function SalonsPage() {
  const [portal, settings] = await Promise.all([getPortal(), getKiddushSettings()]);
  const photos = portal.photos.filter((p) => p.category === "salons").slice(0, 3);
  return (
    <PortalShell portal={portal}>
      <PortalHero eyebrow="Salle de réception" title="Les Salons Ha'Hyda" subtitle={settings.salonsCapacity ? `Cérémonies et réceptions, ${settings.salonsCapacity}.` : "Cérémonies et réceptions."} />
      <div className="max-w-4xl mx-auto px-4 -mt-8 space-y-5">
        <SalonRequestForm />
        {photos.length > 0 && (
          <ul className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {photos.map((p) => (
              <li key={p.src}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.src} alt={p.alt} width={p.width} height={p.height} loading="lazy" className="w-full h-48 object-cover rounded-2xl shadow-soft bg-gray-100" />
              </li>
            ))}
          </ul>
        )}
      </div>
    </PortalShell>
  );
}
