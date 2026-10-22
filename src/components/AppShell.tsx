"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";

const NAV = [
  { href: "/dashboard", label: "Tableau de bord", perm: null },
  { href: "/pledges", label: "Promesses de dons", perm: "saisir_promesses" as const },
  { href: "/payments", label: "Encaissements", perm: "gerer_paiements" as const },
  { href: "/receipts", label: "Reçus fiscaux", perm: "gerer_paiements" as const },
  { href: "/campaigns", label: "Campagnes de dons", perm: "gerer_paiements" as const },
  { href: "/donors", label: "Fidèles", perm: null },
  { href: "/services", label: "Offices", perm: null },
  { href: "/catalog", label: "Catalogue", perm: "gerer_catalogue" as const },
  { href: "/admin", label: "Administration", perm: "gerer_equipe" as const },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, can, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  // Referme le menu mobile à chaque navigation.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <p className="text-gray-500">Chargement…</p>
      </div>
    );
  }

  const title = process.env.NEXT_PUBLIC_SYNAGOGUE_NAME || "Gestion des dons";

  return (
    <div className="min-h-screen bg-cream md:flex">
      {/* En-tête mobile */}
      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between bg-ink text-white px-4 py-3 print:hidden">
        <span className="font-serif font-bold truncate">{title}</span>
        <button
          onClick={() => setMenuOpen(true)}
          aria-label="Ouvrir le menu"
          className="p-2 -mr-2 rounded hover:bg-white/10"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </header>

      {menuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/40" onClick={() => setMenuOpen(false)} aria-hidden />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-ink text-white flex flex-col shrink-0 transform transition-transform md:static md:translate-x-0 print:hidden ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-5 border-b border-white/10 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="font-serif text-lg font-bold truncate">{title}</h1>
            <p className="text-xs text-white/60 mt-1 truncate">{user.name}</p>
            {user.role && <p className="text-xs text-gold">{user.role.name}</p>}
          </div>
          <button onClick={() => setMenuOpen(false)} aria-label="Fermer le menu" className="md:hidden p-1 text-white/70 hover:text-white">
            ✕
          </button>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV.filter((item) => !item.perm || can(item.perm)).map((item) => {
            const active = pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-md px-3 py-2 text-sm transition-colors ${
                  active ? "bg-gold text-white" : "text-white/80 hover:bg-white/10"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-white/10">
          <button onClick={() => logout()} className="text-sm text-white/70 hover:text-white w-full text-left px-3 py-2">
            Déconnexion
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0 p-4 sm:p-6 md:p-8 print:p-0">{children}</main>
    </div>
  );
}
