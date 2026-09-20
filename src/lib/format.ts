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
  paye: "Payé",
  annule: "Annulé",
};

export const STATUS_COLORS: Record<string, string> = {
  en_attente: "bg-amber-100 text-amber-800",
  relance_envoyee: "bg-blue-100 text-blue-800",
  paye: "bg-green-100 text-green-800",
  annule: "bg-gray-200 text-gray-600",
};
