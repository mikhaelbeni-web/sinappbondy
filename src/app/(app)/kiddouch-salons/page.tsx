"use client";

import { useAuth } from "@/context/AuthContext";
import KiddushAdminTab from "@/components/KiddushAdminTab";

// Back-office : Chabbatot parrainés, demandes de salon, prix et textes.
export default function KiddushSalonsPage() {
  const { can } = useAuth();
  if (!can("gerer_offices")) return <p className="text-gray-500">Vous n'avez pas accès aux kiddouch et salons.</p>;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-serif font-bold text-ink">Kiddouch & salons</h1>
      <KiddushAdminTab />
    </div>
  );
}
