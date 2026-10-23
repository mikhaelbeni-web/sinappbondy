import { NextRequest, NextResponse } from "next/server";
import { withAdmin, handleApiError } from "@/lib/apiHelpers";
import { resetPreview, resetTestNumbering } from "@/lib/receipts";

// État des reçus de l'année avant une remise à zéro : marqués test ou non,
// sortis chez un destinataire extérieur ou non.
export async function GET(req: NextRequest) {
  try {
    const user = await withAdmin();
    const year = Number(new URL(req.url).searchParams.get("year")) || new Date().getFullYear();
    return NextResponse.json(await resetPreview(year, { uid: user.uid, name: user.name, email: user.email }));
  } catch (err) {
    return handleApiError(err);
  }
}

// Remise à zéro de la numérotation de l'année en cours (tous les reçus
// doivent être des tests).
export async function POST(req: NextRequest) {
  try {
    const user = await withAdmin();
    const { year, confirmText, externalNote } = await req.json();
    const result = await resetTestNumbering(
      { year: Number(year), confirmText, externalNote },
      { uid: user.uid, name: user.name, email: user.email }
    );
    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err);
  }
}
