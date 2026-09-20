// Récupère le calendrier juif (Shabbat + fêtes) via l'API publique Hebcal,
// pour Paris et en régime diaspora (2 jours de fête, comme en France).
// Documentation : https://www.hebcal.com/home/195/hebcal-rest-api

export interface HebcalService {
  date: string; // ISO yyyy-mm-dd
  type: "shabbat" | "fete";
  label: string;
}

interface HebcalItem {
  title: string;
  date: string; // ISO datetime
  category: string; // "parashat" | "holiday" | ...
  subcat?: string;
  yomtov?: boolean;
}

const PARIS_GEONAME_ID = 2988507;

export async function fetchHebrewCalendar(year: number): Promise<HebcalService[]> {
  const params = new URLSearchParams({
    v: "1",
    cfg: "json",
    year: String(year),
    month: "x", // toute l'année
    s: "on", // Chabbat / Parachat hashavoua (chaque semaine — à ne pas confondre avec "ss", qui ne renvoie que les Chabbatot spéciaux)
    maj: "on", // fêtes majeures (Roch Hachana, Kippour, Souccot, Pessah, Chavouot...)
    mf: "on", // jeûnes mineurs (Tsom Guedalia, Ta'anit Esther...)
    i: "off", // diaspora (2 jours de Yom Tov), pas le calendrier d'Israël
    geonameid: String(PARIS_GEONAME_ID),
  });

  const res = await fetch(`https://www.hebcal.com/hebcal?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Hebcal a répondu ${res.status}`);
  }
  const data = await res.json();
  const items: HebcalItem[] = data.items || [];

  const services: HebcalService[] = [];

  for (const item of items) {
    const date = item.date.slice(0, 10); // garde yyyy-mm-dd

    if (item.category === "parashat") {
      services.push({ date, type: "shabbat", label: `Chabbat - ${item.title}` });
      continue;
    }

    if (item.category === "holiday") {
      // On garde les fêtes majeures et les veilles (Erev), on écarte le
      // "bruit" (Rosh Chodesh, jours intermédiaires de Hol HaMoed sans
      // office particulier) sauf s'ils sont explicitement marqués yomtov.
      const isMajor = item.subcat === "major" || item.yomtov === true;
      const isErevOrFast = /^Erev /.test(item.title) || item.subcat === "fast";
      if (isMajor || isErevOrFast) {
        services.push({ date, type: "fete", label: item.title });
      }
    }
  }

  return services;
}
