import type { Metadata } from "next";
import PortalShell, { PortalHero } from "@/components/portal/PortalShell";
import { getPortal } from "@/lib/portalServer";
import { getAssociation } from "@/lib/associationServer";
import { EMPTY_ASSOCIATION } from "@/lib/association";
import { fullAddress } from "@/lib/portal";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mentions légales" };

// Mentions obligatoires (loi pour la confiance dans l'économie numérique,
// art. 6). L'éditeur est lu dans la fiche Association (Administration).
export default async function MentionsLegalesPage() {
  const [portal, a] = await Promise.all([getPortal(), getAssociation().catch(() => EMPTY_ASSOCIATION)]);
  const editor = a.legalName || portal.displayName;
  const seat = a.address ? [a.address, [a.postalCode, a.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") : fullAddress(portal);

  return (
    <PortalShell portal={portal}>
      <PortalHero photo={portal.heroPhoto} title="Mentions légales" />
      <div className="max-w-3xl mx-auto px-4 -mt-8">
        <div className="card p-6 space-y-6 text-sm text-gray-700 leading-relaxed">
          <section>
            <h2 className="font-bold text-ink text-base">Éditeur du site</h2>
            <p className="mt-2">
              {editor}, association régie par la loi du 1er juillet 1901.
              <br />
              Siège : {seat}
              {a.rna && (<><br />N° RNA : {a.rna}</>)}
              {a.siren && (<><br />SIREN : {a.siren}</>)}
              {portal.phone && (<><br />Téléphone : {portal.phone}</>)}
              {portal.email && (<><br />E-mail : {portal.email}</>)}
            </p>
            {a.signatoryName && (
              <p className="mt-2">
                Directeur de la publication : {a.signatoryName}
                {a.signatoryTitle ? `, ${a.signatoryTitle.toLowerCase()}` : ""}.
              </p>
            )}
          </section>
          <section>
            <h2 className="font-bold text-ink text-base">Hébergement</h2>
            <p className="mt-2">
              Vercel Inc., 440 N Barranca Avenue #4133, Covina, CA 91723, États-Unis (vercel.com).
              <br />
              Données : Google Firebase (Google Cloud), Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irlande.
            </p>
          </section>
          <section>
            <h2 className="font-bold text-ink text-base">Paiements</h2>
            <p className="mt-2">
              Les paiements en ligne sont traités par HelloAsso (helloasso.com), plateforme de paiement des associations. L'association ne reçoit ni ne conserve aucune donnée de carte bancaire.
            </p>
          </section>
          <section>
            <h2 className="font-bold text-ink text-base">Propriété intellectuelle</h2>
            <p className="mt-2">
              Les textes et photographies de ce site appartiennent à {editor} ou à leurs auteurs. Toute reproduction sans autorisation est interdite.
            </p>
          </section>
          <section>
            <h2 className="font-bold text-ink text-base">Données personnelles</h2>
            <p className="mt-2">
              Voir la <a href="/confidentialite" className="text-gold underline">politique de confidentialité</a>.
            </p>
          </section>
        </div>
      </div>
    </PortalShell>
  );
}
