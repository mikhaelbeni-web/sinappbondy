import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import { ASSOCIATION_CATEGORIES } from "./association";
import { euroAmountToWords } from "./numberToWords";
import type { ReceiptDoc } from "./types";

// Reçu fiscal Cerfa n° 11580*05 (2041-RD), mise en page calquée sur les
// reçus usuels : en-tête Cerfa, blocs Bénéficiaire / Donateur encadrés,
// cases 200 / 238 bis / 978, date et signature à droite.

const A4 = { w: 595.28, h: 841.89 };
const M = 44;
const CW = A4.w - 2 * M; // largeur utile
const INK = rgb(0.13, 0.13, 0.15);
const GREY = rgb(0.45, 0.45, 0.48);
const LINE = rgb(0.6, 0.6, 0.62);
const BAR = rgb(0.82, 0.82, 0.84);

// Les polices standard PDF ne codent que WinAnsi : on remplace le reste.
const WINANSI_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
function clean(s: string): string {
  return (s || "")
    .normalize("NFC")
    .split("")
    .map((c) => (c.charCodeAt(0) < 256 || WINANSI_EXTRA.includes(c) ? c : "?"))
    .join("")
    .replace(/[\u0000-\u0008\u000b-\u001f]/g, "");
}

function eurShort(n: number): string {
  const s = n.toLocaleString("fr-FR", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 });
  return s.replace(/[  ]/g, " ");
}

function frDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
function longDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d} ${MONTHS[Number(m) - 1]} ${y}`;
}

const METHOD_TEXT: Record<string, string> = {
  cb_en_ligne: "Paiement en ligne",
  cb_terminal: "Carte bancaire",
  cheque: "Chèque",
  especes: "Espèces",
  virement: "Virement",
};

async function embedDataUrl(pdf: PDFDocument, dataUrl?: string): Promise<PDFImage | null> {
  const m = dataUrl?.match(/^data:image\/(png|jpe?g);base64,(.+)$/);
  if (!m) return null;
  try {
    const bytes = Buffer.from(m[2], "base64");
    return m[1] === "png" ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
  } catch (e) {
    console.warn("[receiptPdf] image illisible:", e);
    return null;
  }
}

class Draw {
  constructor(
    public page: PDFPage,
    public font: PDFFont,
    public bold: PDFFont
  ) {}

  width(t: string, size: number, b = false) {
    return (b ? this.bold : this.font).widthOfTextAtSize(clean(t), size);
  }

  // Texte à la position (x, y = ligne de base).
  text(t: string, x: number, y: number, size: number, b = false, color = INK) {
    this.page.drawText(clean(t), { x, y, size, font: b ? this.bold : this.font, color });
  }

  centered(t: string, cx: number, y: number, size: number, b = false, color = INK) {
    this.text(t, cx - this.width(t, size, b) / 2, y, size, b, color);
  }

  right(t: string, rx: number, y: number, size: number, b = false, color = INK) {
    this.text(t, rx - this.width(t, size, b), y, size, b, color);
  }

  wrap(t: string, size: number, maxW: number, b = false): string[] {
    const lines: string[] = [];
    for (const para of clean(t).split("\n")) {
      let line = "";
      for (const word of para.split(/\s+/)) {
        const tryLine = line ? `${line} ${word}` : word;
        if (this.width(tryLine, size, b) > maxW && line) {
          lines.push(line);
          line = word;
        } else line = tryLine;
      }
      lines.push(line);
    }
    return lines;
  }

  hr(y: number, x1 = M, x2 = A4.w - M, color = LINE, thickness = 0.8) {
    this.page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness, color });
  }

  bar(title: string, top: number): number {
    const h = 20;
    this.page.drawRectangle({ x: M, y: top - h, width: CW, height: h, color: BAR });
    this.centered(title, A4.w / 2, top - 14, 10.5, true);
    return top - h;
  }

  box(top: number, bottom: number) {
    this.page.drawRectangle({ x: M, y: bottom, width: CW, height: top - bottom, borderColor: LINE, borderWidth: 1 });
  }

  // Case à cocher (coin haut-gauche à x, top) + libellé en gras.
  check(label: string, x: number, top: number, checked: boolean) {
    const s = 13;
    this.page.drawRectangle({ x, y: top - s, width: s, height: s, borderColor: INK, borderWidth: 1 });
    if (checked) {
      // Coche dessinée (✓ absent des polices standard).
      this.page.drawLine({ start: { x: x + 3, y: top - 7 }, end: { x: x + 5.5, y: top - 10.5 }, thickness: 1.4, color: INK });
      this.page.drawLine({ start: { x: x + 5.5, y: top - 10.5 }, end: { x: x + 10.5, y: top - 2.5 }, thickness: 1.4, color: INK });
    }
    this.text(label, x + s + 4, top - 10.5, 9, true);
  }
}

export async function renderReceiptPdf(r: ReceiptDoc, signatureImage?: string, logoImage?: string): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Reçu fiscal ${r.number}`);
  pdf.setAuthor(clean(r.association.legalName));
  const page = pdf.addPage([A4.w, A4.h]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italicBold = await pdf.embedFont(StandardFonts.HelveticaBoldOblique);
  const d = new Draw(page, font, bold);
  const a = r.association;

  // ---- En-tête : bloc Cerfa | titre | n° d'ordre
  let y = A4.h - 36;
  d.hr(y);
  const cerfaCx = M + 62;
  d.centered("2041-RD", cerfaCx, y - 18, 8.5, true);
  page.drawEllipse({ x: cerfaCx, y: y - 40, xScale: 38, yScale: 14, color: INK });
  const cerfaW = italicBold.widthOfTextAtSize("cerfa", 17);
  page.drawText("cerfa", { x: cerfaCx - cerfaW / 2, y: y - 45.5, size: 17, font: italicBold, color: rgb(1, 1, 1) });
  d.centered("N° 11580*05", cerfaCx, y - 67, 8.5, true);

  const title = "Reçu des dons et versements effectués par les particuliers au titre des articles 200 et 978 du code général des impôts";
  d.wrap(title, 10.5, 210, true).forEach((l, i) => d.centered(l, A4.w / 2, y - 22 - i * 13, 10.5, true));

  d.right("N° d'ordre du reçu", A4.w - M, y - 28, 9, true, GREY);
  d.right(r.number, A4.w - M, y - 44, 12, true);
  if (r.cancelled) d.right("REÇU ANNULÉ", A4.w - M, y - 62, 11, true, rgb(0.75, 0.1, 0.1));

  y -= 80;
  d.hr(y);

  // ---- Logo + nom de l'association | adresse du donateur (fenêtre)
  const logo = await embedDataUrl(pdf, logoImage);
  const leftCx = M + CW * 0.27;
  let logoBottom = y - 18;
  if (logo) {
    const scale = Math.min(70 / logo.width, 42 / logo.height, 1);
    const lw = logo.width * scale;
    const lh = logo.height * scale;
    page.drawImage(logo, { x: leftCx - lw / 2, y: y - 10 - lh, width: lw, height: lh });
    logoBottom = y - 10 - lh;
  }
  d.wrap(a.legalName.toUpperCase(), 10.5, CW * 0.5, true).forEach((l, i) => d.centered(l, leftCx, logoBottom - 16 - i * 13, 10.5, true));

  const dx = M + CW * 0.56;
  const donorLines = [r.donor.name.toUpperCase(), r.donor.address, `${r.donor.postalCode} ${r.donor.city.toUpperCase()}`];
  donorLines.forEach((l, i) => d.text(l, dx, y - 24 - i * 16, 10.5, true));

  y = Math.min(logoBottom - 16 - 13, y - 24 - 2 * 16) - 12;

  // ---- Bénéficiaire
  y = d.bar("BENEFICIAIRE DU DON", y) - 4;
  const boxTop = y;
  const labelX = M + 10;
  const valueX = M + 176;
  const valueW = A4.w - M - 10 - valueX;
  y -= 20;
  const row = (label: string, value: string, boldValue: boolean, size = 10.5) => {
    const lines = d.wrap(value, size, valueW, boldValue);
    d.text(label, labelX, y - (lines.length > 1 ? (lines.length - 1) * 6.5 : 0), 9, true);
    lines.forEach((l, i) => d.text(l, valueX, y - i * 13, size, boldValue));
    y -= 13 * lines.length + 3;
  };
  const cat = ASSOCIATION_CATEGORIES.find((c) => c.key === a.category);
  const ids = [a.siren && `SIREN ${a.siren}`, a.rna && `RNA ${a.rna}`].filter(Boolean).join(" · ");
  row("NOM OU DENOMINATION :", a.legalName.toUpperCase(), true);
  row("Numéro SIREN ou RNA :", ids, true);
  row("ADRESSE ASSOCIATION :", `${a.address.toUpperCase()}, ${a.postalCode} ${a.city.toUpperCase()}`, true);
  row("OBJET :", a.object, false, 9.5);
  row("QUALITE DE L'ORGANISME :", cat ? cat.label : a.category, false, 9.5);

  y -= 2;
  d.hr(y, M + 12, A4.w - M - 12);
  y -= 16;
  d.text("Le bénéficiaire reconnaît avoir reçu au titre des dons et versements ouvrant droit à réduction d'impôt, la somme de", labelX + 2, y, 9);
  y -= 14;

  const amountText = `***${eurShort(r.amount)} Euros*** ${euroAmountToWords(r.amount)}`;
  const amountLines = d.wrap(amountText, 12.5, CW - 80, true);
  const amW = Math.max(...amountLines.map((l) => d.width(l, 12.5, true))) + 24;
  const amH = amountLines.length * 16 + 12;
  page.drawRectangle({ x: A4.w / 2 - amW / 2, y: y - amH, width: amW, height: amH, borderColor: LINE, borderWidth: 1 });
  amountLines.forEach((l, i) => d.centered(l, A4.w / 2, y - 18 - i * 16, 12.5, true));
  y -= amH + 8;

  const period =
    r.payments.length === 1
      ? `Date du versement : ${frDate(r.payments[0].date)}`
      : `Dons effectués du ${frDate(r.periodStart)} au ${frDate(r.periodEnd)} (${r.payments.length} versements, détail en annexe)`;
  d.centered(period, A4.w / 2, y - 4, 8.5, false, GREY);
  y -= 14;
  d.box(boxTop, y);

  // ---- Donateur
  y = d.bar("DONATEUR", y - 10) - 4;
  const box2Top = y;
  y -= 20;
  row("NOM OU DENOMINATION :", r.donor.name.toUpperCase(), false);
  row("ADRESSE DONATEUR :", `${r.donor.address}, ${r.donor.postalCode} ${r.donor.city.toUpperCase()}`, false);
  y -= 4;
  d.box(box2Top, y);

  // ---- Certification et cases
  y -= 18;
  ["Le bénéficiaire certifie sur l'honneur que les dons et versements qu'il reçoit", "ouvrent droit à la réduction d'impôt prévue à l'article"].forEach((l, i) =>
    d.centered(l, A4.w / 2, y - i * 13, 10, true)
  );
  y -= 26;
  const c1 = M + 4;
  const c2 = M + CW * 0.32;
  const c3 = M + CW * 0.6;
  d.check("200 du CGI", c1, y, true);
  d.check("238 bis du CGI", c2, y, false);
  d.check("978 du CGI", c3, y, false);

  const underline = (t: string, x: number, yy: number) => {
    d.text(t, x, yy, 9, true);
    d.hr(yy - 2, x, x + d.width(t, 9, true), INK, 0.6);
  };
  y -= 32;
  underline("Forme du don", M, y);
  y -= 16;
  d.check("Acte authentique", c1, y, false);
  d.check("Acte sous seing privé", c2, y, false);
  d.check("Déclaration de don manuel", c3, y, true);
  d.check("Autres", c3 + 13 + 4 + d.width("Déclaration de don manuel", 9, true) + 14, y, false);

  y -= 32;
  underline("Nature du don", M, y);
  y -= 16;
  d.check("Numéraire", c1, y, true);
  d.check("Titres de sociétés cotées", c2, y, false);
  d.check("Autres", c3, y, false);

  y -= 22;
  d.hr(y);

  // ---- Mode de versement | Date et signature
  y -= 18;
  const modes = Array.from(new Set(r.payments.map((p) => METHOD_TEXT[p.method] || p.method))).join(", ");
  d.text("Mode de versement : ", M, y, 10.5);
  const modeX = M + d.width("Mode de versement : ", 10.5);
  d.wrap(modes, 10.5, CW * 0.55 - (modeX - M), true).forEach((l, i) => d.text(l, modeX, y - i * 13, 10.5, true));

  const sigCx = A4.w - M - 80;
  d.centered("Date et signature", sigCx, y, 9.5, true);
  d.centered(longDate(r.issuedAt), sigCx, y - 16, 10.5, true);
  const role = a.signatoryTitle ? (a.signatoryTitle.match(/^(le|la|l')\s/i) ? a.signatoryTitle : `Le ${a.signatoryTitle}`) : "";
  if (role) {
    d.centered(role, sigCx, y - 36, 9.5, true);
    const rw = d.width(role, 9.5, true);
    d.hr(y - 38, sigCx - rw / 2, sigCx + rw / 2, INK, 0.6);
  }
  let sy = y - 44;
  const sig = await embedDataUrl(pdf, signatureImage);
  if (sig) {
    const scale = Math.min(130 / sig.width, 55 / sig.height, 1);
    const sw = sig.width * scale;
    const sh = sig.height * scale;
    page.drawImage(sig, { x: sigCx - sw / 2, y: sy - sh, width: sw, height: sh });
    sy -= sh + 4;
  } else {
    sy -= 30;
  }
  d.centered(a.signatoryName, sigCx, sy - 10, 9.5, true);

  // ---- Annexe : détail des versements d'un reçu récapitulatif
  if (r.payments.length > 1) {
    const p2 = pdf.addPage([A4.w, A4.h]);
    const d2 = new Draw(p2, font, bold);
    let yy = A4.h - 50;
    d2.text(`Annexe au reçu n° ${r.number} : détail des versements`, M, yy, 12, true);
    yy -= 16;
    d2.text(`${r.donor.name} · du ${frDate(r.periodStart)} au ${frDate(r.periodEnd)}`, M, yy, 9.5, false, GREY);
    yy -= 22;
    const cols = r.payments.length > 50 ? 3 : r.payments.length > 25 ? 2 : 1;
    const perCol = Math.ceil(r.payments.length / cols);
    const colW = CW / cols;
    r.payments.forEach((p, i) => {
      const c = Math.floor(i / perCol);
      const rowY = yy - (i % perCol) * 13;
      const x = M + c * colW;
      d2.text(frDate(p.date), x, rowY, 9);
      d2.text(METHOD_TEXT[p.method] || p.method, x + 62, rowY, 9, false, GREY);
      d2.right(`${eurShort(p.amount)} €`, x + colW - 14, rowY, 9, true);
    });
    const lastY = yy - (perCol - 1) * 13 - 18;
    d2.hr(lastY + 8);
    d2.right(`Total : ${eurShort(r.amount)} €`, A4.w - M, lastY - 6, 10.5, true);
  }

  return Buffer.from(await pdf.save());
}
