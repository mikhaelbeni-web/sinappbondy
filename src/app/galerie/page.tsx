import type { Metadata } from "next";
import PortalShell, { PortalHero } from "@/components/portal/PortalShell";
import Gallery from "@/components/portal/Gallery";
import { getPortal } from "@/lib/portalServer";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Galerie photos" };

export default async function GaleriePage() {
  const portal = await getPortal();
  return (
    <PortalShell portal={portal}>
      <PortalHero eyebrow="Notre patrimoine" title="Galerie photos" subtitle="La synagogue, les salons et les grands moments de la communauté." />
      <div className="max-w-6xl mx-auto px-4 -mt-8">
        <div className="card p-4 sm:p-6">
          <Gallery photos={portal.photos} />
        </div>
      </div>
    </PortalShell>
  );
}
