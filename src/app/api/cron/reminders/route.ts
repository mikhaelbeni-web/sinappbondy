import { NextRequest, NextResponse } from "next/server";
import { runReminders } from "@/lib/autoReminders";

// Appelé chaque jour par Vercel Cron (voir vercel.json). Vercel envoie
// « Authorization: Bearer $CRON_SECRET » quand la variable est définie.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  try {
    const result = await runReminders("cron", "Relance automatique");
    return NextResponse.json(result);
  } catch (err) {
    console.error("[cron/reminders]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
