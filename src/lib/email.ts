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
    attachments: [{ filename: `recu-fiscal-${params.number.replace("/", "-")}.pdf`, content: params.pdf }],
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

// Message groupé (annonce, newsletter) : envoi par lots de 100 via l'API
// batch de Resend, un e-mail personnalisé par destinataire.
export async function sendBulkMessages(
  messages: { to: string; subject: string; html: string }[]
): Promise<{ sent: number; failed: number; reason?: string }> {
  const resend = getResend();
  if (!resend) return { sent: 0, failed: messages.length, reason: "RESEND_API_KEY manquant" };
  const from = process.env.EMAIL_FROM || "onboarding@resend.dev";
  let sent = 0;
  let failed = 0;
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    const { error } = await resend.batch.send(chunk.map((m) => ({ from, ...m })));
    if (error) {
      console.error("[email] lot non envoyé:", error);
      failed += chunk.length;
    } else sent += chunk.length;
  }
  return { sent, failed };
}

export function messageHtml(params: { synagogueName: string; body: string; unsubscribeUrl: string }) {
  const paragraphs = escapeHtml(params.body)
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`)
    .join("");
  return `
    <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; color: #1a1a2e;">
      <h2 style="color: #b8860b;">${escapeHtml(params.synagogueName)}</h2>
      ${paragraphs}
      <p style="color:#999;font-size:11px;margin-top:32px;">
        Vous recevez ce message car vous êtes inscrit auprès de ${escapeHtml(params.synagogueName)}.
        <a href="${params.unsubscribeUrl}" style="color:#999;">Ne plus recevoir ces messages</a>.
      </p>
    </div>
  `;
}

// Rappel de hazkara à la famille.
export async function sendHazkaraEmail(params: {
  to: string;
  donorName: string;
  deceasedName: string;
  relation: string;
  date: string; // yyyy-mm-dd
  hebrew: string;
}) {
  const resend = getResend();
  const synagogueName = process.env.NEXT_PUBLIC_SYNAGOGUE_NAME || "la synagogue";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const d = new Date(`${params.date}T12:00:00`);
  const dateFr = d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const veille = new Date(d.getTime() - 86400_000).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const subject = `Hazkara de ${params.deceasedName} le ${dateFr}`;
  const html = `
    <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; color: #1a1a2e;">
      <h2 style="color: #b8860b;">${escapeHtml(synagogueName)}</h2>
      <p>Chalom ${escapeHtml(params.donorName)},</p>
      <p>
        La hazkara de <strong>${escapeHtml(params.deceasedName)}</strong>${params.relation ? ` (${escapeHtml(params.relation)})` : ""}
        tombe le <strong>${dateFr}</strong> (${escapeHtml(params.hebrew)}). Elle commence la veille au soir, ${veille}.
      </p>
      <p>N'hésitez pas à contacter la synagogue pour organiser le Kaddich, une montée à la Torah ou un limoud.</p>
      <p style="text-align:center;margin:28px 0;">
        <a href="${appUrl}/don" style="background:#b8860b;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;">
          Faire un don à sa mémoire
        </a>
      </p>
      <p>Que son âme repose en paix.</p>
    </div>
  `;
  if (!resend) {
    console.warn("[email] RESEND_API_KEY absent — rappel de hazkara non envoyé:", { to: params.to, subject });
    return { sent: false, reason: "RESEND_API_KEY manquant" };
  }
  const from = process.env.EMAIL_FROM || "onboarding@resend.dev";
  await resend.emails.send({ from, to: params.to, subject, html });
  return { sent: true };
}

// Confirmation des places attribuées pour les fêtes.
export async function sendSeatConfirmationEmail(params: {
  to: string;
  donorName: string;
  planName: string;
  seats: string[];
  due: number;
  payUrl: string | null;
}) {
  const resend = getResend();
  const synagogueName = process.env.NEXT_PUBLIC_SYNAGOGUE_NAME || "la synagogue";
  const eur = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
  const subject = `Vos places - ${params.planName}`;
  const list = params.seats.map((s) => `<li>${escapeHtml(s)}</li>`).join("");
  const html = `
    <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; color: #1a1a2e;">
      <h2 style="color: #b8860b;">${escapeHtml(synagogueName)}</h2>
      <p>Chalom ${escapeHtml(params.donorName)},</p>
      <p>Voici vos places pour <strong>${escapeHtml(params.planName)}</strong> :</p>
      <ul>${list}</ul>
      ${
        params.due > 0 && params.payUrl
          ? `<p>Reste à régler : <strong>${eur(params.due)}</strong>.</p>
             <p style="text-align:center;margin:28px 0;"><a href="${params.payUrl}" style="background:#b8860b;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;">Régler en ligne</a></p>`
          : ""
      }
      <p>Chana tova !</p>
    </div>
  `;
  if (!resend) {
    console.warn("[email] RESEND_API_KEY absent — confirmation de places non envoyée:", { to: params.to });
    return { sent: false, reason: "RESEND_API_KEY manquant" };
  }
  const from = process.env.EMAIL_FROM || "onboarding@resend.dev";
  await resend.emails.send({ from, to: params.to, subject, html });
  return { sent: true };
}

// Billet d'événement : QR code en pièce jointe et lien vers le billet.
export async function sendTicketEmail(params: {
  to: string;
  name: string;
  event: { title: string; date: string; location: string };
  qty: number;
  code: string;
  url: string;
  qrPng: Buffer;
}) {
  const resend = getResend();
  const synagogueName = process.env.NEXT_PUBLIC_SYNAGOGUE_NAME || "la synagogue";
  const when = new Date(`${params.event.date}:00`).toLocaleString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  const subject = `Votre billet - ${params.event.title}`;
  const html = `
    <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; color: #1a1a2e;">
      <h2 style="color: #b8860b;">${escapeHtml(synagogueName)}</h2>
      <p>Chalom ${escapeHtml(params.name)},</p>
      <p>Votre inscription à <strong>${escapeHtml(params.event.title)}</strong> est confirmée
        (${params.qty} place${params.qty > 1 ? "s" : ""}).</p>
      <p>${escapeHtml(when)}${params.event.location ? `<br/>${escapeHtml(params.event.location)}` : ""}</p>
      <p>Présentez le QR code joint (ou ce lien) à l'entrée : <a href="${params.url}">${params.url}</a></p>
      <p style="font-size:20px;letter-spacing:3px;font-weight:bold;text-align:center;">${escapeHtml(params.code)}</p>
    </div>
  `;
  if (!resend) {
    console.warn("[email] RESEND_API_KEY absent — billet non envoyé:", { to: params.to, subject });
    return { sent: false, reason: "RESEND_API_KEY manquant" };
  }
  const from = process.env.EMAIL_FROM || "onboarding@resend.dev";
  await resend.emails.send({
    from,
    to: params.to,
    subject,
    html,
    attachments: [{ filename: `billet-${params.code}.png`, content: params.qrPng }],
  });
  return { sent: true };
}
