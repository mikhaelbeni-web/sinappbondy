import { HebrewCalendar, flags } from "@hebcal/core";
import { adminDb } from "./firebaseAdmin";
import { computeLouah } from "./louah";
import { DEFAULT_PORTAL, type PortalSettings } from "./portal";

// Données du portail public : contenu saisi par l'équipe, horaires
// (mêmes réglages que l'écran louah), fêtes à venir calculées localement
// par @hebcal/core (dates exactes, régime diaspora), événements ouverts.

export async function getPortal(): Promise<PortalSettings> {
  let data: Partial<PortalSettings> = {};
  try {
    const snap = await adminDb().collection("settings").doc("portal").get();
    if (snap.exists) data = snap.data() as Partial<PortalSettings>;
  } catch (err) {
    // Base indisponible : le portail reste lisible avec les textes par défaut.
    console.error("[portal]", err);
  }
  const merged = { ...DEFAULT_PORTAL, ...data };
  // Liste vide enregistrée = retour aux textes par défaut.
  if (!merged.services?.length) merged.services = DEFAULT_PORTAL.services;
  if (!merged.history?.trim()) merged.history = DEFAULT_PORTAL.history;
  return merged;
}

// Noms français des fêtes affichées (les autres sont ignorées).
const HOLIDAY_FR: Record<string, string> = {
  "Leil Selichot": "Séli'hot",
  "Rosh Hashana": "Roch Hachana",
  "Tzom Gedaliah": "Jeûne de Guedalia",
  "Yom Kippur": "Yom Kippour",
  Sukkot: "Souccot",
  "Shmini Atzeret": "Chemini Atseret",
  "Simchat Torah": "Sim'hat Torah",
  Chanukah: "Hanouka",
  "Asara B'Tevet": "Jeûne du 10 Tévet",
  "Tu BiShvat": "Tou Bichvat",
  "Ta'anit Esther": "Jeûne d'Esther",
  Purim: "Pourim",
  Pesach: "Pessa'h",
  "Lag BaOmer": "Lag Baomer",
  Shavuot: "Chavouot",
  "Tzom Tammuz": "Jeûne du 17 Tamouz",
  "Tish'a B'Av": "Ticha Be'av",
};

export interface UpcomingHoliday {
  key: string;
  name: string;
  hebrew: string;
  start: string; // yyyy-mm-dd (veille comprise)
  end: string;
  fromErev: boolean; // commence la veille au soir
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function upcomingHolidays(days = 120, now = new Date()): UpcomingHoliday[] {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + days);
  const events = HebrewCalendar.calendar({ start, end, il: false, sedrot: false });
  const byKey = new Map<string, UpcomingHoliday>();
  for (const e of events) {
    if (e.getFlags() & (flags.ROSH_CHODESH | flags.SPECIAL_SHABBAT | flags.SHABBAT_MEVARCHIM | flags.MODERN_HOLIDAY)) continue;
    const key = typeof (e as any).basename === "function" ? (e as any).basename() : e.getDesc();
    const name = HOLIDAY_FR[key];
    if (!name) continue;
    const date = iso(e.getDate().greg());
    const isErev = /^Erev /.test(e.getDesc());
    const cur = byKey.get(key);
    if (!cur) {
      const hebrew = isErev ? "" : e.render("he").replace(/\s*[:(].*$/, "").replace(/\s+[א-ת]׳$/, "");
      byKey.set(key, { key, name, hebrew, start: date, end: date, fromErev: isErev });
    } else {
      cur.end = date;
      if (!cur.hebrew && !isErev) cur.hebrew = e.render("he").replace(/\s*[:(].*$/, "").replace(/\s+[א-ת]׳$/, "");
    }
  }
  return [...byKey.values()].sort((a, b) => (a.start < b.start ? -1 : 1));
}

// Horaires et Chabbat de la semaine, sans les hazkarot (données nominatives
// réservées à l'écran de la synagogue).
export async function weekInfo() {
  const l = await computeLouah();
  return {
    hebrewDate: l.hebrewDate,
    hebrewDateHe: l.hebrewDateHe,
    parasha: l.parasha,
    candle: l.candle,
    havdalah: l.havdalah,
    zmanim: l.zmanim,
    times: l.times.filter((t) => t.label?.trim()),
    announcements: l.announcements,
    services: l.services,
    city: l.city,
  };
}

export interface PublicEvent {
  slug: string;
  title: string;
  date: string;
  location: string;
  price: number;
}

export async function upcomingEvents(limit = 6): Promise<PublicEvent[]> {
  const snap = await adminDb().collection("events").where("active", "==", true).get();
  const today = iso(new Date());
  return snap.docs
    .map((d) => d.data() as any)
    .filter((e) => e.slug && String(e.date || "").slice(0, 10) >= today)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(0, limit)
    .map((e) => ({ slug: e.slug, title: e.title, date: e.date, location: e.location || "", price: Number(e.price) || 0 }));
}
