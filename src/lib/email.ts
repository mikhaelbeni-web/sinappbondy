import { Resend } from "resend";

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

export async function sendReminderEmail(params: {
  to: string;
  donorName: string;
  amount: number;
  catalogItemName: string;
  serviceLabel: string;
  payUrl: string;
}) {
  const resend = getResend();
  const synagogueName = process.env.NEXT_PUBLIC_SYNAGOGUE_NAME || "la synagogue";

  const subject = `Rappel de votre don - ${synagogueName}`;
  const html = `
    <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; color: #1a1a2e;">
      <h2 style="color: #b8860b;">${synagogueName}</h2>
      <p>Chalom ${params.donorName},</p>
      <p>
        Lors de <strong>${params.serviceLabel}</strong>, vous avez fait une promesse de don
        pour <strong>${params.catalogItemName}</strong> d'un montant de
        <strong>${params.amount.toLocaleString("fr-FR")} €</strong>.
      </p>
      <p>Nous vous remercions de bien vouloir régulariser ce don en cliquant sur le lien ci-dessous :</p>
      <p style="text-align: center; margin: 32px 0;">
        <a href="${params.payUrl}"
           style="background:#b8860b;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;">
          Régler mon don de ${params.amount.toLocaleString("fr-FR")} €
        </a>
      </p>
      <p>Toda raba pour votre générosité.</p>
      <p style="color:#666;font-size:12px;">Si le bouton ne fonctionne pas, copiez ce lien : ${params.payUrl}</p>
    </div>
  `;

  if (!resend) {
    console.warn("[email] RESEND_API_KEY absent — e-mail non envoyé, contenu:", { to: params.to, subject });
    return { sent: false, reason: "RESEND_API_KEY manquant" };
  }

  const from = process.env.EMAIL_FROM || "onboarding@resend.dev";
  await resend.emails.send({ from, to: params.to, subject, html });
  return { sent: true };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

// Relevé de compte : liste des promesses restant dues + bouton « régler le solde ».
export async function sendStatementEmail(params: {
  to: string;
  donorName: string;
  lines: { label: string; date: string; remaining: number }[];
  total: number;
  payUrl: string;
}) {
  const resend = getResend();
  const synagogueName = process.env.NEXT_PUBLIC_SYNAGOGUE_NAME || "la synagogue";
  const eur = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

  const rows = params.lines
    .map(
      (l) => `<tr>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;">${escapeHtml(l.label)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;color:#666;">${escapeHtml(l.date)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee;text-align:right;">${eur(l.remaining)}</td>
      </tr>`
    )
    .join("");

  const subject = `Votre relevé de dons - ${synagogueName}`;
  const html = `
    <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; color: #1a1a2e;">
      <h2 style="color: #b8860b;">${escapeHtml(synagogueName)}</h2>
      <p>Chalom ${escapeHtml(params.donorName)},</p>
      <p>Voici le récapitulatif de vos promesses de dons restant à régler :</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">${rows}
        <tr><td colspan="2" style="padding:8px;font-weight:bold;">Total</td>
        <td style="padding:8px;text-align:right;font-weight:bold;">${eur(params.total)}</td></tr>
      </table>
      <p style="text-align: center; margin: 32px 0;">
        <a href="${params.payUrl}"
           style="background:#b8860b;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;">
          Régler mon solde de ${eur(params.total)}
        </a>
      </p>
      <p>Toda raba pour votre générosité.</p>
      <p style="font-size:13px;">Retrouvez à tout moment vos dons et reçus fiscaux dans votre
        <a href="${process.env.NEXT_PUBLIC_APP_URL || ""}/espace" style="color:#b8860b;">espace fidèle</a>.</p>
      <p style="color:#666;font-size:12px;">Si le bouton ne fonctionne pas, copiez ce lien : ${params.payUrl}</p>
    </div>
  `;

  if (!resend) {
    console.warn("[email] RESEND_API_KEY absent — relevé non envoyé:", { to: params.to, subject });
    return { sent: false, reason: "RESEND_API_KEY manquant" };
  }

  const from = process.env.EMAIL_FROM || "onboarding@resend.dev";
  await resend.emails.send({ from, to: params.to, subject, html });
  return { sent: true };
}

// Reçu fiscal en pièce jointe (PDF).
export async function sendReceiptEmail(params: {
  to: string;
  donorName: string;
  associationName: string;
  number: string;
  amount: number;
  kind: "unitaire" | "annuel";
  year: number;
  pdf: Buffer;
}) {
  const resend = getResend();
  const eur = params.amount.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
  const subject =
    params.kind === "annuel"
      ? `Votre reçu fiscal ${params.year} - ${params.associationName}`
      : `Votre reçu fiscal n° ${params.number} - ${params.associationName}`;
  const html = `
    <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; color: #1a1a2e;">
      <h2 style="color: #b8860b;">${escapeHtml(params.associationName)}</h2>
      <p>Chalom ${escapeHtml(params.donorName)},</p>
      <p>
        Vous trouverez ci-joint votre reçu fiscal n° <strong>${escapeHtml(params.number)}</strong>
        pour ${params.kind === "annuel" ? `vos dons de l'année ${params.year}` : "votre don"}, d'un montant de
        <strong>${eur}</strong>.
      </p>
      <p>Conservez-le : il vous permet de bénéficier de la réduction d'impôt sur le revenu.</p>
      <p>Toda raba pour votre générosité.</p>
    </div>
  `;

  if (!resend) {
    console.warn("[email] RESEND_API_KEY absent — reçu non envoyé:", { to: params.to, subject });
    return { sent: false, reason: "RESEND_API_KEY manquant" };
  }

  const from = process.env.EMAIL_FROM || "onboarding@resend.dev";
  await resend.emails.send({
    from,
    to: params.to,
    subject,
    html,
    attachments: [{ filename: `recu-fiscal-${params.number}.pdf`, content: params.pdf }],
  });
  return { sent: true };
}

// Lien de connexion à l'espace fidèle.
export async function sendDonorLoginEmail(params: { to: string; donorName: string; url: string }) {
  const resend = getResend();
  const synagogueName = process.env.NEXT_PUBLIC_SYNAGOGUE_NAME || "la synagogue";
  const subject = `Votre accès à l'espace fidèle - ${synagogueName}`;
  const html = `
    <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; color: #1a1a2e;">
      <h2 style="color: #b8860b;">${escapeHtml(synagogueName)}</h2>
      <p>Chalom ${escapeHtml(params.donorName)},</p>
      <p>Cliquez ci-dessous pour accéder à votre espace : vos promesses, vos paiements et vos reçus fiscaux.</p>
      <p style="text-align: center; margin: 32px 0;">
        <a href="${params.url}"
           style="background:#b8860b;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;">
          Accéder à mon espace
        </a>
      </p>
      <p style="color:#666;font-size:12px;">Ce lien est personnel et valable 30 jours. Si vous n'avez rien demandé, ignorez cet e-mail.</p>
    </div>
  `;
  if (!resend) {
    console.warn("[email] RESEND_API_KEY absent — lien de connexion non envoyé:", { to: params.to });
    return { sent: false, reason: "RESEND_API_KEY manquant" };
  }
  const from = process.env.EMAIL_FROM || "onboarding@resend.dev";
  await resend.emails.send({ from, to: params.to, subject, html });
  return { sent: true };
}
