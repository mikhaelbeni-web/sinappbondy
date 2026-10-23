import { Resend } from "resend";
import nodemailer from "nodemailer";

type Delivery = { sent: true } | { sent: false; reason: string };
type Mail = {
  from: string;
  to: string;
  subject: string;
  html: string;
  attachments?: { filename: string; content: Buffer }[];
};
type Mailer = {
  from: string;
  send: (mail: Mail) => Promise<Delivery>;
  // Envoi groupé natif (Resend) ; à défaut, un envoi par message.
  batch?: (mails: Mail[]) => Promise<boolean>;
};

const NO_MAILER = "envoi d'e-mails non configuré (GMAIL_USER ou RESEND_API_KEY)";

// Transport SMTP réutilisé d'un envoi à l'autre (relances groupées).
let gmailTransport: nodemailer.Transporter | null = null;

// Deux services possibles : Gmail (SMTP, sans nom de domaine, environ
// 500 e-mails par jour) s'il est configuré, sinon Resend.
function getMailer(): Mailer | null {
  const gmailUser = process.env.GMAIL_USER;
  const gmailPassword = process.env.GMAIL_APP_PASSWORD;
  if (gmailUser && gmailPassword) {
    // Pas de pool : sur Vercel la fonction s'arrête après la réponse, une
    // connexion gardée ouverte peut rester bloquée. Délais courts pour que
    // l'erreur remonte avant la limite de durée de la fonction.
    gmailTransport ??= nodemailer.createTransport({
      service: "gmail",
      auth: { user: gmailUser, pass: gmailPassword.replace(/\s+/g, "") },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });
    const transport = gmailTransport;
    const name = process.env.NEXT_PUBLIC_SYNAGOGUE_NAME || "Synagogue";
    return {
      // Gmail impose l'adresse du compte comme expéditeur.
      from: `"${name.replace(/"/g, "")}" <${gmailUser}>`,
      async send(mail) {
        try {
          await transport.sendMail(mail);
          return { sent: true };
        } catch (e: any) {
          console.error("[email] envoi refusé par Gmail:", { to: mail.to, error: e?.message });
          return { sent: false, reason: e?.message || "refus de Gmail" };
        }
      },
    };
  }

  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  const resend = new Resend(key);
  return {
    from: process.env.EMAIL_FROM || "onboarding@resend.dev",
    // Resend renvoie ses refus (domaine non vérifié, adresse invalide…) dans
    // `error` sans lever d'exception : on les remonte pour ne pas afficher
    // « envoyé » à tort.
    async send(mail) {
      const { error } = await resend.emails.send(mail);
      if (error) {
        console.error("[email] envoi refusé par Resend:", { to: mail.to, error });
        return { sent: false, reason: error.message || "refus de Resend" };
      }
      return { sent: true };
    },
    async batch(mails) {
      const { error } = await resend.batch.send(mails);
      if (error) console.error("[email] lot non envoyé:", error);
      return !error;
    },
  };
}

export async function sendReminderEmail(params: {
  to: string;
  donorName: string;
  amount: number;
  catalogItemName: string;
  serviceLabel: string;
  payUrl: string;
  senderName?: string; // nom de l'association (Administration), sinon NEXT_PUBLIC_SYNAGOGUE_NAME
}) {
  const mailer = getMailer();
  const name = params.senderName || process.env.NEXT_PUBLIC_SYNAGOGUE_NAME || "la synagogue";
  const amount = params.amount.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
  const item = params.catalogItemName ? ` pour <strong>${escapeHtml(params.catalogItemName)}</strong>` : "";
  const service = params.serviceLabel ? ` lors de <strong>${escapeHtml(params.serviceLabel)}</strong>` : "";

  const subject = `Votre promesse de don de ${amount} - ${name}`;
  const html = `
    <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; color: #1a1a2e;">
      <h2 style="color: #b8860b;">${escapeHtml(name)}</h2>
      <p>Bonjour ${escapeHtml(params.donorName)},</p>
      <p>
        Suite à votre promesse de don de <strong>${amount}</strong>${item}${service},
        nous vous remercions de bien vouloir la régler en cliquant sur le bouton ci-dessous.
        Le paiement est sécurisé et ne prend qu'une minute.
      </p>
      <p style="text-align: center; margin: 32px 0;">
        <a href="${params.payUrl}"
           style="background:#b8860b;color:#fff;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;">
          Régler ma promesse de ${amount}
        </a>
      </p>
      <p>Si vous avez déjà réglé ce don, merci de ne pas tenir compte de ce message.</p>
      <p>Merci pour votre générosité.<br />${escapeHtml(name)}</p>
      <p style="color:#666;font-size:12px;">Si le bouton ne fonctionne pas, copiez ce lien : ${params.payUrl}</p>
    </div>
  `;

  if (!mailer) {
    console.warn("[email] envoi non configuré — e-mail non envoyé, contenu:", { to: params.to, subject });
    return { sent: false as const, reason: NO_MAILER };
  }

  const from = mailer.from;
  return mailer.send({ from, to: params.to, subject, html });
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
  const mailer = getMailer();
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

  if (!mailer) {
    console.warn("[email] envoi non configuré — relevé non envoyé:", { to: params.to, subject });
    return { sent: false, reason: NO_MAILER };
  }

  const from = mailer.from;
  return mailer.send({ from, to: params.to, subject, html });
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
  const mailer = getMailer();
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

  if (!mailer) {
    console.warn("[email] envoi non configuré — reçu non envoyé:", { to: params.to, subject });
    return { sent: false, reason: NO_MAILER };
  }

  const from = mailer.from;
  return mailer.send({
    from,
    to: params.to,
    subject,
    html,
    attachments: [{ filename: `recu-fiscal-${params.number.replace("/", "-")}.pdf`, content: params.pdf }],
  });
}

