"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { PERMISSIONS, type PermissionKey } from "@/lib/permissions";

type Tab = "postes" | "equipe" | "paiements";

export default function AdminPage() {
  const { can } = useAuth();
  const [tab, setTab] = useState<Tab>("postes");

  if (!can("gerer_equipe") && !can("gerer_postes") && !can("gerer_paiements")) {
    return <p className="text-gray-500">Vous n'avez pas accès à l'administration.</p>;
  }

  const tabs: { key: Tab; label: string; show: boolean }[] = [
    { key: "postes", label: "Postes & autorisations", show: can("gerer_postes") },
    { key: "equipe", label: "Équipe", show: can("gerer_equipe") },
    { key: "paiements", label: "Paiements", show: can("gerer_paiements") },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-serif font-bold text-ink">Administration</h1>
      <div className="flex gap-2 border-b overflow-x-auto whitespace-nowrap -mx-4 px-4 sm:mx-0 sm:px-0">
        {tabs.filter((t) => t.show).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px shrink-0 ${
              tab === t.key ? "border-gold text-ink" : "border-transparent text-gray-500 hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "postes" && can("gerer_postes") && <RolesTab />}
      {tab === "equipe" && can("gerer_equipe") && <TeamTab />}
      {tab === "paiements" && can("gerer_paiements") && <PaymentsTab />}
    </div>
  );
}

function RolesTab() {
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [perms, setPerms] = useState<PermissionKey[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/roles");
    const data = await res.json();
    setRoles(data.roles || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function togglePerm(key: PermissionKey) {
    setPerms((prev) => (prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, permissions: perms }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setName("");
      setPerms([]);
      setShowForm(false);
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Supprimer ce poste ?")) return;
    const res = await fetch(`/api/roles/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) alert(data.error);
    await load();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Créez des postes (trésorier, directeur, etc.) et cochez ce à quoi chacun a accès. Le poste « Administrateur »
        a toujours accès à tout.
      </p>

      <button onClick={() => setShowForm((s) => !s)} className="btn-primary">
        {showForm ? "Annuler" : "+ Nouveau poste"}
      </button>

      {showForm && (
        <form onSubmit={handleCreate} className="card p-4 space-y-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div>
            <label className="label">Nom du poste</label>
            <input required className="input max-w-sm" placeholder="ex : Trésorier" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label">Autorisations</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {PERMISSIONS.map((p) => (
                <label key={p.key} className="flex items-start gap-2 text-sm bg-gray-50 rounded-md p-2">
                  <input type="checkbox" checked={perms.includes(p.key)} onChange={() => togglePerm(p.key)} className="mt-1" />
                  <span>
                    <span className="font-medium">{p.label}</span>
                    <br />
                    <span className="text-gray-500 text-xs">{p.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
          <button type="submit" disabled={saving} className="btn-gold">
            {saving ? "Création…" : "Créer le poste"}
          </button>
        </form>
      )}

      <div className="card divide-y">
        {loading && <p className="p-4 text-sm text-gray-500">Chargement…</p>}
        {roles.map((r) => (
          <div key={r.id} className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-ink">
                  {r.name} {r.isAdmin && <span className="text-xs text-gold ml-1">(tous accès)</span>}
                </p>
                {!r.isAdmin && (
                  <p className="text-xs text-gray-500 mt-1">
                    {r.permissions.length === 0
                      ? "Aucune autorisation"
                      : r.permissions
                          .map((k: string) => PERMISSIONS.find((p) => p.key === k)?.label || k)
                          .join(", ")}
                  </p>
                )}
              </div>
              {!r.isAdmin && (
                <button onClick={() => remove(r.id)} className="btn-danger text-xs px-2 py-1 shrink-0 self-start sm:self-auto">
                  Supprimer
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TeamTab() {
  const [team, setTeam] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", roleId: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const [tRes, rRes] = await Promise.all([fetch("/api/team"), fetch("/api/roles")]);
    const [t, r] = await Promise.all([tRes.json(), rRes.json()]);
    setTeam(t.team || []);
    setRoles(r.roles || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setForm({ name: "", email: "", password: "", roleId: "" });
      setShowForm(false);
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(id: string, active: boolean) {
    await fetch(`/api/team/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !active }),
    });
    await load();
  }

  async function changeRole(id: string, roleId: string) {
    await fetch(`/api/team/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roleId }),
    });
    await load();
  }

  return (
    <div className="space-y-4">
      <button onClick={() => setShowForm((s) => !s)} className="btn-primary">
        {showForm ? "Annuler" : "+ Nouveau membre"}
      </button>

      {showForm && (
        <form onSubmit={handleCreate} className="card p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          {error && <p className="md:col-span-2 text-sm text-red-600">{error}</p>}
          <div>
            <label className="label">Nom</label>
            <input required className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">E-mail</label>
            <input required type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className="label">Mot de passe provisoire</label>
            <input required type="password" minLength={8} className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          <div>
            <label className="label">Poste</label>
            <select required className="input" value={form.roleId} onChange={(e) => setForm({ ...form, roleId: e.target.value })}>
              <option value="">— Choisir —</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <button type="submit" disabled={saving} className="btn-gold">
              {saving ? "Création…" : "Créer le membre"}
            </button>
          </div>
        </form>
      )}

      <div className="card divide-y">
        {loading && <p className="p-4 text-sm text-gray-500">Chargement…</p>}
        {team.map((m) => (
          <div key={m.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm">
            <div className="min-w-0">
              <p className={`font-medium ${m.active ? "text-ink" : "text-gray-400 line-through"}`}>{m.name}</p>
              <p className="text-gray-500 break-words">{m.email}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <select className="input w-full sm:w-40" value={m.roleId} onChange={(e) => changeRole(m.id, e.target.value)}>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
              <button onClick={() => toggleActive(m.id, m.active)} className="btn-secondary text-xs px-2 py-1">
                {m.active ? "Désactiver" : "Activer"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PaymentsTab() {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/payments")
      .then((r) => r.json())
      .then(setStatus)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-gray-500">Chargement…</p>;

  return (
    <div className="card p-4 space-y-3 max-w-lg">
      <Row label="Clé secrète Stripe" ok={status?.hasSecretKey} />
      <Row label="Secret de webhook Stripe" ok={status?.hasWebhookSecret} />
      {status?.accountEmail && <p className="text-sm text-gray-600">Compte Stripe : {status.accountEmail}</p>}
      {status?.error && <p className="text-sm text-red-600">{status.error}</p>}
      <div className="text-sm text-gray-500 pt-2 border-t">
        <p>URL de webhook à configurer dans Stripe :</p>
        <code className="text-xs bg-gray-100 rounded px-2 py-1 block mt-1 break-all">{status?.webhookUrl}</code>
        <p className="mt-1">Événement à écouter : <code>checkout.session.completed</code></p>
      </div>
    </div>
  );
}

function Row({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span>{label}</span>
      <span className={ok ? "text-green-700 font-medium" : "text-red-600 font-medium"}>{ok ? "Configuré" : "Manquant"}</span>
    </div>
  );
}
