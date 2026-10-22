import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { withPermission, handleApiError, jsonError } from "@/lib/apiHelpers";
import { resolveAudience, type Audience } from "@/lib/audience";
import { messageHtml, sendBulkMessages } from "@/lib/email";
import { formatEUR } from "@/lib/format";
import { signValue } from "@/lib/payments";

function parseAudience(raw: any): Audience | null {
  if (!raw || typeof raw !== "object") return null;
  if (raw.type === "tous" || raw.type === "solde") return { type: raw.type };
  if (raw.type === "groupes" && Array.isArray(raw.groups) && raw.groups.length) return { type: "groupes", groups: raw.groups.map(String) };
  if (raw.type === "donateurs") return { type: "donateurs", year: Number(raw.year) || new Date().getFullYear() };
  return null;
}

// Historique + groupes existants ; ?audience=<json> pour compter les destinataires.
export async function GET(req: NextRequest) {
  try {
    await withPermission("envoyer_messages");
    const raw = new URL(req.url).searchParams.get("audience");
    if (raw) {
      const audience = parseAudience(JSON.parse(raw));
      if (!audience) return jsonError("Audience invalide.", 400);
      return NextResponse.json({ count: (await resolveAudience(audience)).length });
    }
    const [historySnap, donorsSnap] = await Promise.all([
      adminDb().collection("messages").orderBy("sentAt", "desc").limit(20).get(),
      adminDb().collection("donors").get(),
    ]);
    const groups = new Set<string>();
    for (const d of donorsSnap.docs) for (const g of (d.data() as any).groups || []) groups.add(g);
    return NextResponse.json({
      history: historySnap.docs.map((d) => d.data()),
      groups: Array.from(groups).sort((a, b) => a.localeCompare(b, "fr")),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

// Envoi : { subject, body, audience, test } — test = uniquement à soi-même.
// Variables : {prenom}, {nom}, {solde}.
export async function POST(req: NextRequest) {
  try {
    const user = await withPermission("envoyer_messages");
    const { subject, body, audience: rawAudience, test } = await req.json();
    if (typeof subject !== "string" || !subject.trim() || typeof body !== "string" || !body.trim()) {
      return jsonError("Objet et message sont requis.", 400);
    }
    const audience = parseAudience(rawAudience);
    if (!audience) return jsonError("Choisissez les destinataires.", 400);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
    const synagogueName = process.env.NEXT_PUBLIC_SYNAGOGUE_NAME || "Synagogue";
    const fill = (t: string, r: { firstName: string; lastName: string; balance: number }) =>
      t.replace(/\{prenom\}/g, r.firstName).replace(/\{nom\}/g, r.lastName).replace(/\{solde\}/g, formatEUR(r.balance));

    const recipients = test
      ? [{ id: "test", firstName: user.name.split(" ")[0] || user.name, lastName: user.name.split(" ").slice(1).join(" "), email: user.email, balance: 0 }]
      : await resolveAudience(audience);
    if (!recipients.length) return jsonError("Aucun destinataire avec e-mail pour cette sélection.", 400);

    const result = await sendBulkMessages(
      recipients.map((r) => ({
        to: r.email,
        subject: (test ? "[TEST] " : "") + fill(subject.trim(), r),
        html: messageHtml({
          synagogueName,
          body: fill(body, r),
          unsubscribeUrl: `${appUrl}/api/public/unsubscribe?d=${r.id}&t=${signValue(`optout:${r.id}`)}`,
        }),
      }))
    );
    if (result.reason) return jsonError(`Envoi impossible : ${result.reason}.`, 400);

    if (!test) {
      await adminDb().collection("messages").add({
        subject: subject.trim(),
        body,
        audience,
        recipients: recipients.length,
        sent: result.sent,
        failed: result.failed,
        sentBy: user.name,
        sentAt: new Date().toISOString(),
      });
    }
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err);
  }
}
