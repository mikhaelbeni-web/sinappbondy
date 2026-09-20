"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { formatEUR, formatDate } from "@/lib/format";
import StatusBadge from "@/components/StatusBadge";
import { useAuth } from "@/context/AuthContext";

export default function ServiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const [service, setService] = useState<any>(null);
  const [pledges, setPledges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/services/${id}`);
    const data = await res.json();
    setService(data.service);
    setPledges(data.pledges || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [id]);

  if (loading) return <p className="text-gray-500">Chargement…</p>;
  if (!service) return <p className="text-gray-500">Office introuvable.</p>;

  const total = pledges.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-serif font-bold text-ink">{service.label}</h1>
          <p className="text-sm text-gray-500">{formatDate(service.date)}</p>
        </div>
        {can("saisir_promesses") && (
          <Link href={`/pledges?serviceId=${service.id}`} className="btn-gold">
            + Saisir une promesse
          </Link>
        )}
      </div>

      <div className="card p-4 max-w-xs">
        <p className="text-xs text-gray-500 uppercase">Total promis sur cet office</p>
        <p className="text-xl font-bold text-ink">{formatEUR(total)}</p>
      </div>

      <div className="card divide-y">
        {pledges.length === 0 && <p className="p-4 text-sm text-gray-500">Aucune promesse saisie pour cet office.</p>}
        {pledges.map((p) => (
          <div key={p.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm">
            <div className="min-w-0">
              <p className="font-medium text-ink">{p.donorName}</p>
              <p className="text-gray-500">{p.catalogItemName}</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="font-semibold">{formatEUR(p.amount)}</span>
              <StatusBadge status={p.status} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