// Lien de connexion à l'espace fidèle.
export async function sendDonorLoginEmail(params: { to: string; donorName: string; url: string }) {
  const mailer = getMailer();
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
  if (!mailer) {
    console.warn("[email] envoi non configuré — lien de connexion non envoyé:", { to: params.to });
    return { sent: false, reason: NO_MAILER };
  }
  const from = mailer.from;
  return mailer.send({ from, to: params.to, subject, html });
}

// Message groupé (annonce, newsletter) : un e-mail personnalisé par
// destinataire, par lots de 100 avec Resend, un par un avec Gmail.
export async function sendBulkMessages(
  messages: { to: string; subject: string; html: string }[]
): Promise<{ sent: number; failed: number; reason?: string }> {
  const mailer = getMailer();
  if (!mailer) return { sent: 0, failed: messages.length, reason: NO_MAILER };
  const mails = messages.map((m) => ({ from: mailer.from, ...m }));
  let sent = 0;
  let failed = 0;
  if (mailer.batch) {
    for (let i = 0; i < mails.length; i += 100) {
      const chunk = mails.slice(i, i + 100);
      if (await mailer.batch(chunk)) sent += chunk.length;
      else failed += chunk.length;
    }
  } else {
    for (const m of mails) {
      if ((await mailer.send(m)).sent) sent++;
      else failed++;
    }
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
  const mailer = getMailer();
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
  if (!mailer) {
    console.warn("[email] envoi non configuré — rappel de hazkara non envoyé:", { to: params.to, subject });
    return { sent: false, reason: NO_MAILER };
  }
  const from = mailer.from;
  return mailer.send({ from, to: params.to, subject, html });
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
  const mailer = getMailer();
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
  if (!mailer) {
    console.warn("[email] envoi non configuré — confirmation de places non envoyée:", { to: params.to });
    return { sent: false, reason: NO_MAILER };
  }
  const from = mailer.from;
  return mailer.send({ from, to: params.to, subject, html });
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
  const mailer = getMailer();
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
  if (!mailer) {
    console.warn("[email] envoi non configuré — billet non envoyé:", { to: params.to, subject });
    return { sent: false, reason: NO_MAILER };
  }
  const from = mailer.from;
  return mailer.send({
    from,
    to: params.to,
    subject,
    html,
    attachments: [{ filename: `billet-${params.code}.png`, content: params.qrPng }],
  });
}

export async function sendMikveEmail(params: { to: string; name: string; when: string; instructions: string; cancelUrl: string }) {
  const mailer = getMailer();
  const synagogueName = process.env.NEXT_PUBLIC_SYNAGOGUE_NAME || "la synagogue";
  const subject = `Réservation du mikvé - ${params.when}`;
  const html = `
    <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; color: #1a1a2e;">
      <h2 style="color: #b8860b;">${escapeHtml(synagogueName)}</h2>
      <p>Chalom ${escapeHtml(params.name)},</p>
      <p>Votre créneau au mikvé est réservé : <strong>${escapeHtml(params.when)}</strong>.</p>
      ${params.instructions ? `<p>${escapeHtml(params.instructions).replace(/\n/g, "<br/>")}</p>` : ""}
      <p style="font-size:13px;color:#555;">Empêchement ? <a href="${params.cancelUrl}">Annuler la réservation</a></p>
    </div>
  `;
  if (!mailer) {
    console.warn("[email] envoi non configuré — confirmation mikvé non envoyée:", { to: params.to });
    return { sent: false, reason: NO_MAILER };
  }
  const from = mailer.from;
  return mailer.send({ from, to: params.to, subject, html });
}
