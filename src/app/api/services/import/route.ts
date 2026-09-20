import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { withPermission, handleApiError, jsonError } from "@/lib/apiHelpers";
import { fetchHebrewCalendar } from "@/lib/hebcal";

// Importe automatiquement les Shabbat et fêtes d'une année depuis le
// calendrier juif (Hebcal, Paris, diaspora) et crée les offices
// correspondants s'ils n'existent pas déjà (dédoublonnage par date).
export async function POST(req: NextRequest) {
  try {
    const user = await withPermission("gerer_offices");
    const { year } = await req.json();
    const y = Number(year);
    if (!y || y < 2000 || y > 2100) return jsonError("Année invalide.", 400);

    const calendar = await fetchHebrewCalendar(y);
    if (calendar.length === 0) {
      return jsonError("Le calendrier hébraïque n'a renvoyé aucune date pour cette année.", 502);
    }

    const existingSnap = await adminDb()
      .collection("services")
      .where("date", ">=", `${y}-01-01`)
      .where("date", "<=", `${y}-12-31`)
      .get();
    const existingDates = new Set(existingSnap.docs.map((d) => (d.data() as any).date));

    // Une seule fête/office par date (une fête tombant un Shabbat prime
    // sur l'intitulé "Chabbat - Parachat ...").
    const byDate = new Map<string, { date: string; type: "shabbat" | "fete"; label: string }>();
    for (const item of calendar) {
      const current = byDate.get(item.date);
      if (!current || (current.type === "shabbat" && item.type === "fete")) {
        byDate.set(item.date, item);
      }
    }

    const now = new Date().toISOString();
    const db = adminDb();
    const batch = db.batch();
    let created = 0;

    for (const item of byDate.values()) {
      if (existingDates.has(item.date)) continue;
      const ref = db.collection("services").doc();
      batch.set(ref, {
        id: ref.id,
        date: item.date,
        type: item.type,
        label: item.label,
        notes: "",
        closed: false,
        createdBy: user.uid,
        createdAt: now,
      });
      created++;
    }

    if (created > 0) await batch.commit();

    return NextResponse.json({ created, skipped: byDate.size - created, total: byDate.size });
  } catch (err) {
    return handleApiError(err);
  }
}
