// Libellés partagés client / serveur (pas d'import Admin SDK ici).

export const EXPENSE_CATEGORIES: Record<string, string> = {
  loyer: "Loyer et charges",
  energie: "Énergie et eau",
  entretien: "Entretien et travaux",
  cultuel: "Fournitures cultuelles",
  salaires: "Salaires et indemnités",
  evenements: "Événements et kiddouchim",
  assurances: "Assurances",
  banque: "Frais bancaires",
  autre: "Autre",
};

export const EXPENSE_METHODS: Record<string, string> = {
  virement: "Virement",
  prelevement: "Prélèvement",
  carte: "Carte bancaire",
  cheque: "Chèque",
  especes: "Espèces",
};
