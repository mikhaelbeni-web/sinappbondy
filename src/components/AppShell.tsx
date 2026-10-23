"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Banknote,
  CalendarDays,
  CalendarHeart,
  Droplets,
  FileCheck2,
  HandCoins,
  Home,
  IdCard,
  LayoutGrid,
  LogOut,
  Mail,
  Megaphone,
  Menu,
  PieChart,
  PlusCircle,
  Settings,
  Sofa,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import type { PermissionKey } from "@/lib/permissions";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  perm: PermissionKey | null;
  any?: readonly PermissionKey[];
}

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Tableau de bord", icon: Home, perm: null },
  { href: "/donors", label: "Fidèles", icon: Users, perm: null },
  { href: "/pledges", label: "Promesses de dons", icon: HandCoins, perm: "saisir_promesses" },
  { href: "/payments", label: "Encaissements", icon: Banknote, perm: "gerer_paiements" },
  { href: "/treasury", label: "Trésorerie", icon: PieChart, perm: "gerer_paiements" },
  { href: "/receipts", label: "Reçus fiscaux", icon: FileCheck2, perm: "gerer_paiements" },
  { href: "/memberships", label: "Cotisations", icon: IdCard, perm: "gerer_paiements" },
  { href: "/campaigns", label: "Campagnes de dons", icon: Megaphone, perm: "gerer_paiements" },
  { href: "/messages", label: "Messages", icon: Mail, perm: "envoyer_messages" },
  { href: "/services", label: "Offices", icon: CalendarDays, perm: null },
  { href: "/seating", label: "Places des fêtes", icon: Sofa, perm: "gerer_paiements" },
  { href: "/events", label: "Événements", icon: Wallet, perm: "gerer_paiements" },
  { href: "/hazkarot", label: "Hazkarot", icon: CalendarHeart, perm: null },
  { href: "/mikve-reservations", label: "Mikvé", icon: Droplets, perm: "gerer_offices" },
  { href: "/catalog", label: "Catalogue", icon: LayoutGrid, perm: "gerer_catalogue" },
];

const ADMIN_PERMS: PermissionKey[] = ["gerer_equipe", "gerer_postes", "gerer_paiements", "envoyer_relances", "gerer_offices"];

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
  const items = NAV.filter((item) => !item.perm || can(item.perm));
  const showAdmin = ADMIN_PERMS.some((p) => can(p));
  const initials = user.name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-cream md:flex md:p-3 md:gap-3">
      {/* En-tête mobile */}
      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between bg-gradient-to-r from-ink-dark to-ink text-white px-4 py-3 print:hidden">
        <span className="font-semibold truncate">{title}</span>
        <button onClick={() => setMenuOpen(true)} aria-label="Ouvrir le menu" className="p-2 -mr-2 rounded-lg hover:bg-white/10">
          <Menu size={22} />
        </button>
      </header>

      {menuOpen && <div className="md:hidden fixed inset-0 z-40 bg-black/40" onClick={() => setMenuOpen(false)} aria-hidden />}

      {/* Menu : rail d'icônes sur ordinateur, tiroir avec libellés sur mobile */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 md:w-[72px] bg-gradient-to-b from-ink-dark via-ink to-ink-dark text-white flex flex-col shrink-0 transform transition-transform md:sticky md:top-3 md:h-[calc(100vh-1.5rem)] md:translate-x-0 md:rounded-2xl print:hidden ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between md:justify-center gap-2 p-4 md:py-5">
          <Link href="/dashboard" className="flex items-center gap-3 min-w-0" title={title}>
            <span className="grid place-items-center w-10 h-10 rounded-xl bg-gold-sand/20 text-gold-sand font-bold shrink-0">
              {title.slice(0, 1).toUpperCase()}
            </span>
            <span className="md:hidden font-semibold truncate">{title}</span>
          </Link>
          <button onClick={() => setMenuOpen(false)} aria-label="Fermer le menu" className="md:hidden p-1 text-white/70 hover:text-white">
            <X size={20} />
          </button>
        </div>
        <nav className="flex-1 px-3 md:px-0 space-y-1 overflow-y-auto md:flex md:flex-col md:items-center">
          {items.map((item) => {
            const active = pathname?.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                aria-label={item.label}
                className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 md:p-0 md:w-11 md:h-11 md:justify-center text-sm transition-colors ${
                  active ? "bg-white/10 text-gold-sand" : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon size={19} strokeWidth={active ? 2.4 : 2} />
                <span className="md:hidden">{item.label}</span>
                {active && <span className="hidden md:block absolute -bottom-0.5 left-3 right-3 h-0.5 rounded-full bg-gold-sand" />}
                <span className="hidden md:group-hover:block absolute left-full ml-3 whitespace-nowrap rounded-lg bg-ink-dark px-2.5 py-1 text-xs text-white shadow-soft z-50">
                  {item.label}
                </span>
              </Link>
            );
          })}
          {showAdmin && (
            <Link
              href="/admin"
              className={`md:hidden flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${
                pathname?.startsWith("/admin") ? "bg-white/10 text-gold-sand" : "text-white/60 hover:text-white"
              }`}
            >
              <Settings size={19} /> Administration
            </Link>
          )}
        </nav>
        <div className="p-3 md:py-4 md:flex md:flex-col md:items-center gap-2 border-t border-white/10">
          <div className="flex items-center gap-3 px-3 py-2 md:p-0" title={`${user.name}${user.role ? ` · ${user.role.name}` : ""}`}>
            <span className="grid place-items-center w-9 h-9 rounded-full bg-white/10 text-xs font-semibold shrink-0">{initials}</span>
            <span className="md:hidden min-w-0">
              <span className="block text-sm truncate">{user.name}</span>
              {user.role && <span className="block text-xs text-gold-sand truncate">{user.role.name}</span>}
            </span>
          </div>
          <button onClick={() => logout()} className="md:hidden flex items-center gap-3 text-sm text-white/70 hover:text-white w-full px-3 py-2">
            <LogOut size={18} /> Déconnexion
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Barre d'actions, en haut à droite comme sur le modèle */}
        <div className="hidden md:flex items-center justify-end gap-2 px-6 pt-4 print:hidden">
          {pathname === "/dashboard" && can("saisir_promesses") && (
            <Link href="/pledges" className="btn-primary !py-1.5">
              <PlusCircle size={16} /> Nouvelle promesse
            </Link>
          )}
          {showAdmin && (
            <Link href="/admin" title="Administration" aria-label="Administration" className="p-2 rounded-full text-ink hover:bg-white">
              <Settings size={18} />
            </Link>
          )}
          <button onClick={() => logout()} title="Déconnexion" aria-label="Déconnexion" className="p-2 rounded-full text-ink hover:bg-white">
            <LogOut size={18} />
          </button>
        </div>
        <main className="flex-1 min-w-0 p-4 sm:p-6 md:pt-0 print:p-0">{children}</main>
      </div>
    </div>
  );
}
