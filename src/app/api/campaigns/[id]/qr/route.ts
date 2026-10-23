import { NextRequest } from "next/server";
import QRCode from "qrcode";
import { adminDb } from "@/lib/firebaseAdmin";
import { withPermission, handleApiError, jsonError } from "@/lib/apiHelpers";
import { publicDonateUrl } from "@/lib/campaigns";

// QR code (SVG) de la page de don, à imprimer ou afficher à la synagogue.
// id = "general" pour la page de don sans campagne.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await withPermission("gerer_paiements");
    let url = publicDonateUrl();
    let name = "don";
    if (params.id !== "general") {
      const snap = await adminDb().collection("campaigns").doc(params.id).get();
      if (!snap.exists) return jsonError("Campagne introuvable.", 404);
      const c = snap.data() as any;
      url = publicDonateUrl(c.slug);
      name = c.slug;
    }
    const svg = await QRCode.toString(url, { type: "svg", margin: 2, width: 512, errorCorrectionLevel: "M" });
    return new Response(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Content-Disposition": `inline; filename="qr-${name}.svg"`,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
