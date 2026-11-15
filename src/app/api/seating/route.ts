import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { withPermission, handleApiError, jsonError } from "@/lib/apiHelpers";
import { cleanSections, planCapacity } from "@/lib/seating";

export async function GET() {
  try {
    await withPermission("gerer_paiements");
    const [plansSnap, seatsSnap] = await Promise.all([adminDb().collection("seatingPlans").get(), adminDb().collection("seats").get()]);
    const assigned: Record<string, number> = {};
    for (const d of seatsSnap.docs) {
      const s = d.data() as any;
      assigned[s.planId] = (assigned[s.planId] || 0) + 1;
    }
    const plans = plansSnap.docs
      .map((d) => d.data() as any)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .map((p) => ({
        ...p,
        capacity: planCapacity(p),
        assigned: assigned[p.id] || 0,
      }));
    return NextResponse.json({ plans });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    await withPermission("gerer_paiements");
    const { name, year, sections, drawn, fromPlanId } = await req.json();
    if (!name?.trim()) return jsonError("Le nom du plan est requis.", 400);
    // Plan dessiné : les sections sont des tarifs ; le dessin se fait ensuite dans l'éditeur.
    // Départ d'un plan existant (le plan de base, par exemple) : son dessin et
    // ses tarifs sont copiés ; les places attribuées ne le sont pas.
    const source = drawn && fromPlanId ? ((await adminDb().collection("seatingPlans").doc(String(fromPlanId)).get()).data() as any) : null;
    if (drawn && fromPlanId && !source?.layout) return jsonError("Le plan de départ est introuvable ou n'est pas dessiné.", 400);
    const clean = source ? source.sections : drawn ? cleanSections(sections?.length ? sections : [{ id: "places", name: "Places", price: 0 }], true) : cleanSections(sections);
    if (!clean) return jsonError("Ajoutez au moins une section valide (identifiants uniques).", 400);
    const now = new Date().toISOString();
    const ref = adminDb().collection("seatingPlans").doc();
    const doc = { id: ref.id, name: name.trim(), year: Number(year) || new Date().getFullYear(), sections: clean, ...(drawn ? { drawn: true, layout: source?.layout || null } : {}), active: true, createdAt: now, updatedAt: now };
    await ref.set(doc);
    return NextResponse.json({ plan: doc });
  } catch (err) {
    return handleApiError(err);
  }
}
