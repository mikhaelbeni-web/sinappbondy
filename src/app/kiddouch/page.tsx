import type { Metadata } from "next";
import PortalShell, { PortalHero } from "@/components/portal/PortalShell";
import KiddushPicker from "@/components/portal/KiddushPicker";
import { getPortal } from "@/lib/portalServer";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Parrainer un kiddouch" };

// Page publique : parrainer le kiddouch ou la séouda chlichit d'un Chabbat.
export default async function KiddouchPage() {
  const portal = await getPortal();
  return (
    <PortalShell portal={portal}>
      <PortalHero eyebrow="Chabbat" title="Parrainer un kiddouch" subtitle="Choisissez le Chabbat et la formule, puis validez avec votre e-mail." />
      <div className="max-w-4xl mx-auto px-4 -mt-8">
        <KiddushPicker />
      </div>
    </PortalShell>
  );
}
