import type { Metadata } from "next";
import PortalShell, { PortalHero } from "@/components/portal/PortalShell";
import SeatPicker from "@/components/seating/SeatPicker";
import { getPortal } from "@/lib/portalServer";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Réserver ma place" };

// Page publique : choisir ses places sur le plan de la synagogue, sans
// compte. Le nom et l'e-mail ne sont demandés qu'au moment de valider.
export default async function PlacesPage() {
  const portal = await getPortal();
  return (
    <PortalShell portal={portal}>
      <PortalHero photo={portal.heroPhoto} eyebrow="Fêtes" title="Réserver ma place" subtitle="Choisissez vos places sur le plan, puis validez avec votre e-mail." />
      <div className="max-w-4xl mx-auto px-4 -mt-8 space-y-5">
        <SeatPicker />
      </div>
    </PortalShell>
  );
}
