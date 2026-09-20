"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";

const NAV = [
  { href: "/dashboard", label: "Tableau de bord", perm: null },
  { href: "/pledges", label: "Promesses de dons", perm: "saisir_promesses" as const },
  { href: "/donors", label: "Fidèles", perm: null },
  { href: "/services", label: "Offices", perm: null },
  { href: "/catalog", label: "Catalogue", perm: "gerer_catalogue" as const },
  { href: "/admin", label: "Administration", perm: "gerer_equipe" as const },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, can, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <p className="text-gray-500">Chargement…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream flex">
      <aside className="w-64 bg-ink text-white flex flex-col shrink-0">
        <div className="p-5 border-b border-white/10">
          <h1 className="font-serif text-lg font-bold">Gestion des dons</h1>
          <p className="text-xs text-white/60 mt-1">{user.name}</p>
          {user.role && <p className="text-xs text-gold">{user.role.name}</p>}
        </div>
        <nav className="flex-1 p-3 space-y-1">
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
      <main className="flex-1 min-w-0 p-6 md:p-8">{children}</main>
    </div>
  );
}
