import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { withPermission, handleApiError, jsonError } from "@/lib/apiHelpers";
import { getPortal } from "@/lib/portalServer";
import { DEFAULT_PORTAL, PHOTO_CATEGORIES } from "@/lib/portal";

export const dynamic = "force-dynamic";

// Contenu du portail public des fidèles (Administration > Portail).
export async function GET() {
  try {
    await withPermission("gerer_offices");
    return NextResponse.json({ portal: await getPortal(), defaults: DEFAULT_PORTAL });
  } catch (err) {
    return handleApiError(err);
  }
}

const TEXT_FIELDS = ["displayName", "tagline", "intro", "phone", "email", "address", "postalCode", "city", "history", "heroPhoto"] as const;
const isImageSrc = (s: string) => s === "" || /^\/[\w\-./]+\.(jpe?g|png|webp)$/i.test(s) || /^https:\/\/\S+$/i.test(s);

export async function PUT(req: NextRequest) {
  try {
    await withPermission("gerer_offices");
    const body = await req.json();
    const update: any = {};
    for (const key of TEXT_FIELDS) {
      if (typeof body[key] === "string") update[key] = body[key].trim().slice(0, key === "history" ? 6000 : 400);
    }
    if (update.displayName === "") return jsonError("Le nom affiché est obligatoire.", 400);
    if (update.email && !/^\S+@\S+\.\S+$/.test(update.email)) return jsonError("E-mail de contact invalide.", 400);
    if (update.heroPhoto !== undefined && !isImageSrc(update.heroPhoto)) return jsonError("Photo d'accueil : chemin /portail/... ou adresse https attendu.", 400);

    if (Array.isArray(body.services)) {
      update.services = body.services
        .map((s: any) => ({ title: String(s?.title || "").trim().slice(0, 80), text: String(s?.text || "").trim().slice(0, 400) }))
        .filter((s: any) => s.title)
        .slice(0, 24);
    }
    if (Array.isArray(body.photos)) {
      const cats = PHOTO_CATEGORIES.map((c) => c.key) as string[];
      const photos = [];
      for (const p of body.photos.slice(0, 60)) {
        const src = String(p?.src || "").trim();
        const alt = String(p?.alt || "").trim().slice(0, 200);
        if (!src) continue;
        if (!isImageSrc(src)) return jsonError(`Photo « ${src} » : chemin /portail/... ou adresse https attendu.`, 400);
        if (!alt) return jsonError(`Photo « ${src} » : la description est obligatoire (lecteurs d'écran).`, 400);
        const photo: any = { src, alt, category: cats.includes(p?.category) ? p.category : "synagogue" };
        if (Number(p?.width) > 0 && Number(p?.height) > 0) {
          photo.width = Math.round(Number(p.width));
          photo.height = Math.round(Number(p.height));
        }
        photos.push(photo);
      }
      update.photos = photos;
    }
    update.updatedAt = new Date().toISOString();
    await adminDb().collection("settings").doc("portal").set(update, { merge: true });
    return NextResponse.json({ portal: await getPortal() });
  } catch (err) {
    return handleApiError(err);
  }
}
