import { NextResponse } from "next/server";
import { withPermission, handleApiError } from "@/lib/apiHelpers";
import { getHelloAssoOrganization, isHelloAssoSandbox } from "@/lib/helloasso";

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
      error,
      webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL || ""}/api/helloasso/webhook`,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
