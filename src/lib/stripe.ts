import Stripe from "stripe";

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (stripeInstance) return stripeInstance;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY manquant dans l'environnement.");
  }
  stripeInstance = new Stripe(key, { apiVersion: "2025-02-24.acacia" });
  return stripeInstance;
}
