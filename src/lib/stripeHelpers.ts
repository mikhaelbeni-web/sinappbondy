import { adminDb } from "./firebaseAdmin";
import { getStripe } from "./stripe";

// Un seul "produit" Stripe générique pour tous les dons ; chaque promesse
// obtient son propre Price (montant fixe) puis son propre Payment Link,
// ce qui donne un lien de paiement stable (contrairement aux Checkout
// Sessions, qui expirent).
async function getOrCreateDonProductId(): Promise<string> {
  const settingsRef = adminDb().collection("settings").doc("stripe");
  const snap = await settingsRef.get();
  const existing = snap.exists ? (snap.data() as any)?.productId : null;
  if (existing) return existing;

  const stripe = getStripe();
  const synagogueName = process.env.NEXT_PUBLIC_SYNAGOGUE_NAME || "Synagogue";
  const product = await stripe.products.create({
    name: `Don - ${synagogueName}`,
  });

  await settingsRef.set({ productId: product.id }, { merge: true });
  return product.id;
}

export async function createPledgePaymentLink(params: {
  pledgeId: string;
  amount: number; // en euros
  donorName: string;
  catalogItemName: string;
}): Promise<{ url: string; id: string }> {
  const stripe = getStripe();
  const productId = await getOrCreateDonProductId();

  const price = await stripe.prices.create({
    product: productId,
    currency: "eur",
    unit_amount: Math.round(params.amount * 100),
    nickname: `${params.donorName} - ${params.catalogItemName}`.slice(0, 100),
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const paymentLink = await stripe.paymentLinks.create({
    line_items: [{ price: price.id, quantity: 1 }],
    metadata: { pledgeId: params.pledgeId },
    after_completion: {
      type: "redirect",
      redirect: { url: `${appUrl}/merci` },
    },
  });

  return { url: paymentLink.url, id: paymentLink.id };
}
