import { NextResponse } from "next/server";
import { computeLouah } from "@/lib/louah";

// Données de l'écran louah (public : affiché sur la TV de la synagogue).
export async function GET() {
  try {
    return NextResponse.json(await computeLouah(), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[public/louah]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
