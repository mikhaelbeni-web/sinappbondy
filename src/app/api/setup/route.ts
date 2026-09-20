import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebaseAdmin";
import { handleApiError, jsonError } from "@/lib/apiHelpers";
import { CATALOG_SEED } from "@/lib/catalogSeed";
import { PERMISSION_KEYS } from "@/lib/permissions";

// Amorçage de l'application : ne fonctionne que si aucune équipe n'existe
// encore. Crée le compte Firebase Auth, le poste "Administrateur" et le
// premier membre de l'équipe, puis initialise le catalogue par défaut.
export async function GET() {
  const teamSnap = await adminDb().collection("team").limit(1).get();
  return NextResponse.json({ needsSetup: teamSnap.empty });
}

export async function POST(req: NextRequest) {
  try {
    const { name, email, password, synagogueName } = await req.json();
    if (!name || !email || !password) {
      return jsonError("Nom, e-mail et mot de passe sont requis.", 400);
    }
    if (password.length < 8) {
      return jsonError("Le mot de passe doit contenir au moins 8 caractères.", 400);
    }

    const teamSnap = await adminDb().collection("team").limit(1).get();
    if (!teamSnap.empty) {
      return jsonError("L'application est déjà configurée.", 409);
    }

    const now = new Date().toISOString();
    const db = adminDb();

    // 1. Compte Firebase Auth
    const userRecord = await adminAuth().createUser({
      email,
      password,
      displayName: name,
    });

    // 2. Poste Administrateur (toutes permissions, non modifiable)
    const roleRef = db.collection("roles").doc();
    await roleRef.set({
      id: roleRef.id,
      name: "Administrateur",
      isAdmin: true,
      permissions: PERMISSION_KEYS,
      createdAt: now,
    });

    // 3. Membre d'équipe
    await db.collection("team").doc(userRecord.uid).set({
      id: userRecord.uid,
      email,
      name,
      roleId: roleRef.id,
      active: true,
      createdAt: now,
    } as any);

    // 4. Catalogue par défaut
    const batch = db.batch();
    for (const item of CATALOG_SEED) {
      const ref = db.collection("catalog").doc();
      batch.set(ref, {
        id: ref.id,
        name: item.name,
        category: item.category,
        order: item.order,
        active: true,
        createdAt: now,
      });
    }
    await batch.commit();

    // 5. Paramètres généraux
    await db.collection("settings").doc("general").set({
      synagogueName: synagogueName || "Synagogue",
      createdAt: now,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
