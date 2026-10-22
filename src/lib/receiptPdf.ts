import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { ASSOCIATION_CATEGORIES } from "./association";
import { euroAmountToWords } from "./numberToWords";
import type { ReceiptDoc } from "./types";

// Reçu au format du modèle Cerfa 11580 (toutes les mentions obligatoires),
// généré à la volée à partir du reçu enregistré.

const A4 = { w: 595.28, h: 841.89 };
const M = 42; // marge
const INK = rgb(0.1, 0.1, 0.18);
const GREY = rgb(0.4, 0.4, 0.45);

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

function eur(n: number): string {
  // toLocaleString utilise des espaces insécables fines (hors WinAnsi).
  return n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/[  ]/g, " ") + " €";
}

function frDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

const METHOD_GROUP: Record<string, "especes" | "cheque" | "virement_cb"> = {
  especes: "especes",
  cheque: "cheque",
  virement: "virement_cb",
  cb_en_ligne: "virement_cb",
  cb_terminal: "virement_cb",
};

class Writer {
  y = A4.h - M;
  constructor(
    public page: PDFPage,
    public font: PDFFont,
    public bold: PDFFont
  ) {}

  wrap(text: string, size: number, font: PDFFont, width: number): string[] {
    const lines: string[] = [];
    for (const para of clean(text).split("\n")) {
      let line = "";
      for (const word of para.split(/\s+/)) {
        const tryLine = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(tryLine, size) > width && line) {
          lines.push(line);
          line = word;
        } else line = tryLine;
      }
      lines.push(line);
    }
    return lines;
  }

  text(text: string, opts: { size?: number; bold?: boolean; x?: number; width?: number; color?: any; gap?: number } = {}) {
    const size = opts.size || 9.5;
    const font = opts.bold ? this.bold : this.font;
    const x = opts.x ?? M;
    const width = opts.width ?? A4.w - x - M;
    for (const line of this.wrap(text, size, font, width)) {
      this.page.drawText(line, { x, y: this.y - size, size, font, color: opts.color || INK });
      this.y -= size * 1.35;
    }
    this.y -= opts.gap ?? 2;
  }

  section(title: string) {
    this.y -= 6;
    this.page.drawRectangle({ x: M, y: this.y - 16, width: A4.w - 2 * M, height: 16, color: rgb(0.93, 0.91, 0.86) });
    this.page.drawText(clean(title), { x: M + 6, y: this.y - 12, size: 10, font: this.bold, color: INK });
    this.y -= 24;
  }

  check(label: string, checked: boolean, x = M) {
    const size = 9.5;
    this.page.drawRectangle({ x, y: this.y - 9.5, width: 8, height: 8, borderColor: INK, borderWidth: 0.8 });
    if (checked) this.page.drawText("X", { x: x + 1.4, y: this.y - 8.6, size: 7.5, font: this.bold, color: INK });
    const lines = this.wrap(label, size, this.font, A4.w - x - 14 - M);
    for (const line of lines) {
      this.page.drawText(line, { x: x + 14, y: this.y - size, size, font: this.font, color: INK });
      this.y -= size * 1.35;
    }
    this.y -= 2;
  }
}

