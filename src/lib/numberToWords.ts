// Montant en toutes lettres (français), exigé sur le reçu fiscal.
// Règles : « vingt et un », « quatre-vingts » (pluriel seul), « cent »
// invariable s'il est suivi d'un nombre, « mille » invariable.

const UNITS = [
  "zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf",
  "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf",
];
const TENS = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante", "quatre-vingt", "quatre-vingt"];

function below100(n: number): string {
  if (n < 20) return UNITS[n];
  const t = Math.floor(n / 10);
  let u = n % 10;
  if (t === 7 || t === 9) u += 10; // soixante-dix, quatre-vingt-dix
  if (u === 0) return t === 8 ? "quatre-vingts" : TENS[t];
  if ((u === 1 || u === 11) && t !== 8 && t !== 9) return `${TENS[t]} et ${UNITS[u]}`;
  return `${TENS[t]}-${UNITS[u]}`;
}

function below1000(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  if (h === 0) return below100(r);
  const hundred = h === 1 ? "cent" : `${UNITS[h]} cent${r === 0 ? "s" : ""}`;
  return r === 0 ? hundred : `${hundred} ${below100(r)}`;
}

export function integerToWords(n: number): string {
  if (n === 0) return "zéro";
  const parts: string[] = [];
  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;
  if (millions) parts.push(`${below1000(millions)} million${millions > 1 ? "s" : ""}`);
  if (thousands) {
    // « quatre-vingt mille », « deux cent mille » : pas de « s » devant mille.
    const w = thousands === 1 ? "" : below1000(thousands).replace(/vingts$/, "vingt").replace(/cents$/, "cent");
    parts.push(w ? `${w} mille` : "mille");
  }
  if (rest) parts.push(below1000(rest));
  return parts.join(" ");
}

export function euroAmountToWords(amount: number): string {
  const cents = Math.round(amount * 100);
  const euros = Math.floor(cents / 100);
  const c = cents % 100;
  // « un million d'euros », mais « un million deux cents euros ».
  const unit = euros > 0 && euros % 1_000_000 === 0 ? "d'euros" : `euro${euros > 1 ? "s" : ""}`;
  let s = `${integerToWords(euros)} ${unit}`;
  if (c) s += ` et ${integerToWords(c)} centime${c > 1 ? "s" : ""}`;
  return s;
}
