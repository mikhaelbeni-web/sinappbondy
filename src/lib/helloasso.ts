import { adminDb } from "./firebaseAdmin";
import { recordPayment } from "./payments";
import { autoReceiptForPayment } from "./receipts";
import { findOrCreateDonor } from "./donors";
import { createRegistration } from "./events";

// Paiement en ligne par HelloAsso Checkout (API v5).
// 1. createCheckout : on enregistre le panier dans `checkouts`, puis on crée
//    un checkout-intent HelloAsso et on renvoie son URL de paiement.
// 2. confirmCheckout : appelée par le webhook et par l'URL de retour. Elle ne
//    fait jamais confiance au contenu de la notification : elle relit le
//    checkout-intent auprès de l'API HelloAsso et n'enregistre le paiement que
//    si HelloAsso y a rattaché une commande payée.

// Hôte de l'API : https://api.helloasso.com (production, par défaut) ou
// https://api.helloasso-sandbox.com (tests). Un /v5 final est toléré.
function apiHost(): string {
  return (process.env.HELLOASSO_API_URL || "https://api.helloasso.com").replace(/\/+$/, "").replace(/\/v5$/, "");
}

function orgSlug(): string {
  const slug = process.env.HELLOASSO_ORGANIZATION_SLUG;
  if (!slug) throw new Error("HELLOASSO_ORGANIZATION_SLUG manquant dans l'environnement.");
  return slug;
}

export function isHelloAssoSandbox(): boolean {
  return apiHost().includes("sandbox");
}

// Jeton OAuth2 (client_credentials), valable 30 minutes : gardé en mémoire
// le temps de vie de l'instance pour ne pas en redemander à chaque appel.
let token: { access: string; refresh: string | null; expiresAt: number } | null = null;
let lastTokenError = "";

async function requestToken(body: Record<string, string>) {
  const res = await fetch(`${apiHost()}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
    cache: "no-store",
  });
  if (!res.ok) {
    lastTokenError = `${res.status} ${(await res.text()).slice(0, 300)}`;
    return null;
  }
  const json = (await res.json()) as any;
  return {
    access: json.access_token as string,
    refresh: (json.refresh_token as string) || null,
    expiresAt: Date.now() + (Number(json.expires_in) || 1800) * 1000 - 60_000,
  };
}

async function accessToken(): Promise<string> {
  if (token && token.expiresAt > Date.now()) return token.access;
  const clientId = process.env.HELLOASSO_CLIENT_ID;
  const clientSecret = process.env.HELLOASSO_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("HELLOASSO_CLIENT_ID ou HELLOASSO_CLIENT_SECRET manquant.");

  let next = token?.refresh
    ? await requestToken({ grant_type: "refresh_token", refresh_token: token.refresh })
    : null;
  if (!next) {
    next = await requestToken({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret });
  }
  if (!next) throw new Error(`HelloAsso refuse l'identification (vérifier l'identifiant et le secret du client API) : ${lastTokenError}`);
  token = next;
  return token.access;
}

async function api(path: string, init?: { method?: string; body?: unknown }): Promise<any> {
  const res = await fetch(`${apiHost()}/v5${path}`, {
    method: init?.method || "GET",
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    const hint =
      res.status === 409
        ? "l'association ne peut pas encore recevoir de paiements sur HelloAsso (compte à faire valider : justificatifs, IBAN)"
        : res.status === 401 || res.status === 403
          ? "accès refusé (identifiants ou droits du client API, ou mauvais HELLOASSO_ORGANIZATION_SLUG)"
          : res.status === 404
            ? "association introuvable (vérifier HELLOASSO_ORGANIZATION_SLUG)"
            : "";
    const err: any = new Error(`HelloAsso ${res.status}${hint ? ` : ${hint}` : ""} : ${text.slice(0, 500)}`);
    err.status = res.status;
    throw err;
  }
  return text ? JSON.parse(text) : null;
}

// Nom de l'association côté HelloAsso, pour vérifier la configuration.
export async function getHelloAssoOrganization(): Promise<{ name: string }> {
  const org = await api(`/organizations/${encodeURIComponent(orgSlug())}`);
  return { name: org?.name || orgSlug() };
}

export async function createCheckout(params: {
  amount: number; // en euros
  label: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  containsDonation: boolean;
  metadata: Record<string, string>;
}): Promise<string> {
  const db = adminDb();
  const ref = db.collection("checkouts").doc();
  const body = checkoutBody(params.amount, params.label, params.containsDonation, ref.id);
  const payer: Record<string, string> = {};
  if (params.email) payer.email = params.email;
  if (params.firstName) payer.firstName = params.firstName;
  if (params.lastName) payer.lastName = params.lastName;

  const path = `/organizations/${encodeURIComponent(orgSlug())}/checkout-intents`;
  let intent: any;
  try {
    intent = await api(path, { method: "POST", body: Object.keys(payer).length ? { ...body, payer } : body });
  } catch (err: any) {
    // HelloAsso refuse certains noms (chiffres, caractères spéciaux) : on
    // réessaie sans pré-remplir, le payeur saisira ses informations.
    if (err?.status !== 400 || !Object.keys(payer).length) throw err;
    intent = await api(path, { method: "POST", body });
  }
  if (!intent?.redirectUrl) throw new Error("HelloAsso n'a pas renvoyé d'URL de paiement.");

  await ref.set({
    id: ref.id,
    checkoutIntentId: String(intent.id),
    amount: Math.round(params.amount * 100) / 100,
    label: params.label,
    metadata: params.metadata,
    status: "en_attente",
    createdAt: new Date().toISOString(),
  });
  return intent.redirectUrl as string;
}

// HelloAsso n'accepte que des URL de retour en https.
function appUrl(): string {
  const url = (process.env.NEXT_PUBLIC_APP_URL || "").trim().replace(/\/+$/, "");
  if (!/^https:\/\//.test(url)) {
    throw new Error(`NEXT_PUBLIC_APP_URL doit commencer par https:// (valeur actuelle : « ${url} »).`);
  }
  return url;
}

