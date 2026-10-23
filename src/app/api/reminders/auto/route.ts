import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { withPermission, handleApiError, jsonError } from "@/lib/apiHelpers";
import { getReminderSettings, isRestDay, planReminders, runReminders } from "@/lib/autoReminders";

// Réglages + aperçu des prochaines relances automatiques.
export async function GET() {
  try {
    await withPermission("envoyer_relances");
    const settings = await getReminderSettings();
    const [plan, runsSnap, rest] = await Promise.all([
      planReminders(settings),
      adminDb().collection("reminderRuns").orderBy("at", "desc").limit(10).get(),
      isRestDay(),
    ]);
    return NextResponse.json({
      settings,
      plan: plan.map(({ pledges, ...p }) => p),
      runs: runsSnap.docs.map((d) => d.data()),
      restDay: rest,
      cronConfigured: !!process.env.CRON_SECRET,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    await withPermission("envoyer_relances");
    const { enabled, firstDelayDays, repeatEveryDays, maxReminders } = await req.json();
    const n = (v: unknown, min: number, max: number) => Math.min(max, Math.max(min, Math.round(Number(v))));
    if ([firstDelayDays, repeatEveryDays, maxReminders].some((v) => !Number.isFinite(Number(v)))) {
      return jsonError("Valeurs numériques attendues.", 400);
    }
    await adminDb()
      .collection("settings")
      .doc("reminders")
      .set({
        enabled: !!enabled,
        firstDelayDays: n(firstDelayDays, 0, 365),
        repeatEveryDays: n(repeatEveryDays, 1, 365),
        maxReminders: n(maxReminders, 1, 20),
        updatedAt: new Date().toISOString(),
      });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}

// Lancer maintenant (bouton).
export async function POST() {
  try {
    const user = await withPermission("envoyer_relances");
    return NextResponse.json(await runReminders("manuel", user.name));
  } catch (err) {
    return handleApiError(err);
  }
}
