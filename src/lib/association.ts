// Fiche de l'association émettrice des reçus fiscaux, saisie par la
// synagogue dans Administration > Association. Les reçus Cerfa ne sont
// émis que lorsque tous les champs obligatoires sont remplis.

// Cases « qualité de l'organisme » du Cerfa 11580.
export const ASSOCIATION_CATEGORIES = [
  { key: "interet_general", label: "Œuvre ou organisme d'intérêt général" },
  { key: "cultuelle", label: "Association cultuelle ou de bienfaisance et établissement public des cultes reconnus d'Alsace-Moselle" },
  { key: "rup", label: "Association ou fondation reconnue d'utilité publique" },
] as const;

export type AssociationCategory = (typeof ASSOCIATION_CATEGORIES)[number]["key"];

export interface AssociationSettings {
  legalName: string;
  address: string;
  postalCode: string;
  city: string;
  object: string; // objet de l'association (statuts)
  rna: string; // W + 9 chiffres
  siren: string;
  category: AssociationCategory | "";
  signatoryName: string;
  signatoryTitle: string; // ex : Président
  signatureImage: string; // data URL PNG/JPEG (facultatif)
  logoImage: string; // logo affiché sur le reçu, data URL PNG/JPEG (facultatif)
  autoReceipt: boolean; // reçu envoyé automatiquement à chaque paiement
  updatedAt: string;
}

export const EMPTY_ASSOCIATION: AssociationSettings = {
  legalName: "",
  address: "",
  postalCode: "",
  city: "",
  object: "",
  rna: "",
  siren: "",
  category: "",
  signatoryName: "",
  signatoryTitle: "",
  signatureImage: "",
  logoImage: "",
  autoReceipt: true,
  updatedAt: "",
};

const REQUIRED: { key: keyof AssociationSettings; label: string }[] = [
  { key: "legalName", label: "Nom de l'association" },
  { key: "address", label: "Adresse du siège" },
  { key: "postalCode", label: "Code postal" },
  { key: "city", label: "Ville" },
  { key: "object", label: "Objet" },
  { key: "category", label: "Qualité de l'organisme" },
  { key: "signatoryName", label: "Nom du signataire" },
  { key: "signatoryTitle", label: "Qualité du signataire" },
];

// Liste des champs manquants : vide = reçus fiscaux activés.
export function missingAssociationFields(a: AssociationSettings): string[] {
  const missing = REQUIRED.filter((f) => !String(a[f.key] || "").trim()).map((f) => f.label);
  if (!a.rna.trim() && !a.siren.trim()) missing.push("N° RNA ou SIREN");
  return missing;
}
