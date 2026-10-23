"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      router.replace("/dashboard");
    } catch (err: any) {
      setError(err.message || "Identifiants incorrects.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-cream md:grid md:grid-cols-2">
      <div className="bg-gradient-to-br from-ink-dark via-ink to-ink-light text-white rounded-b-[2rem] md:rounded-none px-8 pt-12 pb-16 md:p-16 flex flex-col justify-center">
        <h1 className="text-3xl md:text-4xl font-bold">{process.env.NEXT_PUBLIC_SYNAGOGUE_NAME || "Gestion des dons"}</h1>
        <p className="text-white/80 mt-2">Dons, promesses, reçus fiscaux et vie de la communauté.</p>
        <span className="block w-14 h-1 rounded-full bg-gold-sand mt-5" />
      </div>
      <div className="flex items-start md:items-center justify-center px-4 -mt-8 md:mt-0 pb-10">
      <div className="w-full max-w-sm">
        <p className="hidden md:block text-xl font-bold text-ink mb-4">Connexion de l'équipe</p>
        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-700 text-sm rounded-xl p-3 border border-red-200">{error}</div>
          )}
          <div>
            <label className="label">E-mail</label>
            <input
              type="email"
              required
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="label">Mot de passe</label>
            <input
              type="password"
              required
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Connexion…" : "Se connecter"}
          </button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-4">
          Vous êtes fidèle ? <a href="/espace" className="text-gold hover:underline">Accédez à votre espace</a> ·{" "}
          <a href="/don" className="text-gold hover:underline">Faire un don</a>
        </p>
      </div>
      </div>
    </div>
  );
}
