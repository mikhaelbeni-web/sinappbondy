import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { handleApiError, jsonError } from "@/lib/apiHelpers";
import { findDonorsByEmail } from "@/lib/donors";
import { DONOR_COOKIE, DONOR_COOKIE_OPTIONS, createDonorToken, currentDonorId } from "@/lib/donorSession";
import { escapeForEmail, sendNoticeEmail } from "@/lib/email";
import { payUrl } from "@/lib/payments";
import { OCCASIONS } from "@/lib/kiddush";
import { getKiddushSettings, kiddushSlots, sponsorKiddush } from "@/lib/kiddushServer";

export const dynamic = "force-dynamic";

// Chabbatot à parrainer (public). Le nom des parrains n'est pas publié.
export async function GET() {
  try {
    const s = await getKiddushSettings();
    return NextResponse.json(
      { enabled: s.enabled, intro: s.intro, options: s.options, slots: s.enabled ? await kiddushSlots(s) : [], known: !!currentDonorId() },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return handleApiError(err);
  }
}

// Parrainage sans compte : le visiteur choisit, puis donne son nom et son
// e-mail. Sa fiche est retrouvée par e-mail ou créée ; une fiche existante
// n'est jamais ouverte ici (pas de cookie), seul l'e-mail y donne accès.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
    const db = adminDb();

    let donorId = currentDonorId();
    let created = false;
    if (!donorId) {
      const firstName = str(body.firstName, 80);
      const lastName = str(body.lastName, 80);
      const email = str(body.email, 120);
      if (!firstName || !lastName || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return jsonError("Prénom, nom et e-mail valides sont requis.", 400);
      const existing = (await findDonorsByEmail(email))[0];
      if (existing) donorId = existing.id;
      else {
        const now = new Date().toISOString();
        const ref = db.collection("donors").doc();
        await ref.set({ id: ref.id, firstName, lastName, email, phone: str(body.phone, 30), address: "", postalCode: "", city: "", notes: "Créé par un parrainage de kiddouch en ligne", createdAt: now, updatedAt: now });
        donorId = ref.id;
        created = true;
      }
    }

    const occasion = OCCASIONS.includes(body.occasion) ? body.occasion : "";
    let result;
    try {
      result = await sponsorKiddush({ donorId: donorId!, date: str(body.date, 10), option: str(body.option, 30), occasion, dedication: str(body.dedication, 120) });
    } catch (err) {
      if (created) await db.collection("donors").doc(donorId!).delete().catch(() => {});
      throw err;
    }

    let url: string | null = null;
    try {
      if (result.pledgeId) url = payUrl({ kind: "pledge", id: result.pledgeId });
    } catch {}
    let emailed = false;
    if (result.donorEmail) {
      const eur = result.price.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
      const espaceUrl = `${appUrl}/espace/connexion?t=${encodeURIComponent(createDonorToken(donorId!))}`;
      const r = await sendNoticeEmail({
        to: result.donorEmail,
        subject: `Votre parrainage - ${result.serviceLabel}`,
        bodyHtml: `
          <p>Chalom ${escapeForEmail(result.donorName)},</p>
          <p>Merci ! Vous parrainez : <strong>${escapeForEmail(result.label)}</strong>, ${escapeForEmail(result.serviceLabel)}.</p>
          ${result.dedication ? `<p>Dédicace : ${escapeForEmail(result.dedication)}</p>` : ""}
          ${result.price > 0 ? `<p>Montant : <strong>${eur}</strong>.</p>` : "<p>Le secrétariat vous recontacte pour l'organisation.</p>"}
          <p>Votre espace fidèle (règlements, reçus) : <a href="${espaceUrl}">ouvrir mon espace</a>. Ce lien est personnel, ne le transférez pas.</p>`,
        button: url ? { label: "Régler en ligne", url } : null,
      }).catch(() => ({ sent: false }));
      emailed = !!r.sent;
    }

    const res = NextResponse.json({ label: result.label, serviceLabel: result.serviceLabel, price: result.price, payUrl: url, emailed });
    if (created) res.cookies.set(DONOR_COOKIE, createDonorToken(donorId!), DONOR_COOKIE_OPTIONS);
    return res;
  } catch (err) {
    return handleApiError(err);
  }
}
