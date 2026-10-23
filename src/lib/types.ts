import type { PermissionKey } from "./permissions";

export interface RoleDoc {
  id: string;
  name: string;
  isAdmin: boolean;
  permissions: PermissionKey[];
  createdAt: string;
}

export interface TeamMemberDoc {
  id: string; // = uid Firebase Auth
  email: string;
  name: string;
  roleId: string;
  active: boolean;
  createdAt: string;
}

export interface DonorDoc {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address?: string;
  postalCode?: string;
  city?: string;
  membershipTier?: string; // formule de cotisation habituelle (ex. « Famille »)
  groups?: string[]; // ex. « Conseil », « Jeunes » : ciblage des messages
  emailOptOut?: boolean; // désinscrit des messages groupés (pas des relances ni reçus)
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type CatalogCategory = "shabbat" | "fete" | "special";

export interface CatalogItemDoc {
  id: string;
  name: string;
  category: CatalogCategory;
  order: number;
  active: boolean;
  createdAt: string;
}

export type ServiceType = "shabbat" | "fete" | "autre";

export interface ServiceDoc {
  id: string;
  date: string; // ISO yyyy-mm-dd
  type: ServiceType;
  label: string; // ex: "Shabbat Bereshit", "Roch Hachana - 1er jour"
  notes: string;
  closed: boolean;
  createdBy: string;
  createdAt: string;
}

export type PledgeStatus = "en_attente" | "relance_envoyee" | "partiel" | "paye" | "annule";

export interface PledgeDoc {
  id: string;
  kind?: "office" | "cotisation" | "place"; // absent = promesse d'office
  membershipYear?: number; // cotisation : année couverte
  donorId: string;
  donorName: string;
  donorEmail: string;
  serviceId: string;
  serviceLabel: string;
  catalogItemId: string | null;
  catalogItemName: string; // texte libre possible si pas dans le catalogue
  amount: number; // en euros
  amountPaid?: number; // cumul des paiements affectés (absent sur les anciennes promesses)
  currency: "eur";
  status: PledgeStatus;
  notes: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  onlineCheckoutId: string | null;
  remindersSentCount: number;
  lastReminderAt: string | null;
  paidAt: string | null;
}

export type PaymentMethod = "cb_en_ligne" | "cb_terminal" | "cheque" | "especes" | "virement";

export interface PaymentAllocation {
  pledgeId: string;
  amount: number;
}

export interface PaymentDoc {
  id: string;
  donorId: string;
  donorName: string;
  amount: number; // en euros
  method: PaymentMethod;
  reference: string; // n° de chèque, référence de virement…
  date: string; // yyyy-mm-dd, date d'encaissement
  notes: string;
  allocations: PaymentAllocation[]; // promesses soldées par ce paiement
  unallocated: number; // reliquat non affecté (avoir), ou don libre
  campaignId?: string | null; // don fait depuis une page de campagne
  eventId?: string | null; // billet d'événement
  // Part sans droit à reçu fiscal (contrepartie : billet, place des fêtes).
  nonDeductible?: number;
  depositId?: string | null; // remise en banque (chèques, espèces)
  onlineCheckoutId: string | null;
  receiptId?: string | null; // reçu fiscal qui couvre ce paiement
  createdBy: string;
  createdByName: string;
  createdAt: string;
}

export interface ReceiptDoc {
  id: string;
  number: string; // numéro d'ordre, ex. 2026/00001
  year: number;
  kind: "unitaire" | "annuel";
  donorId: string;
  donor: { name: string; address: string; postalCode: string; city: string; email: string };
  amount: number;
  payments: { id: string; date: string; amount: number; method: PaymentMethod }[];
  periodStart: string; // yyyy-mm-dd (= date du don pour un reçu unitaire)
  periodEnd: string;
  // Copie de la fiche association au moment de l'émission (hors signature).
  association: {
    legalName: string;
    address: string;
    postalCode: string;
    city: string;
    object: string;
    rna: string;
    siren: string;
    category: string;
    signatoryName: string;
    signatoryTitle: string;
  };
  issuedAt: string;
  issuedBy: string;
  emailedAt: string | null;
  // Remis au fidèle hors e-mail (main propre, téléchargement espace fidèle).
  deliveredAt?: string | null;
  deliveredVia?: "main_propre" | "espace" | null;
  cancelled: boolean;
  cancelledAt: string | null;
  cancelledBy?: string | null;
  cancelReason?: string | null;
  // Chaînage annulation / remplacement.
  replacesId?: string | null;
  replacesNumber?: string | null;
  replacedById?: string | null;
  replacedByNumber?: string | null;
  updatedAt?: string | null;
  // Marqué « reçu de test » par l'Administrateur : seul un exercice dont
  // tous les reçus sont des tests peut être remis à zéro.
  test?: boolean;
  testMarkedAt?: string | null;
  testMarkedBy?: string | null;
}

// Journal des actions sur les reçus fiscaux (modification, suppression,
// annulation, remplacement, remise).
export interface ReceiptAuditDoc {
  id: string;
  at: string;
  by: string;
  byUid: string;
  action: "modification" | "suppression" | "annulation" | "remplacement" | "remise" | "marquage_test" | "remise_a_zero";
  receiptId: string;
  number: string;
  year: number;
  reason: string;
  before: Record<string, any> | null;
  after: Record<string, any> | null;
}

export interface SessionUser {
  uid: string;
  email: string;
  name: string;
  roleId: string;
  role: RoleDoc | null;
}

export interface CampaignDoc {
  id: string;
  slug: string; // adresse publique /don/<slug>
  title: string;
  description: string;
  goal: number; // objectif en euros (0 = sans objectif)
  suggestedAmounts: number[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}