export async function renderReceiptPdf(r: ReceiptDoc, signatureImage?: string): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Reçu fiscal ${r.number}`);
  pdf.setAuthor(clean(r.association.legalName));
  const page = pdf.addPage([A4.w, A4.h]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const w = new Writer(page, font, bold);
  let annex: string[] = [];

  // En-tête
  w.text("Reçu au titre des dons à certains organismes d'intérêt général", { size: 13, bold: true, gap: 0 });
  w.text("Article 200 du code général des impôts · selon le modèle Cerfa n° 11580*05", { size: 8.5, color: GREY });
  w.text(`Numéro d'ordre du reçu : ${r.number}`, { size: 10.5, bold: true, gap: 4 });
  if (r.cancelled) w.text("REÇU ANNULÉ", { size: 14, bold: true, color: rgb(0.75, 0.1, 0.1) });

  // Bénéficiaire
  const a = r.association;
  w.section("Bénéficiaire des versements");
  w.text(`Nom ou dénomination : ${a.legalName}`);
  w.text(`Adresse : ${a.address}, ${a.postalCode} ${a.city}`);
  const ids = [a.rna && `RNA ${a.rna}`, a.siren && `SIREN ${a.siren}`].filter(Boolean).join(" · ");
  if (ids) w.text(`Identification : ${ids}`);
  w.text(`Objet : ${a.object}`, { gap: 6 });
  w.text("Qualité de l'organisme :", { bold: true });
  const cat = ASSOCIATION_CATEGORIES.find((c) => c.key === a.category);
  w.check(cat ? cat.label : a.category, true);

  // Donateur
  w.section("Donateur");
  w.text(`Nom et prénom : ${r.donor.name}`);
  w.text(`Adresse : ${r.donor.address}, ${r.donor.postalCode} ${r.donor.city}`);

  // Montant
  w.section("Versement");
  w.text("Le bénéficiaire reconnaît avoir reçu au titre des dons et versements ouvrant droit à réduction d'impôt la somme de :");
  w.text(`*** ${eur(r.amount)} ***`, { size: 13, bold: true, gap: 2 });
  w.text(`Somme en toutes lettres : ${euroAmountToWords(r.amount)}`, { gap: 4 });
  if (r.kind === "unitaire" && r.payments.length === 1) {
    w.text(`Date du versement ou du don : ${frDate(r.payments[0].date)}`);
  } else {
    w.text(`Dons effectués du ${frDate(r.periodStart)} au ${frDate(r.periodEnd)} (reçu récapitulatif, ${r.payments.length} versement${r.payments.length > 1 ? "s" : ""}) :`);
    // Détail des versements : jusqu'à 4 colonnes sur la page, au-delà
    // de 64 versements le détail passe en annexe (page 2).
    const items = r.payments.map((p) => `${frDate(p.date)} : ${eur(p.amount)}`);
    if (items.length <= 64) {
      const cols = Math.min(4, Math.max(1, Math.ceil(items.length / 12)));
      const rows = Math.ceil(items.length / cols);
      const colW = (A4.w - 2 * M - 12) / cols;
      const startY = w.y;
      let lowest = startY;
      for (let c = 0; c < cols; c++) {
        w.y = startY;
        items.slice(c * rows, (c + 1) * rows).forEach((t) => w.text(t, { x: M + 12 + c * colW, size: 8.5, gap: 0 }));
        lowest = Math.min(lowest, w.y);
      }
      w.y = lowest;
    } else {
      w.text("Détail des versements en annexe.", { x: M + 12, size: 8.5 });
      annex = items;
    }
    w.y -= 4;
  }

  w.text(
    "Le bénéficiaire certifie sur l'honneur que les dons et versements qu'il reçoit ouvrent droit à la réduction d'impôt prévue à l'article 200 du CGI.",
    { bold: true, gap: 6 }
  );

  // Forme, nature, mode
  const colY = w.y;
  w.text("Forme du don :", { bold: true });
  w.check("Acte authentique", false);
  w.check("Acte sous seing privé", false);
  w.check("Déclaration de don manuel", true);
  w.check("Autres", false);
  const afterForm = w.y;

  w.y = colY;
  const x2 = M + 180;
  w.text("Nature du don :", { bold: true, x: x2 });
  w.check("Numéraire", true, x2);
  w.check("Titres de sociétés cotés", false, x2);
  w.check("Autres", false, x2);
  const afterNature = w.y;

  w.y = colY;
  const x3 = M + 340;
  const groups = new Set(r.payments.map((p) => METHOD_GROUP[p.method]));
  w.text("Mode de versement :", { bold: true, x: x3 });
  w.check("Remise d'espèces", groups.has("especes"), x3);
  w.check("Chèque", groups.has("cheque"), x3);
  w.check("Virement, prélèvement, carte bancaire", groups.has("virement_cb"), x3);
  w.y = Math.min(afterForm, afterNature, w.y) - 10;

  // Date et signature
  w.text(`Fait à ${a.city}, le ${frDate(r.issuedAt)}`);
  w.text(`${a.signatoryName}, ${a.signatoryTitle}`, { bold: true, gap: 4 });

  const sig = signatureImage?.match(/^data:image\/(png|jpe?g);base64,(.+)$/);
  if (sig) {
    try {
      const bytes = Buffer.from(sig[2], "base64");
      const img = sig[1] === "png" ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
      const scale = Math.min(160 / img.width, 60 / img.height, 1);
      page.drawImage(img, { x: M, y: w.y - img.height * scale, width: img.width * scale, height: img.height * scale });
      w.y -= img.height * scale + 6;
    } catch (e) {
      console.warn("[receiptPdf] signature illisible:", e);
    }
  }

  page.drawText(clean("Conservez ce reçu : il justifie la réduction d'impôt sur le revenu (66 % du montant, dans la limite de 20 % du revenu imposable)."), {
    x: M,
    y: M - 10,
    size: 7.5,
    font,
    color: GREY,
  });

  if (annex.length) {
    const p2 = pdf.addPage([A4.w, A4.h]);
    const w2 = new Writer(p2, font, bold);
    w2.text(`Annexe au reçu n° ${r.number} : détail des versements`, { size: 11, bold: true, gap: 6 });
    const cols = 4;
    const rows = Math.ceil(annex.length / cols);
    const colW = (A4.w - 2 * M) / cols;
    const startY = w2.y;
    for (let c = 0; c < cols; c++) {
      w2.y = startY;
      annex.slice(c * rows, (c + 1) * rows).forEach((t) => w2.text(t, { x: M + c * colW, size: 8, gap: 0 }));
    }
  }

  return Buffer.from(await pdf.save());
}
