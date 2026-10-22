import { NextRequest } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { withPermission, handleApiError, jsonError } from "@/lib/apiHelpers";
import { hasPermission } from "@/lib/permissions";
import { METHOD_LABELS, STATUS_LABELS, paidOf, remainingOf } from "@/lib/format";

// Exports CSV pour le comptable : séparateur « ; » et BOM UTF-8 pour
// qu'Excel (version française) ouvre le fichier correctement.
function toCsv(header: string[], rows: (string | number)[][]): string {
  const esc = (v: string | number) => {
    const s = typeof v === "number" ? v.toFixed(2).replace(".", ",") : v ?? "";
    return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [header, ...rows].map((r) => r.map(esc).join(";")).join("\r\n");
}

export async function GET(req: NextRequest, { params }: { params: { type: string } }) {
  try {
    const user = await withPermission("voir_tout");
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from") || "";
    const to = searchParams.get("to") || "";
    const inRange = (d: string) => (!from || d >= from) && (!to || d <= to);
    const db = adminDb();
    let csv: string;

    if (params.type === "promesses") {
      const snap = await db.collection("pledges").get();
      const rows = snap.docs
        .map((d) => d.data() as any)
        .filter((p) => inRange((p.createdAt || "").slice(0, 10)))
        .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
        .map((p) => [
          (p.createdAt || "").slice(0, 10),
          p.donorName,
          p.donorEmail || "",
          p.serviceLabel,
          p.catalogItemName,
          p.amount,
          paidOf(p),
          remainingOf(p),
          STATUS_LABELS[p.status] || p.status,
          p.createdByName || "",
          p.notes || "",
        ]);
      csv = toCsv(
        ["Date", "Fidèle", "E-mail", "Office", "Poste", "Montant", "Réglé", "Reste dû", "Statut", "Saisi par", "Notes"],
        rows
      );
    } else if (params.type === "encaissements") {
      if (!hasPermission(user.role, "gerer_paiements")) return jsonError("Permission manquante : gerer_paiements", 403);
      const snap = await db.collection("payments").get();
      const rows = snap.docs
        .map((d) => d.data() as any)
        .filter((p) => inRange(p.date))
        .sort((a, b) => (a.date < b.date ? -1 : 1))
        .map((p) => [
          p.date,
          p.donorName,
          p.amount,
          METHOD_LABELS[p.method] || p.method,
          p.reference || "",
          p.unallocated || 0,
          p.createdByName || "",
          p.notes || "",
        ]);
      csv = toCsv(["Date", "Fidèle", "Montant", "Mode", "Référence", "Non affecté", "Saisi par", "Notes"], rows);
    } else if (params.type === "fideles") {
      const [donorsSnap, pledgesSnap] = await Promise.all([db.collection("donors").get(), db.collection("pledges").get()]);
      const due: Record<string, number> = {};
      const paid: Record<string, number> = {};
      for (const d of pledgesSnap.docs) {
        const p = d.data() as any;
        due[p.donorId] = (due[p.donorId] || 0) + remainingOf(p);
        paid[p.donorId] = (paid[p.donorId] || 0) + paidOf(p);
      }
      const rows = donorsSnap.docs
        .map((d) => d.data() as any)
        .sort((a, b) => (`${a.lastName} ${a.firstName}` < `${b.lastName} ${b.firstName}` ? -1 : 1))
        .map((d) => [
          d.lastName,
          d.firstName,
          d.email || "",
          d.phone || "",
          d.address || "",
          d.postalCode || "",
          d.city || "",
          paid[d.id] || 0,
          due[d.id] || 0,
        ]);
      csv = toCsv(["Nom", "Prénom", "E-mail", "Téléphone", "Adresse", "Code postal", "Ville", "Total réglé", "Reste dû"], rows);
    } else {
      return jsonError("Export inconnu.", 404);
    }

    const suffix = from || to ? `_${from || "debut"}_${to || "fin"}` : "";
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${params.type}${suffix}.csv"`,
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
