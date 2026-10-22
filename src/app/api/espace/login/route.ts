import { NextRequest, NextResponse } from "next/server";
import { findDonorsByEmail } from "@/lib/donors";
import { createDonorToken } from "@/lib/donorSession";
import { sendDonorLoginEmail } from "@/lib/email";

// Demande de lien de connexion. La réponse est identique que l'e-mail
// soit connu ou non, pour ne pas révéler qui est fidèle.
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json({ error: "Adresse e-mail invalide." }, { status: 400 });
    }
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
    const donors = await findDonorsByEmail(email);
    // Plusieurs fiches avec le même e-mail (ex. un couple) : un lien par fiche.
    for (const d of donors.slice(0, 5)) {
      await sendDonorLoginEmail({
        to: d.email,
        donorName: `${d.firstName} ${d.lastName}`,
        url: `${appUrl}/espace/connexion?t=${encodeURIComponent(createDonorToken(d.id))}`,
      });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[espace/login]", err);
    return NextResponse.json({ error: "Envoi impossible pour le moment." }, { status: 500 });
  }
}
