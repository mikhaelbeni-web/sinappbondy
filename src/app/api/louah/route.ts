import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { withPermission, handleApiError, jsonError } from "@/lib/apiHelpers";
import { getLouahSettings } from "@/lib/louah";

export async function GET() {
  try {
    await withPermission("gerer_offices");
    return NextResponse.json({ settings: await getLouahSettings(), url: `${process.env.NEXT_PUBLIC_APP_URL || ""}/louah` });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    await withPermission("gerer_offices");
    const b = await req.json();
    const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
    const latitude = Number(b.latitude);
    const longitude = Number(b.longitude);
    const candleMinutes = Math.round(Number(b.candleMinutes));
    if (!(latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180)) return jsonError("Coordonnées invalides.", 400);
    if (!(candleMinutes >= 0 && candleMinutes <= 60)) return jsonError("Allumage : entre 0 et 60 minutes avant le coucher du soleil.", 400);
    const times = (Array.isArray(b.times) ? b.times : [])
      .map((t: any) => ({ label: str(t?.label, 60), value: str(t?.value, 40) }))
      .filter((t: any) => t.label && t.value)
      .slice(0, 20);
    await adminDb().collection("settings").doc("louah").set({
      title: str(b.title, 80),
      city: str(b.city, 60) || "Bondy",
      latitude,
      longitude,
      candleMinutes,
      announcements: str(b.announcements, 2000),
      times,
      showZmanim: !!b.showZmanim,
      showHazkarot: !!b.showHazkarot,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
