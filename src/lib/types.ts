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

export type PledgeStatus = "en_attente" | "relance_envoyee" | "paye" | "annule";

export interface PledgeDoc {
  id: string;
  donorId: string;
  donorName: string;
  donorEmail: string;
  serviceId: string;
  serviceLabel: string;
  catalogItemId: string | null;
  catalogItemName: string; // texte libre possible si pas dans le catalogue
  amount: number; // en euros
  currency: "eur";
  status: PledgeStatus;
  notes: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  stripePaymentLinkUrl: string | null;
  stripePaymentLinkId: string | null;
  stripeCheckoutSessionId: string | null;
  remindersSentCount: number;
  lastReminderAt: string | null;
  paidAt: string | null;
}

export interface SessionUser {
  uid: string;
  email: string;
  name: string;
  roleId: string;
  role: RoleDoc | null;
}
