"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { PERMISSIONS, type PermissionKey } from "@/lib/permissions";
import { ASSOCIATION_CATEGORIES } from "@/lib/association";
import { formatEUR, formatDate } from "@/lib/format";

type Tab = "postes" | "equipe" | "association" | "journal" | "relances" | "paiements" | "louah";

export default function AdminPage() {
  const { can, user } = useAuth();
  const isAdmin = !!user?.role?.isAdmin;
  const [tab, setTab] = useState<Tab>(
    can("gerer_postes") ? "postes" : can("gerer_paiements") ? "association" : can("envoyer_relances") ? "relances" : "louah"
  );

  if (!can("gerer_equipe") && !can("gerer_postes") && !can("gerer_paiements") && !can("envoyer_relances") && !can("gerer_offices")) {
    return <p className="text-gray-500">Vous n'avez pas accès à l'administration.</p>;
  }

  const tabs: { key: Tab; label: string; show: boolean }[] = [
    { key: "postes", label: "Postes & autorisations", show: can("gerer_postes") },
    { key: "equipe", label: "Équipe", show: can("gerer_equipe") },
    { key: "association", label: "Association & reçus fiscaux", show: can("gerer_paiements") },
    { key: "journal", label: "Journal des reçus", show: isAdmin },
    { key: "relances", label: "Relances automatiques", show: can("envoyer_relances") },
    { key: "paiements", label: "Paiements", show: can("gerer_paiements") },
    { key: "louah", label: "Écran louah", show: can("gerer_offices") },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-serif font-bold text-ink">Administration</h1>
      <div className="flex gap-2 border-b overflow-x-auto whitespace-nowrap -mx-4 px-4 sm:mx-0 sm:px-0">
        {tabs.filter((t) => t.show).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`tap px-4 py-2 text-sm font-medium border-b-2 -mb-px shrink-0 ${
              tab === t.key ? "border-gold text-ink" : "border-transparent text-gray-500 hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "postes" && can("gerer_postes") && <RolesTab />}
      {tab === "equipe" && can("gerer_equipe") && <TeamTab />}
      {tab === "association" && can("gerer_paiements") && <AssociationTab />}
      {tab === "journal" && isAdmin && <ReceiptAuditTab />}
      {tab === "relances" && can("envoyer_relances") && <RemindersTab />}
      {tab === "paiements" && can("gerer_paiements") && <PaymentsTab />}
      {tab === "louah" && can("gerer_offices") && <LouahTab />}
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
                <label key={p.key} className="tap flex items-start gap-2 text-sm bg-gray-50 rounded-md p-2">
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
                <option key={r.id} value={r.id}>{r.name}{r.isAdmin ? " (tous accès)" : ""}</option>
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
                  <option key={r.id} value={r.id}>{r.name}{r.isAdmin ? " (tous accès)" : ""}</option>
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
  const [test, setTest] = useState<any>(null);
  const [testing, setTesting] = useState(false);

  async function runTest() {
    setTesting(true);
    setTest(null);
    try {
      const res = await fetch("/api/payments", { method: "POST" });
      setTest(await res.json());
    } catch {
      setTest({ ok: false, error: "Impossible de joindre le serveur." });
    } finally {
      setTesting(false);
    }
  }

  useEffect(() => {
    fetch("/api/payments")
      .then((r) => r.json())
      .then(setStatus)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-gray-500">Chargement…</p>;

  return (
    <div className="card p-4 space-y-3 max-w-lg">
      <Row label="Identifiant du client API (HELLOASSO_CLIENT_ID)" ok={status?.hasClientId} />
      <Row label="Secret du client API (HELLOASSO_CLIENT_SECRET)" ok={status?.hasClientSecret} />
      <Row label="Association (HELLOASSO_ORGANIZATION_SLUG)" ok={!!status?.organizationSlug} />
      {status?.organizationName && (
        <p className="text-sm text-gray-600">
          Compte HelloAsso : {status.organizationName}
          {status.sandbox && <span className="ml-2 text-amber-700 font-medium">(environnement de test)</span>}
        </p>
      )}
      {status?.error && <p className="text-sm text-red-600 break-words">{status.error}</p>}
      <p className="text-sm text-gray-600 break-all">Adresse de l&apos;appli (NEXT_PUBLIC_APP_URL) : {status?.appUrl || "manquante"}</p>
      <p className="text-sm text-gray-600 break-all">
        Serveur HelloAsso utilisé : {status?.apiHost}
        {status?.apiUrlVar === null ? " (HELLOASSO_API_URL absente : production par défaut)" : ` (HELLOASSO_API_URL = « ${status?.apiUrlVar} »)`}
      </p>
      <div className="pt-2 border-t space-y-2">
        <button type="button" className="btn-secondary" disabled={testing} onClick={runTest}>
          {testing ? "Test en cours…" : "Tester un paiement de 1 €"}
        </button>
        {test?.ok && (
          <p className="text-sm text-green-700 break-all">
            HelloAsso accepte les paiements. <a className="underline" href={test.redirectUrl} target="_blank" rel="noreferrer">Ouvrir la page de paiement test</a> (rien n&apos;est enregistré dans l&apos;appli).
          </p>
        )}
        {test && !test.ok && <p className="text-sm text-red-600 break-words">{test.error}</p>}
      </div>
      <div className="text-sm text-gray-500 pt-2 border-t">
        <p>URL de notification à déclarer dans HelloAsso (Mon compte &gt; Intégrations et API) :</p>
        <code className="text-xs bg-gray-100 rounded px-2 py-1 block mt-1 break-all">{status?.webhookUrl}</code>
        <p className="mt-1">Les reçus fiscaux des paiements en ligne sont émis par l&apos;appli : désactivez ceux de HelloAsso pour éviter un double reçu.</p>
      </div>
    </div>
  );
}

function Row({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="min-w-0 break-words">{label}</span>
      <span className={`shrink-0 ${ok ? "text-green-700 font-medium" : "text-red-600 font-medium"}`}>{ok ? "Configuré" : "Manquant"}</span>
    </div>
  );
}

const ASSOCIATION_FIELDS: { key: string; label: string; placeholder?: string; wide?: boolean }[] = [
  { key: "legalName", label: "Nom de l'association (dénomination légale)", wide: true },
  { key: "address", label: "Adresse du siège", wide: true },
  { key: "postalCode", label: "Code postal" },
  { key: "city", label: "Ville" },
  { key: "rna", label: "N° RNA", placeholder: "W931234567" },
  { key: "siren", label: "N° SIREN", placeholder: "123456789" },
  { key: "signatoryName", label: "Nom du signataire", placeholder: "ex : David Cohen" },
  { key: "signatoryTitle", label: "Qualité du signataire", placeholder: "ex : Président" },
];

function AssociationTab() {
  const [form, setForm] = useState<any>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/association")
      .then((r) => r.json())
      .then((d) => {
        setForm(d.association);
        setMissing(d.missing || []);
      });
  }, []);

  function onImage(key: "signatureImage" | "logoImage", file: File | undefined) {
    if (!file) return;
    if (file.size > 300_000) {
      setError("Image trop lourde (300 Ko maximum).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setForm((f: any) => ({ ...f, [key]: String(reader.result) }));
    reader.readAsDataURL(file);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/association", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setForm(data.association);
      setMissing(data.missing || []);
      setMessage("Fiche enregistrée.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!form) return <p className="text-sm text-gray-500">Chargement…</p>;

  return (
    <form onSubmit={save} className="space-y-4 max-w-2xl">
      <div className={`card p-4 text-sm ${missing.length ? "border-amber-300 bg-amber-50" : "border-green-300 bg-green-50"}`}>
        {missing.length ? (
          <>
            <p className="font-medium text-amber-800">Reçus fiscaux inactifs : la fiche est incomplète.</p>
            <p className="text-amber-700 mt-1">À renseigner : {missing.join(", ")}.</p>
          </>
        ) : (
          <p className="font-medium text-green-800">
            Reçus fiscaux actifs. {form.autoReceipt ? "Un reçu part automatiquement à chaque paiement (si l'adresse du fidèle est connue)." : "Émission manuelle depuis la page Reçus fiscaux."}
          </p>
        )}
      </div>

      <div className="card p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {error && <p className="sm:col-span-2 text-sm text-red-600">{error}</p>}
        {message && <p className="sm:col-span-2 text-sm text-green-700">{message}</p>}
        {ASSOCIATION_FIELDS.map((f) => (
          <div key={f.key} className={f.wide ? "sm:col-span-2" : ""}>
            <label className="label">{f.label}</label>
            <input className="input" placeholder={f.placeholder} value={form[f.key] || ""} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
          </div>
        ))}
        <div className="sm:col-span-2">
          <label className="label">Objet de l'association (tel qu'inscrit dans les statuts)</label>
          <textarea className="input" rows={2} value={form.object || ""} onChange={(e) => setForm({ ...form, object: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Qualité de l'organisme (case cochée sur le reçu)</label>
          <select className="input" value={form.category || ""} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            <option value="">— Choisir —</option>
            {ASSOCIATION_CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>{c.label}</option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Association loi 1901 : en général « œuvre d'intérêt général ». Association cultuelle loi 1905 : « association cultuelle ». En cas de doute, demandez au comptable.
          </p>
        </div>
        {(
          [
            ["logoImage", "Logo de l'association (PNG ou JPEG, facultatif)"],
            ["signatureImage", "Signature du signataire (PNG ou JPEG sur fond blanc, facultative)"],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="sm:col-span-2">
            <label className="label">{label}</label>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <input type="file" accept="image/png,image/jpeg" onChange={(e) => onImage(key, e.target.files?.[0])} className="tap text-sm" />
              {form[key] && (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={form[key]} alt={label} className="h-12 border rounded bg-white" />
                  <button type="button" className="text-xs text-red-600 hover:underline tap" onClick={() => setForm({ ...form, [key]: "" })}>
                    Retirer
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
        <label className="sm:col-span-2 tap flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-1" checked={!!form.autoReceipt} onChange={(e) => setForm({ ...form, autoReceipt: e.target.checked })} />
          <span>Envoyer automatiquement un reçu fiscal à chaque paiement. Décochez pour n'émettre qu'un reçu récapitulatif annuel.</span>
        </label>
        <div className="sm:col-span-2">
          <button type="submit" disabled={saving} className="btn-gold">
            {saving ? "Enregistrement…" : "Enregistrer la fiche"}
          </button>
        </div>
      </div>
    </form>
  );
}

function RemindersTab() {
  const [data, setData] = useState<any>(null);
  const [form, setForm] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    const res = await fetch("/api/reminders/auto");
    const d = await res.json();
    setData(d);
    setForm(d.settings);
  }

  useEffect(() => {
    load();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const res = await fetch("/api/reminders/auto", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const d = await res.json();
    setMessage(res.ok ? "Réglages enregistrés." : d.error);
    setBusy(false);
    await load();
  }

  async function runNow() {
    if (!confirm(`Envoyer maintenant ${data.plan.length} relevé(s) ?`)) return;
    setBusy(true);
    setMessage("");
    const res = await fetch("/api/reminders/auto", { method: "POST" });
    const d = await res.json();
    if (!res.ok) setMessage(d.error);
    else if (d.skipped) setMessage(`Aucun envoi (${d.skipped}).`);
    else setMessage(`${d.sent} relevé(s) envoyé(s)${d.failed.length ? `, ${d.failed.length} en échec` : ""}.`);
    setBusy(false);
    await load();
  }

  if (!data || !form) return <p className="text-sm text-gray-500">Chargement…</p>;

  return (
    <div className="space-y-4 max-w-2xl">
      <form onSubmit={save} className="card p-4 space-y-3">
        <p className="text-sm text-gray-600">
          Chaque matin (10 h en été, 9 h en hiver, heure de Paris), les fidèles qui ont des promesses à relancer reçoivent un relevé unique de leur
          solde avec un lien de paiement. Pas d'envoi le Chabbat ni les jours de fête.
        </p>
        <label className="tap flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={!!form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} />
          Activer les relances automatiques
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="label">1re relance après (jours)</label>
            <input type="number" min="0" className="input" value={form.firstDelayDays} onChange={(e) => setForm({ ...form, firstDelayDays: e.target.value })} />
          </div>
          <div>
            <label className="label">Puis tous les (jours)</label>
            <input type="number" min="1" className="input" value={form.repeatEveryDays} onChange={(e) => setForm({ ...form, repeatEveryDays: e.target.value })} />
          </div>
          <div>
            <label className="label">Relances max par promesse</label>
            <input type="number" min="1" className="input" value={form.maxReminders} onChange={(e) => setForm({ ...form, maxReminders: e.target.value })} />
          </div>
        </div>
        {!data.cronConfigured && (
          <p className="text-xs text-amber-700">
            Variable CRON_SECRET absente dans Vercel : l'envoi quotidien ne tournera pas tant qu'elle n'est pas définie.
          </p>
        )}
        <button type="submit" disabled={busy} className="btn-primary">Enregistrer</button>
      </form>

      {message && <p className="text-sm text-gray-700">{message}</p>}

      <div className="card">
        <div className="p-4 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 className="font-semibold text-ink">Prochain envoi : {data.plan.length} fidèle(s)</h3>
            {data.restDay && <p className="text-xs text-amber-700">Aujourd'hui : {data.restDay}, aucun envoi.</p>}
          </div>
          <button className="btn-gold" disabled={busy || !data.plan.length || !!data.restDay} onClick={runNow}>
            Envoyer maintenant
          </button>
        </div>
        <div className="divide-y max-h-72 overflow-y-auto">
          {data.plan.map((p: any) => (
            <div key={p.donorId} className="p-3 px-4 flex items-center justify-between gap-3 text-sm">
              <span className="truncate">{p.donorName}</span>
              <span className="font-medium text-amber-700 shrink-0">
                {p.due.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
              </span>
            </div>
          ))}
          {data.plan.length === 0 && <p className="p-4 text-sm text-gray-500">Personne à relancer selon ces réglages.</p>}
        </div>
      </div>

      {data.runs.length > 0 && (
        <div className="card p-4 text-sm space-y-1">
          <h3 className="font-semibold text-ink mb-2">Derniers envois</h3>
          {data.runs.map((r: any, i: number) => (
            <p key={i} className="text-gray-600">
              {new Date(r.at).toLocaleString("fr-FR")} · {r.trigger === "cron" ? "automatique" : `manuel (${r.by})`} · {r.sent} envoyé(s)
              {r.failed?.length ? `, ${r.failed.length} en échec` : ""}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function LouahTab() {
  const [s, setS] = useState<any>(null);
  const [url, setUrl] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/louah")
      .then((r) => r.json())
      .then((d) => {
        setS(d.settings);
        setUrl(d.url);
      });
  }, []);

  async function save() {
    setSaving(true);
    setMessage("");
    const res = await fetch("/api/louah", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(s) });
    const d = await res.json();
    setMessage(res.ok ? "Enregistré. L'écran se met à jour dans les 5 minutes." : d.error);
    setSaving(false);
  }

  if (!s) return <p className="text-gray-500">Chargement…</p>;

  const setTime = (i: number, key: "label" | "value", v: string) =>
    setS({ ...s, times: s.times.map((t: any, j: number) => (j === i ? { ...t, [key]: v } : t)) });

  return (
    <div className="card p-4 space-y-4">
      <p className="text-sm text-gray-600">
        Ouvrez <a className="text-gold hover:underline break-all" href={url || "/louah"} target="_blank" rel="noreferrer">{url || "/louah"}</a> sur
        l'écran de la synagogue (double-clic pour le plein écran). Dates hébraïques, paracha, zmanim et allumage sont calculés automatiquement ;
        les offices saisis dans l'onglet Offices et les hazkarot de la semaine s'affichent aussi.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Titre affiché</label>
          <input className="input" value={s.title} onChange={(e) => setS({ ...s, title: e.target.value })} placeholder="ex : Synagogue de Bondy" />
        </div>
        <div>
          <label className="label">Ville (zmanim)</label>
          <input className="input" value={s.city} onChange={(e) => setS({ ...s, city: e.target.value })} />
        </div>
        <div>
          <label className="label">Latitude</label>
          <input type="number" step="0.0001" className="input" value={s.latitude} onChange={(e) => setS({ ...s, latitude: e.target.value })} />
        </div>
        <div>
          <label className="label">Longitude</label>
          <input type="number" step="0.0001" className="input" value={s.longitude} onChange={(e) => setS({ ...s, longitude: e.target.value })} />
        </div>
        <div>
          <label className="label">Allumage (minutes avant le coucher du soleil)</label>
          <input type="number" className="input" value={s.candleMinutes} onChange={(e) => setS({ ...s, candleMinutes: e.target.value })} />
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 text-sm">
        <label className="tap flex items-center gap-2">
          <input type="checkbox" checked={s.showZmanim} onChange={(e) => setS({ ...s, showZmanim: e.target.checked })} /> Afficher les zmanim
        </label>
        <label className="tap flex items-center gap-2">
          <input type="checkbox" checked={s.showHazkarot} onChange={(e) => setS({ ...s, showHazkarot: e.target.checked })} /> Afficher les hazkarot (nom du défunt et date)
        </label>
      </div>
      <div>
        <label className="label">Horaires des offices</label>
        <div className="space-y-2">
          {s.times.map((t: any, i: number) => (
            <div key={i} className="flex flex-col sm:flex-row gap-2">
              <input className="input" placeholder="ex : Cha'harit en semaine" value={t.label} onChange={(e) => setTime(i, "label", e.target.value)} />
              <input className="input sm:w-40" placeholder="ex : 7h00" value={t.value} onChange={(e) => setTime(i, "value", e.target.value)} />
              <button className="text-red-600 hover:underline text-sm shrink-0 text-left tap" onClick={() => setS({ ...s, times: s.times.filter((_: any, j: number) => j !== i) })}>
                Retirer
              </button>
            </div>
          ))}
          <button className="text-gold hover:underline text-sm tap" onClick={() => setS({ ...s, times: [...s.times, { label: "", value: "" }] })}>
            + Ajouter un horaire
          </button>
        </div>
      </div>
      <div>
        <label className="label">Annonces (une par ligne)</label>
        <textarea className="input" rows={4} value={s.announcements} onChange={(e) => setS({ ...s, announcements: e.target.value })} />
      </div>
      {message && <p className="text-sm text-gray-700">{message}</p>}
      <button className="btn-primary" disabled={saving} onClick={save}>{saving ? "Enregistrement…" : "Enregistrer"}</button>
    </div>
  );
}

const AUDIT_LABELS: Record<string, string> = {
  modification: "Modification",
  suppression: "Suppression",
  annulation: "Annulation",
  remplacement: "Remplacement",
  remise: "Remise",
  marquage_test: "Marquage test",
  remise_a_zero: "Remise à zéro (tests)",
};

function describeAudit(e: any): string {
  const b = e.before || {};
  const a = e.after || {};
  if (e.action === "suppression") return `${b.donorName} · ${formatEUR(b.amount)}`;
  if (e.action === "remise_a_zero") {
    const ext = (b.external || []).map((x: any) => `${x.number} ${x.why}`).join(", ");
    return `${(b.numbers || []).length} reçu(s) de test supprimé(s), compteur remis à 0${ext ? ` · sortis : ${ext}` : ""}`;
  }
  if (e.action === "marquage_test") return `${b.donorName} · ${formatEUR(b.amount)} · ${a.test ? "marqué test" : "marque test retirée"}`;
  if (e.action === "remplacement") {
    return `remplacé par n° ${a.number} (${a.donorName}, ${formatEUR(a.amount)})`;
  }
  if (e.action === "modification") {
    const parts: string[] = [];
    if (b.number !== a.number) parts.push(`numéro ${b.number} → ${a.number}`);
    if (b.donorId !== a.donorId) parts.push(`fidèle ${b.donorName} → ${a.donorName}`);
    if (b.amount !== a.amount) parts.push(`montant ${formatEUR(b.amount)} → ${formatEUR(a.amount)}`);
    if (String(b.issuedAt).slice(0, 10) !== String(a.issuedAt).slice(0, 10)) {
      parts.push(`date ${formatDate(b.issuedAt)} → ${formatDate(a.issuedAt)}`);
    }
    return parts.join(", ");
  }
  return b.donorName ? `${b.donorName} · ${formatEUR(b.amount)}` : "";
}

function ReceiptAuditTab() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    setLoading(true);
    setError("");
    fetch(`/api/receipts/audit?year=${year}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setEntries(d.entries || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [year, refresh]);

  return (
    <div className="space-y-6">
    <TestResetCard onChange={() => setRefresh((n) => n + 1)} />
    <div className="card">
      <div className="p-4 border-b flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="font-semibold text-ink">Journal des reçus fiscaux</h2>
          <p className="text-xs text-gray-500">Chaque modification, suppression, annulation, remplacement ou remise : qui, quand, avant/après et motif.</p>
        </div>
        <select className="input w-full sm:w-32" value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>
      <div className="divide-y">
        {loading && <p className="p-4 text-sm text-gray-500">Chargement…</p>}
        {error && <p className="p-4 text-sm text-red-600">{error}</p>}
        {!loading && !error && entries.length === 0 && <p className="p-4 text-sm text-gray-500">Aucune action enregistrée pour {year}.</p>}
        {entries.map((e) => (
          <div key={e.id} className="p-4 text-sm">
            <p className="font-medium text-ink">
              {AUDIT_LABELS[e.action] || e.action} · n° {e.number}
            </p>
            <p className="text-gray-600 break-words">{describeAudit(e)}</p>
            <p className="text-xs text-gray-500">
              {new Date(e.at).toLocaleString("fr-FR")} · {e.by}
              {e.reason ? ` · motif : ${e.reason}` : ""}
            </p>
          </div>
        ))}
      </div>
    </div>
    </div>
  );
}

const RESET_TEXT = "REMISE A ZERO";

// Reçus de test de l'année en cours : marquage un par un, puis remise à zéro
// de la numérotation si et seulement si tous les reçus sont des tests.
function TestResetCard({ onChange }: { onChange: () => void }) {
  const year = new Date().getFullYear();
  const [data, setData] = useState<{ counter: number; items: any[]; allTest: boolean } | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [externalNote, setExternalNote] = useState("");

  async function load() {
    setError("");
    try {
      const r = await fetch(`/api/receipts/reset?year=${year}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setData(d);
    } catch (e: any) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggle(item: any) {
    setBusy(item.id);
    setMessage("");
    try {
      const r = await fetch(`/api/receipts/${item.id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ test: !item.test }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      await load();
      onChange();
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setBusy(null);
    }
  }

  async function reset() {
    if (!data) return;
    const numbers = data.items.map((i) => i.number).join(", ");
    if (!confirm(`Supprimer définitivement les reçus ${numbers} et repartir du n° ${year}/00001 ? Cette action est irréversible.`)) return;
    setBusy("reset");
    setMessage("");
    try {
      const r = await fetch("/api/receipts/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, confirmText, externalNote }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setMessage(`Numérotation ${year} remise à zéro : ${d.deleted.length} reçu(s) de test supprimé(s). Le prochain reçu portera le n° ${year}/00001.`);
      setConfirmText("");
      setExternalNote("");
      await load();
      onChange();
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setBusy(null);
    }
  }

  const items = data?.items || [];
  const external = items.filter((i) => i.external);
  const confirmOk = confirmText.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/\s+/g, " ").trim() === RESET_TEXT;
  const canReset = !!data?.allTest && confirmOk && (external.length === 0 || externalNote.trim().length >= 15);

  return (
    <div className="card">
      <div className="p-4 border-b space-y-1">
        <h2 className="font-semibold text-ink">Reçus de test {year} et remise à zéro</h2>
        <p className="text-xs text-gray-500">
          Si les premiers reçus de {year} étaient des essais, cochez « Reçu de test » sur chacun, puis remettez la numérotation à zéro.
          C'est impossible dès qu'un seul reçu n'est pas marqué test : un vrai reçu ne doit jamais disparaître.
        </p>
      </div>
      {error && <p className="p-4 text-sm text-red-600">{error}</p>}
      {!data && !error && <p className="p-4 text-sm text-gray-500">Chargement…</p>}
      {data && items.length === 0 && (
        <p className="p-4 text-sm text-gray-500">Aucun reçu en {year}. Le prochain reçu portera le n° {year}/{String(data.counter + 1).padStart(5, "0")}.</p>
      )}
      {items.length > 0 && (
        <div className="divide-y">
          {items.map((i) => (
            <label key={i.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm tap cursor-pointer">
              <span className="min-w-0">
                <span className="font-medium text-ink">N° {i.number} · {i.donorName}</span>
                <span className="block text-gray-500 break-words">
                  {formatEUR(i.amount)} · {i.state === "brouillon" ? "brouillon" : i.state === "envoye" ? "envoyé" : "annulé"}
                  {i.donorEmail ? ` · ${i.donorEmail}` : ""}
                </span>
                {i.external && <span className="block text-xs text-amber-700">Sorti de l'association : {i.external}</span>}
              </span>
              <span className="flex items-center gap-2 shrink-0">
                <input type="checkbox" checked={i.test} disabled={!!busy} onChange={() => toggle(i)} />
                Reçu de test
              </span>
            </label>
          ))}
        </div>
      )}
      {items.length > 0 && (
        <div className="p-4 border-t space-y-3 text-sm">
          {!data!.allTest ? (
            <p className="text-gray-600">
              Remise à zéro bloquée : {items.filter((i) => !i.test).map((i) => i.number).join(", ")} non marqué(s) « test ».
            </p>
          ) : (
            <>
              <p className="text-gray-700">
                Les {items.length} reçu(s) ci-dessus seront supprimés définitivement, leurs paiements redeviendront « sans reçu » et le
                prochain reçu portera le n° {year}/00001. L'opération est inscrite au journal ci-dessous.
              </p>
              {external.length > 0 && (
                <label className="block">
                  <span className="text-xs text-amber-800">
                    {external.length} reçu(s) de test sont sortis de l'association. Expliquez par écrit pourquoi ils peuvent disparaître (ex.
                    « adresse de test, aucun vrai donateur ») :
                  </span>
                  <textarea className="input w-full" rows={2} value={externalNote} onChange={(e) => setExternalNote(e.target.value)} />
                </label>
              )}
              <label className="block">
                <span className="text-xs text-gray-500">Saisissez {RESET_TEXT} pour confirmer</span>
                <input className="input w-full" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
              </label>
              <button className="btn-secondary text-red-700" disabled={!!busy || !canReset} onClick={reset}>
                {busy === "reset" ? "Remise à zéro…" : "Réinitialiser la numérotation des tests"}
              </button>
            </>
          )}
        </div>
      )}
      {message && <p className="px-4 pb-4 text-sm text-gray-700">{message}</p>}
    </div>
  );
}
