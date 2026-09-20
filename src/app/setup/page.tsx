"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function SetupPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [form, setForm] = useState({ synagogueName: "", name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur lors de la configuration.");

      await login(form.email, form.password);
      router.replace("/dashboard");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-serif font-bold text-ink">Bienvenue</h1>
          <p className="text-sm text-gray-500 mt-1">
            Configurons votre application de gestion des dons. Vous serez le premier administrateur.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-700 text-sm rounded-md p-3 border border-red-200">{error}</div>
          )}
          <div>
            <label className="label">Nom de la synagogue</label>
            <input
              className="input"
              required
              value={form.synagogueName}
              onChange={(e) => setForm({ ...form, synagogueName: e.target.value })}
              placeholder="ex : Synagogue de Belleville"
            />
          </div>
          <div>
            <label className="label">Votre nom</label>
            <input
              className="input"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Votre e-mail</label>
            <input
              type="email"
              className="input"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Mot de passe (8 caractères min.)</label>
            <input
              type="password"
              className="input"
              required
              minLength={8}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <button type="submit" disabled={loading} className="btn-gold w-full">
            {loading ? "Création…" : "Créer mon compte administrateur"}
          </button>
        </form>
      </div>
    </div>
  );
}
