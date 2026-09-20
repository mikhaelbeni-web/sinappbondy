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
