import { NextResponse } from "next/server";
import { withPermission, handleApiError } from "@/lib/apiHelpers";
import { getHelloAssoOrganization, helloAssoApiHost, isHelloAssoSandbox, testHelloAssoCheckout } from "@/lib/helloasso";

// État de la configuration HelloAsso, pour l'écran Admin > Paiements.
export async function GET() {
  try {
    await withPermission("gerer_paiements");

    const hasClientId = !!process.env.HELLOASSO_CLIENT_ID;
    const hasClientSecret = !!process.env.HELLOASSO_CLIENT_SECRET;
    const organizationSlug = process.env.HELLOASSO_ORGANIZATION_SLUG || null;
    let organizationName: string | null = null;
    let error: string | null = null;

    if (hasClientId && hasClientSecret && organizationSlug) {
      try {
        organizationName = (await getHelloAssoOrganization()).name;
      } catch (e: any) {
        error = e?.message || "Impossible de contacter HelloAsso.";
      }
    }

    return NextResponse.json({
      hasClientId,
      hasClientSecret,
      organizationSlug,
      organizationName,
      sandbox: isHelloAssoSandbox(),
      appUrl: process.env.NEXT_PUBLIC_APP_URL || null,
      apiHost: helloAssoApiHost(),
      apiUrlVar: process.env.HELLOASSO_API_URL ?? null,
      error,
      webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL || ""}/api/helloasso/webhook`,
    });
  } catch (err) {
    return handleApiError(err);
  }
}

// Test de création d'un paiement HelloAsso (1 €, rien n'est enregistré).
export async function POST() {
  try {
    await withPermission("gerer_paiements");
    try {
      return NextResponse.json({ ok: true, redirectUrl: await testHelloAssoCheckout() });
    } catch (e: any) {
      return NextResponse.json({ ok: false, error: e?.message || "Erreur inconnue." });
    }
  } catch (err) {
    return handleApiError(err);
  }
}
