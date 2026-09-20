import { NextResponse } from "next/server";
import { hasPermission, type PermissionKey } from "./permissions";
import { requireUser } from "./serverAuth";
import type { SessionUser } from "./types";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// Vérifie l'authentification et, si fourni, la permission requise.
// Lève une réponse d'erreur via throw { response } que les routes catchent.
export async function withPermission(perm?: PermissionKey): Promise<SessionUser> {
  const user = await requireUser();
  if (perm && !hasPermission(user.role, perm)) {
    const err: any = new Error(`Permission manquante : ${perm}`);
    err.status = 403;
    throw err;
  }
  return user;
}

export function handleApiError(err: any) {
  const status = err?.status || 500;
  const message = err?.message || "Erreur serveur";
  if (status === 500) console.error(err);
  return jsonError(message, status);
}
