export function formatEUR(amount: number): string {
  return amount.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
}

export function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

export const STATUS_LABELS: Record<string, string> = {
  en_attente: "En attente",
  relance_envoyee: "Relance envoyée",
  partiel: "Partiel",
  paye: "Payé",
  annule: "Annulé",
};

export const STATUS_COLORS: Record<string, string> = {
  en_attente: "bg-amber-100 text-amber-800",
  relance_envoyee: "bg-blue-100 text-blue-800",
  partiel: "bg-purple-100 text-purple-800",
  paye: "bg-green-100 text-green-800",
  annule: "bg-gray-200 text-gray-600",
};

export const METHOD_LABELS: Record<string, string> = {
  cb_en_ligne: "CB en ligne",
  cb_terminal: "CB (terminal)",
  cheque: "Chèque",
  especes: "Espèces",
  virement: "Virement",
};

// Montant déjà réglé sur une promesse. Les promesses antérieures au suivi
// des paiements n'ont pas de amountPaid : "payé" vaut alors tout le montant.
export function paidOf(p: { amount: number; amountPaid?: number; status: string }): number {
  if (typeof p.amountPaid === "number") return p.amountPaid;
  return p.status === "paye" ? p.amount : 0;
}

export function remainingOf(p: { amount: number; amountPaid?: number; status: string }): number {
  if (p.status === "annule") return 0;
  return Math.max(0, round2(p.amount - paidOf(p)));
}

export function isOpen(p: { status: string }): boolean {
  return p.status !== "paye" && p.status !== "annule";
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
