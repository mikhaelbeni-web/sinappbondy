import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { ticketUrl } from "@/lib/events";

// QR code du billet : encode l'URL du billet, pas de donnée personnelle.
export async function GET(_req: NextRequest, { params }: { params: { code: string } }) {
  const code = params.code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);
  const png = await QRCode.toBuffer(ticketUrl(code), { type: "png", width: 400, margin: 2 });
  return new NextResponse(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" } });
}
