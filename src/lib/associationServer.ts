import { adminDb } from "./firebaseAdmin";
import { EMPTY_ASSOCIATION, type AssociationSettings } from "./association";

export async function getAssociation(): Promise<AssociationSettings> {
  const snap = await adminDb().collection("settings").doc("association").get();
  return { ...EMPTY_ASSOCIATION, ...(snap.exists ? (snap.data() as any) : {}) };
}
