import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { withPermission, handleApiError, jsonError } from "@/lib/apiHelpers";
import { escapeForEmail, sendNoticeEmail } from "@/lib/email";
import { SALON_STATUS_LABELS } from "@/lib/kiddush";
import { getKiddushSettings } from "@/lib/kiddushServer";

export const dynamic = "force-dynamic";

// Administration > Kiddouch & salons : réglages, parrainages, demandes.
export async function GET() {
  try {
    await withPermission("gerer_offices");
    const db = adminDb();
    const from = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
    const [settings, sponsors, salons] = await Promise.all([
      getKiddushSettings(),
      db.collection("kiddushSponsors").where("date", ">=", from).get(),
      db.collection("salonRequests").where("date", ">=", from).get(),
    ]);
    const byDate = (a: any, b: any) => (a.date < b.date ? -1 : 1);
    return NextResponse.json({
      settings,
      sponsors: sponsors.docs.map((d) => d.data()).sort(byDate),
      salons: salons.docs.map((d) => d.data()).sort(byDate),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    await withPermission("gerer_offices");
    const body = await req.json();
    const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
    const update: any = {
      enabled: !!body.enabled,
      salonsEnabled: !!body.salonsEnabled,
      intro: str(body.intro, 800),
      salonsIntro: str(body.salonsIntro, 800),
      salonsCapacity: str(body.salonsCapacity, 80),
      notifyEmail: str(body.notifyEmail, 120),
      weeksAhead: Math.min(60, Math.max(4, Math.round(Number(body.weeksAhead) || 26))),
      updatedAt: new Date().toISOString(),
    };
    if (update.notifyEmail && !/^\S+@\S+\.\S+$/.test(update.notifyEmail)) return jsonError("E-mail de notification invalide.", 400);
    if (Array.isArray(body.options)) {
      const options = body.options
        .map((o: any, i: number) => ({
          key: String(o?.key || `f${i + 1}`).replace(/[^a-z0-9]/gi, "").slice(0, 20) || `f${i + 1}`,
          label: str(o?.label, 60),
          price: Math.max(0, Math.round((Number(o?.price) || 0) * 100) / 100),
        }))
        .filter((o: any) => o.label)
        .slice(0, 6);
      if (new Set(options.map((o: any) => o.key)).size !== options.length) return jsonError("Deux formules portent le même identifiant.", 400);
      update.options = options;
    }
    if (Array.isArray(body.salonEventTypes)) update.salonEventTypes = body.salonEventTypes.map((t: any) => str(t, 40)).filter(Boolean).slice(0, 20);
    await adminDb().collection("settings").doc("kiddush").set(update, { merge: true });
    return NextResponse.json({ settings: await getKiddushSettings() });
  } catch (err) {
    return handleApiError(err);
  }
}

// Répondre à une demande de salon (confirmée / refusée) ; le demandeur est prévenu.
export async function PATCH(req: NextRequest) {
  try {
    await withPermission("gerer_offices");
    const body = await req.json();
    const status = String(body.status || "");
    if (!SALON_STATUS_LABELS[status]) return jsonError("Statut invalide.", 400);
    const db = adminDb();
    const ref = db.collection("salonRequests").doc(String(body.id || ""));
    const snap = await ref.get();
    if (!snap.exists) return jsonError("Demande introuvable.", 404);
    const r = snap.data() as any;
    if (status === "confirmee") {
      const same = await db.collection("salonRequests").where("date", "==", r.date).get();
      if (same.docs.some((d) => d.id !== ref.id && (d.data() as any).status === "confirmee")) return jsonError("Une autre demande est déjà confirmée à cette date.", 409);
    }
    await ref.update({ status, updatedAt: new Date().toISOString() });
    let emailed = false;
    if (status !== "nouvelle" && r.status !== status && r.email) {
      const day = new Date(`${r.date}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
      const sent = await sendNoticeEmail({
        to: r.email,
        subject: status === "confirmee" ? "Votre réservation des salons est confirmée" : "Votre demande de réservation des salons",
        bodyHtml:
          status === "confirmee"
            ? `<p>Chalom ${escapeForEmail(r.name)},</p><p>Votre réservation des salons est confirmée pour le <strong>${escapeForEmail(day)}</strong> (${escapeForEmail(r.eventType)}). Le secrétariat reste à votre disposition pour l'organisation.</p>`
            : `<p>Chalom ${escapeForEmail(r.name)},</p><p>Nous ne pouvons malheureusement pas donner suite à votre demande pour le ${escapeForEmail(day)}. N'hésitez pas à proposer une autre date.</p>`,
      }).catch(() => ({ sent: false }));
      emailed = !!sent.sent;
    }
    return NextResponse.json({ ok: true, emailed });
  } catch (err) {
    return handleApiError(err);
  }
}

// Libérer un Chabbat parrainé. Refusé si un règlement a déjà été affecté ;
// la somme due non réglée est annulée.
export async function DELETE(req: NextRequest) {
  try {
    await withPermission("gerer_offices");
    const id = new URL(req.url).searchParams.get("id") || "";
    const db = adminDb();
    const ref = db.collection("kiddushSponsors").doc(id);
    const snap = await ref.get();
    if (!snap.exists) return jsonError("Parrainage introuvable.", 404);
    const s = snap.data() as any;
    if (s.pledgeId) {
      const pref = db.collection("pledges").doc(s.pledgeId);
      const p = (await pref.get()).data() as any;
      if (p && (p.amountPaid || 0) > 0) return jsonError("Ce parrainage est déjà réglé (en tout ou partie) : il ne peut pas être libéré ici.", 409);
      if (p && p.status !== "annule") await pref.update({ status: "annule", updatedAt: new Date().toISOString() });
    }
    await ref.delete();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
