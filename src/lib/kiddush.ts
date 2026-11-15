// Parrainage du kiddouch / de la séouda chlichit et demandes de réservation
// des salons. Fichier sans Admin SDK : importable côté client.
// Réglages (prix, textes) : menu Kiddouch & salons du back-office.

export interface KiddushOption {
  key: string; // ex : kiddouch, seouda
  label: string;
  price: number; // € (0 = sur devis, pas de règlement en ligne)
}

export interface KiddushSettings {
  enabled: boolean;
  intro: string;
  options: KiddushOption[];
  weeksAhead: number;
  salonsEnabled: boolean;
  salonsIntro: string;
  salonsCapacity: string;
  salonEventTypes: string[];
  notifyEmail: string; // reçoit les demandes de salon (vide = e-mail du portail)
  updatedAt: string;
}

// Prix provisoires : à confirmer par la synagogue dans Administration.
export const DEFAULT_KIDDUSH: KiddushSettings = {
  enabled: true,
  intro:
    "Le kiddouch du Chabbat matin est un moment de partage pour toute la communauté. Parrainez-le à l'occasion d'une naissance, d'une Bar Mitsva, d'un mariage, d'une hazkara ou simplement pour soutenir la synagogue.",
  options: [
    { key: "kiddouch", label: "Kiddouch du Chabbat matin", price: 180 },
    { key: "seouda", label: "Séouda chlichit", price: 100 },
  ],
  weeksAhead: 26,
  salonsEnabled: true,
  salonsIntro: "Les Salons Ha'Hyda accueillent vos cérémonies et réceptions. Envoyez votre demande : le secrétariat vous recontacte pour confirmer la date et établir le devis.",
  salonsCapacity: "150 à 200 personnes",
  salonEventTypes: ["Mariage", "Fiançailles", "Bar Mitsva", "Bat Mitsva", "Brit Mila", "Hazkara", "Petit-déjeuner", "Anniversaire", "Autre"],
  notifyEmail: "",
  updatedAt: "",
};

export const OCCASIONS = ["En l'honneur de", "À la mémoire de", "À l'occasion de", "Pour la réussite de", "Pour la guérison de"];

export interface KiddushSlot {
  date: string; // samedi, yyyy-mm-dd
  parasha: string;
  parashaHe: string;
  taken: string[]; // options déjà parrainées
}

export const SALON_STATUS_LABELS: Record<string, string> = {
  nouvelle: "Nouvelle",
  confirmee: "Confirmée",
  refusee: "Refusée",
};

export const sponsorId = (date: string, option: string) => `${date}_${option.replace(/[^a-z0-9]/gi, "")}`;