function checkoutBody(amount: number, label: string, containsDonation: boolean, ref: string) {
  const cents = Math.round(amount * 100);
  const base = appUrl();
  return {
    totalAmount: cents,
    initialAmount: cents,
    itemName: label.slice(0, 250),
    backUrl: `${base}/merci?annule=1`,
    errorUrl: `${base}/merci?erreur=paiement`,
    returnUrl: `${base}/api/helloasso/return/${ref}`,
    containsDonation,
    metadata: { ref },
  };
}

// Test depuis Admin > Paiements : crée un paiement de 1 € (non enregistré
// dans l'appli) pour afficher la réponse exacte de HelloAsso.
export async function testHelloAssoCheckout(): Promise<string> {
  const intent = await api(`/organizations/${encodeURIComponent(orgSlug())}/checkout-intents`, {
    method: "POST",
    body: checkoutBody(1, "Test de configuration", true, "test"),
  });
  if (!intent?.redirectUrl) throw new Error("HelloAsso n'a pas renvoyé d'URL de paiement.");
  return intent.redirectUrl as string;
}

const PAID_STATES = ["Authorized", "Registered"];

// Enregistre le paiement d'un panier si HelloAsso confirme qu'il est payé.
// Renvoie true si le panier est (ou était déjà) payé.
export async function confirmCheckout(checkoutId: string): Promise<boolean> {
  const db = adminDb();
  const ref = db.collection("checkouts").doc(checkoutId);
  const snap = await ref.get();
  if (!snap.exists) return false;
  const checkout = snap.data() as any;
  if (checkout.status === "paye") return true;

  const intent = await api(
    `/organizations/${encodeURIComponent(orgSlug())}/checkout-intents/${encodeURIComponent(checkout.checkoutIntentId)}`,
  );
  const order = intent?.order;
  if (!order) return false; // pas encore payé (ou abandonné)
  const payments: any[] = Array.isArray(order.payments) ? order.payments : [];
  if (payments.length && !payments.some((p) => PAID_STATES.includes(p.state))) return false;

  // Le webhook et l'URL de retour arrivent souvent en même temps : un seul
  // des deux traite le panier (verrou de 2 minutes).
  const claimed = await db.runTransaction(async (tx) => {
    const cur = (await tx.get(ref)).data() as any;
    if (cur.status === "paye") return false;
    if (cur.processingAt && Date.now() - Date.parse(cur.processingAt) < 120_000) return false;
    tx.update(ref, { processingAt: new Date().toISOString() });
    return true;
  });
  if (!claimed) return true;

  const m = checkout.metadata || {};
  const amount: number = checkout.amount;
  const paymentId = `ha_${checkout.checkoutIntentId}`;
  const isDonation = m.kind === "don";
  const isTicket = m.kind === "billet";
  let donorId: string | undefined = m.donorId || undefined;

  if (isDonation || isTicket) {
    donorId = await findOrCreateDonor({
      firstName: m.firstName,
      lastName: m.lastName,
      email: m.email,
      address: m.address,
      postalCode: m.postalCode,
      city: m.city,
    });
  }

  if (donorId && amount > 0) {
    const payment = await recordPayment({
      id: paymentId,
      donorId,
      pledgeId: m.pledgeId || null,
      // Un don libre ou un billet ne vient pas solder les promesses du fidèle.
      allocate: !isDonation && !isTicket,
      campaignId: m.campaignId || null,
      eventId: isTicket ? m.eventId : null,
      amount,
      method: "cb_en_ligne",
      reference: `HelloAsso commande ${order.id}`,
      date: new Date().toISOString().slice(0, 10),
      onlineCheckoutId: checkout.checkoutIntentId,
      createdBy: "helloasso",
      createdByName: "Paiement en ligne",
    });
    if (payment) await autoReceiptForPayment(payment, "Paiement en ligne");
    if (isTicket) {
      const evSnap = await db.collection("events").doc(m.eventId).get();
      if (evSnap.exists) {
        await createRegistration({
          id: paymentId,
          event: evSnap.data() as any,
          donorId,
          name: `${m.firstName} ${m.lastName}`,
          email: m.email,
          qty: Number(m.qty) || 1,
          amount,
          paymentId,
        });
      }
    }
  }

  await ref.update({ status: "paye", orderId: String(order.id), paidAt: new Date().toISOString(), processingAt: null });
  return true;
}

