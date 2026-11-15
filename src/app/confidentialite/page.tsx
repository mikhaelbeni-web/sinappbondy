import type { Metadata } from "next";
import PortalShell, { PortalHero } from "@/components/portal/PortalShell";
import { getPortal } from "@/lib/portalServer";
import { getAssociation } from "@/lib/associationServer";
import { EMPTY_ASSOCIATION } from "@/lib/association";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Politique de confidentialité" };

// Politique de confidentialité (RGPD, art. 13). À faire relire par
// l'association : elle décrit les traitements réellement faits par l'app.
export default async function ConfidentialitePage() {
  const [portal, a] = await Promise.all([getPortal(), getAssociation().catch(() => EMPTY_ASSOCIATION)]);
  const controller = a.legalName || portal.displayName;
  const contact = portal.email;

  const rows: [string, string, string, string][] = [
    ["Dons et promesses", "Nom, prénom, e-mail, téléphone, adresse, montants et règlements", "Exécution de votre don ; obligation légale pour les reçus fiscaux", "10 ans (pièces comptables)"],
    ["Reçus fiscaux", "Identité, adresse, montant, date et mode de versement", "Obligation légale (code général des impôts)", "10 ans"],
    ["Espace fidèle", "E-mail, lien de connexion, cookie de session", "Exécution du service demandé", "Lien et session : 30 jours"],
    ["Inscriptions aux événements, mikvé", "Nom, téléphone, e-mail, créneau choisi", "Exécution du service demandé", "1 an après la date"],
    ["Hazkarot", "Nom du défunt, date de décès, coordonnées de la famille", "Consentement de la famille", "Jusqu'à demande de suppression"],
    ["Messages de la synagogue", "E-mail, téléphone", "Intérêt légitime (vie de la communauté) ; désinscription à tout moment", "Jusqu'à désinscription"],
  ];

  return (
    <PortalShell portal={portal}>
      <PortalHero title="Politique de confidentialité" />
      <div className="max-w-4xl mx-auto px-4 -mt-8">
        <div className="card p-6 space-y-6 text-sm text-gray-700 leading-relaxed">
          <section>
            <h2 className="font-bold text-ink text-base">Responsable du traitement</h2>
            <p className="mt-2">
              {controller}. Pour toute question ou pour exercer vos droits : {contact ? <a href={`mailto:${contact}`} className="text-gold underline">{contact}</a> : "le secrétariat de la synagogue"}.
            </p>
          </section>
          <section>
            <h2 className="font-bold text-ink text-base">Données collectées et finalités</h2>
            <div className="mt-3 overflow-x-auto -mx-2 px-2">
              <table className="w-full text-left min-w-[560px]">
                <caption className="sr-only">Traitements de données personnelles</caption>
                <thead className="text-xs uppercase text-gray-500">
                  <tr>
                    <th scope="col" className="py-2 pr-3">Traitement</th>
                    <th scope="col" className="py-2 pr-3">Données</th>
                    <th scope="col" className="py-2 pr-3">Base légale</th>
                    <th scope="col" className="py-2">Durée</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r[0]} className="border-t border-gray-100 align-top">
                      <th scope="row" className="py-2 pr-3 font-semibold text-ink">{r[0]}</th>
                      <td className="py-2 pr-3">{r[1]}</td>
                      <td className="py-2 pr-3">{r[2]}</td>
                      <td className="py-2">{r[3]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3">
              L'appartenance à une communauté religieuse est une donnée sensible. L'association la traite uniquement pour ses membres et
              les personnes en contact régulier avec elle, et ne la communique jamais à des tiers sans votre consentement (RGPD, art. 9.2.d).
            </p>
          </section>
          <section>
            <h2 className="font-bold text-ink text-base">Destinataires</h2>
            <p className="mt-2">
              Les membres habilités de l'équipe de la synagogue, et les prestataires techniques : HelloAsso (paiements), Google Firebase
              (base de données), Vercel (hébergement), et le service d'envoi d'e-mails. Aucune donnée n'est vendue ni utilisée à des fins publicitaires.
              Certains prestataires peuvent traiter des données hors de l'Union européenne, dans le cadre des clauses contractuelles types de la Commission européenne.
            </p>
          </section>
          <section>
            <h2 className="font-bold text-ink text-base">Cookies</h2>
            <p className="mt-2">
              Le site n'utilise que des cookies nécessaires à son fonctionnement (session de l'espace fidèle et de l'équipe). Aucun cookie de mesure d'audience ni de publicité.
            </p>
          </section>
          <section>
            <h2 className="font-bold text-ink text-base">Vos droits</h2>
            <p className="mt-2">
              Vous pouvez demander l'accès, la rectification, l'effacement ou la limitation de vos données, vous opposer à leur traitement et
              demander leur portabilité. Les reçus fiscaux émis ne peuvent pas être effacés avant la fin de leur durée légale de conservation.
              Si vous estimez que vos droits ne sont pas respectés, vous pouvez saisir la CNIL (cnil.fr).
            </p>
          </section>
        </div>
      </div>
    </PortalShell>
  );
}
