import { cookies } from "next/headers";
import { adminAuth, adminDb } from "./firebaseAdmin";
import type { RoleDoc, SessionUser, TeamMemberDoc } from "./types";

export const SESSION_COOKIE = "session";

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionCookie) return null;

  try {
    const decoded = await adminAuth().verifySessionCookie(sessionCookie, true);
    const uid = decoded.uid;

    const memberSnap = await adminDb().collection("team").doc(uid).get();
    if (!memberSnap.exists) return null;
    const member = memberSnap.data() as TeamMemberDoc;
    if (!member.active) return null;

    let role: RoleDoc | null = null;
    if (member.roleId) {
      const roleSnap = await adminDb().collection("roles").doc(member.roleId).get();
      if (roleSnap.exists) role = { id: roleSnap.id, ...(roleSnap.data() as any) } as RoleDoc;
    }

    return {
      uid,
      email: member.email,
      name: member.name,
      roleId: member.roleId,
      role,
    };
  } catch (err) {
    return null;
  }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    const err: any = new Error("Non authentifié");
    err.status = 401;
    throw err;
  }
  return user;
}
