import { NextRequest, NextResponse } from "next/server";
import { isRestDay, runReminders } from "@/lib/autoReminders";
import { runHazkaraReminders } from "@/lib/hazkarot";
import { confirmPendingCheckouts } from "@/lib/helloasso";

// Relances de dons et rappels de hazkara, appelé chaque jour par Vercel Cron (voir vercel.json). Vercel envoie
// « Authorization: Bearer $CRON_SECRET » quand la variable est définie.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  try {
    // D'abord les paiements HelloAsso non notifiés, pour ne pas relancer
    // quelqu'un qui a déjà payé.
    let helloasso: unknown = null;
    try {
      helloasso = await confirmPendingCheckouts({ force: true });
    } catch (err) {
      console.error("[cron/reminders] helloasso", err);
    }
    const result = await runReminders("cron", "Relance automatique");
    // Rappels de hazkara : même règle, rien le Chabbat ni les jours de fête.
    const rest = await isRestDay();
    const hazkarot = rest ? { sent: 0, skipped: `pas d'envoi : ${rest}` } : await runHazkaraReminders();
    return NextResponse.json({ ...result, hazkarot, helloasso });
  } catch (err) {
    console.error("[cron/reminders]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
