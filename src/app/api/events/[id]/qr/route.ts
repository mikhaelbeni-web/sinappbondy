import { NextRequest } from "next/server";
import QRCode from "qrcode";
import { adminDb } from "@/lib/firebaseAdmin";
import { withPermission, handleApiError, jsonError } from "@/lib/apiHelpers";

// QR code (SVG) de la page d'inscription, à imprimer sur l'affiche.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await withPermission("gerer_paiements");
    const snap = await adminDb().collection("events").doc(params.id).get();
    if (!snap.exists) return jsonError("Événement introuvable.", 404);
    const e = snap.data() as any;
    const url = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/evenement/${e.slug}`;
    const svg = await QRCode.toString(url, { type: "svg", margin: 2, width: 512, errorCorrectionLevel: "M" });
    return new Response(svg, {
      headers: { "Content-Type": "image/svg+xml", "Content-Disposition": `inline; filename="qr-${e.slug}.svg"` },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
