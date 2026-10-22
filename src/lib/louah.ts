import { GeoLocation, HDate, HebrewCalendar, Location, Zmanim, getSedra } from "@hebcal/core";
import { adminDb } from "./firebaseAdmin";
import { hebrewLabel, upcomingHazkarot } from "./hazkarot";

// Écran d'affichage (louah) : date civile et hébraïque, paracha, zmanim,
// allumage des bougies, annonces et horaires saisis par l'équipe.

export interface LouahSettings {
  title: string;
  city: string;
  latitude: number;
  longitude: number;
  candleMinutes: number;
  announcements: string; // une annonce par ligne
  times: { label: string; value: string }[]; // horaires fixes des offices
  showZmanim: boolean;
  showHazkarot: boolean;
}

export const DEFAULT_LOUAH: LouahSettings = {
  title: "",
  city: "Bondy",
  latitude: 48.9022,
  longitude: 2.4828,
  candleMinutes: 18,
  announcements: "",
  times: [],
  showZmanim: true,
  showHazkarot: true,
};

const TZ = "Europe/Paris";

export async function getLouahSettings(): Promise<LouahSettings> {
  const snap = await adminDb().collection("settings").doc("louah").get();
  return { ...DEFAULT_LOUAH, ...((snap.data() || {}) as Partial<LouahSettings>) };
}

const hhmm = (d: Date | null | undefined) =>
  d && !isNaN(d.getTime()) ? d.toLocaleTimeString("fr-FR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }) : null;

function parisParts(now: Date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now).map((x) => [x.type, x.value])
  );
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day), iso: `${p.year}-${p.month}-${p.day}` };
}

export async function computeLouah(now = new Date()) {
  const s = await getLouahSettings();
  const { y, m, d, iso } = parisParts(now);
  const civil = new Date(y, m - 1, d);
  const gloc = new GeoLocation(s.city, s.latitude, s.longitude, 0, TZ);
  const z = new Zmanim(gloc, civil, false);
  const sunset = z.shkiah();

  // Le jour hébraïque commence au coucher du soleil.
  let hd = new HDate(civil);
  if (now > sunset) hd = hd.next();

  const loc = new Location(s.latitude, s.longitude, false, TZ, s.city, "FR");
  const events = HebrewCalendar.calendar({
    start: civil,
    end: new Date(y, m - 1, d + 8),
    location: loc,
    candlelighting: true,
    candleLightingMins: s.candleMinutes,
    sedrot: false,
  });
  // Les fêtes portent aussi les drapeaux d'allumage : on distingue par la
  // description des événements horodatés.
  const timed = (desc: string) => events.find((e) => e.getDesc() === desc && (e as any).eventTime > now) as any;
  const candle = timed("Candle lighting");
  const havdalah = timed("Havdalah");
  const holidays = events
    .filter((e) => !(e as any).eventTime)
    .map((e) => ({ date: hhIso(e.getDate().greg()), name: e.render("en"), hebrew: e.render("he") }))
    .slice(0, 6);

  const sedra = getSedra(hd.getFullYear(), false);
  const parasha = { name: sedra.getString(hd, "en").replace(/^Parashat /, ""), hebrew: sedra.getString(hd, "he") };

  const zmanim = s.showZmanim
    ? [
        ["Alot hachahar", z.alotHaShachar()],
        ["Lever du soleil", z.neitzHaChama()],
        ["Fin du Chéma", z.sofZmanShma()],
        ["Fin de la Tefila", z.sofZmanTfilla()],
        ["Hatsot", z.chatzot()],
        ["Minha guedola", z.minchaGedola()],
        ["Plag hamin'ha", z.plagHaMincha()],
        ["Coucher du soleil", sunset],
        ["Tset hakokhavim", z.tzeit()],
      ].map(([label, t]) => ({ label: label as string, time: hhmm(t as Date) }))
    : [];

  const servicesSnap = await adminDb().collection("services").where("date", ">=", iso).get();
  const limit = hhIso(new Date(y, m - 1, d + 7));
  const services = servicesSnap.docs
    .map((x) => x.data() as any)
    .filter((x) => x.date <= limit)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((x) => ({ date: x.date, label: x.label, notes: x.notes || "" }));

  const hazkarot = s.showHazkarot
    ? (await upcomingHazkarot(7)).filter((h) => h.next).map((h) => ({ name: h.deceasedName, date: h.next!.date, hebrew: h.next!.hebrew }))
    : [];

  return {
    title: s.title,
    city: s.city,
    civilDate: iso,
    hebrewDate: hebrewLabel(hd),
    hebrewDateHe: hd.renderGematriya(),
    parasha,
    candle: candle ? { date: hhIso(candle.eventTime), time: hhmm(candle.eventTime) } : null,
    havdalah: havdalah ? { date: hhIso(havdalah.eventTime), time: hhmm(havdalah.eventTime) } : null,
    holidays,
    zmanim,
    times: s.times,
    announcements: s.announcements.split("\n").map((l) => l.trim()).filter(Boolean),
    services,
    hazkarot,
  };
}

function hhIso(date: Date) {
  return parisParts(date).iso;
}
