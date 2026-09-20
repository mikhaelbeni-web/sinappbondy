import { NextResponse } from "next/server";
import { withPermission, handleApiError } from "@/lib/apiHelpers";
import { getStripe } from "@/lib/stripe";

// État de la configuration Stripe, pour l'écran Admin > Paiements.
export async function GET() {
  try {
    await withPermission("gerer_paiements");

    const hasSecretKey = !!process.env.STRIPE_SECRET_KEY;
    const hasWebhookSecret = !!process.env.STRIPE_WEBHOOK_SECRET;
    let accountEmail: string | null = null;
    let error: string | null = null;

    if (hasSecretKey) {
      try {
        const account = await getStripe().accounts.retrieve();
        accountEmail = account.email || null;
      } catch (e: any) {
        error = e?.message || "Impossible de contacter Stripe.";
      }
    }

    return NextResponse.json({
      hasSecretKey,
      hasWebhookSecret,
      accountEmail,
      error,
      webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL || ""}/api/stripe/webhook`,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
