import { cookies } from "next/headers";
import { safeEqual, signValue } from "./payments";

// Session de l'espace fidèle : pas de mot de passe, un lien de connexion
// reçu par e-mail. Le jeton « donorId.expiration.signature » sert à la fois
// de lien (valable 30 jours) et de cookie httpOnly.

export const DONOR_COOKIE = "fidele";
const TTL_DAYS = 30;

export function createDonorToken(donorId: string): string {
  const exp = Math.floor(Date.now() / 1000) + TTL_DAYS * 86400;
  return `${donorId}.${exp}.${signValue(`fidele:${donorId}:${exp}`)}`;
}

export function verifyDonorToken(token: string | undefined | null): string | null {
  if (!token) return null;
  const [donorId, exp, sig] = token.split(".");
  if (!donorId || !exp || !sig) return null;
  if (Number(exp) < Date.now() / 1000) return null;
  try {
    return safeEqual(signValue(`fidele:${donorId}:${exp}`), sig) ? donorId : null;
  } catch {
    return null;
  }
}

export function currentDonorId(): string | null {
  return verifyDonorToken(cookies().get(DONOR_COOKIE)?.value);
}

export function requireDonorId(): string {
  const id = currentDonorId();
  if (!id) {
    const err: any = new Error("Session expirée, reconnectez-vous.");
    err.status = 401;
    throw err;
  }
  return id;
}

export const DONOR_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: TTL_DAYS * 86400,
};