// Filet de sécurité quand la notification HelloAsso n'arrive pas (l'URL de
// notification du compte peut servir à un autre outil) et que le donateur a
// fermé la page avant le retour : on revérifie les paniers en attente.
// Appelée par le cron quotidien (force) et à l'ouverture du tableau de bord
// (au plus une fois toutes les 10 minutes).
export async function confirmPendingCheckouts(opts: { force?: boolean } = {}): Promise<{ confirmed: number; abandoned: number }> {
  const result = { confirmed: 0, abandoned: 0 };
  if (!process.env.HELLOASSO_CLIENT_ID || !process.env.HELLOASSO_ORGANIZATION_SLUG) return result;
  const db = adminDb();

  const lockRef = db.collection("settings").doc("helloassoSweep");
  const due = await db.runTransaction(async (tx) => {
    const last = (await tx.get(lockRef)).data()?.lastRunAt as string | undefined;
    if (!opts.force && last && Date.now() - Date.parse(last) < 10 * 60_000) return false;
    tx.set(lockRef, { lastRunAt: new Date().toISOString() }, { merge: true });
    return true;
  });
  if (!due) return result;

  const snap = await db.collection("checkouts").where("status", "==", "en_attente").get();
  // HelloAsso considère un panier abandonné après 45 minutes ; on garde
  // une marge de 3 jours avant de le classer.
  const abandonBefore = Date.now() - 3 * 24 * 3600_000;
  const pending = snap.docs
    .map((d) => d.data() as any)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 50);

  for (const c of pending) {
    try {
      if (await confirmCheckout(c.id)) result.confirmed++;
      else if (Date.parse(c.createdAt) < abandonBefore) {
        await db.collection("checkouts").doc(c.id).update({ status: "abandonne" });
        result.abandoned++;
      }
    } catch (err) {
      console.error("[helloasso/pending]", c.id, err);
    }
  }
  return result;
}
