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

// Libellé du menu : toujours visible dans le tiroir mobile, visible sur
// ordinateur seulement quand le rail est survolé (ou parcouru au clavier).
const RAIL_LABEL = "md:hidden md:group-hover/rail:block md:group-focus-within/rail:block md:pr-2";

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
        <button onClick={() => setMenuOpen(true)} aria-label="Ouvrir le menu" className="grid place-items-center w-11 h-11 -mr-2 rounded-lg hover:bg-white/10">
          <Menu size={22} />
        </button>
      </header>

      {menuOpen && <div className="md:hidden fixed inset-0 z-40 bg-black/40" onClick={() => setMenuOpen(false)} aria-hidden />}

      {/* Menu : tiroir avec libellés sur mobile ; sur ordinateur, rail
          d'icônes qui s'élargit au survol pour afficher les libellés, par-dessus
          le contenu (l'emplacement de 72 px reste réservé dans la mise en page). */}
      <div className="contents md:block md:sticky md:top-3 md:h-[calc(100dvh-1.5rem)] md:w-[72px] md:shrink-0 md:z-50 print:hidden">
      <aside
        className={`group/rail fixed inset-y-0 left-0 z-50 w-64 bg-gradient-to-b from-ink-dark via-ink to-ink-dark text-white flex flex-col transform transition-transform md:absolute md:inset-y-0 md:left-0 md:w-auto md:min-w-[72px] md:translate-x-0 md:rounded-2xl md:shadow-none md:hover:shadow-soft md:focus-within:shadow-soft ${
          menuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between gap-2 p-4 md:py-5">
          <Link href="/dashboard" className="flex items-center gap-3 min-w-0 tap" title={title}>
            <span className="grid place-items-center w-10 h-10 rounded-xl bg-gold-sand/20 text-gold-sand font-bold shrink-0">
              {title.slice(0, 1).toUpperCase()}
            </span>
            <span className={`font-semibold truncate ${RAIL_LABEL}`}>{title}</span>
          </Link>
          <button onClick={() => setMenuOpen(false)} aria-label="Fermer le menu" className="md:hidden grid place-items-center w-11 h-11 shrink-0 -mr-2 text-white/70 hover:text-white">
            <X size={20} />
          </button>
        </div>
        <nav className="flex-1 px-3 md:px-[14px] space-y-1 overflow-y-auto no-scrollbar">
          {items.map((item) => {
            const active = pathname?.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.label}
                className={`relative flex items-center gap-3 rounded-xl px-3 py-3 md:h-11 md:py-0 md:px-[12.5px] text-sm transition-colors ${
                  active ? "bg-white/10 text-gold-sand" : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon size={19} strokeWidth={active ? 2.4 : 2} className="shrink-0" />
                <span className={`whitespace-nowrap ${RAIL_LABEL}`}>{item.label}</span>
                {active && <span className="hidden md:block absolute -bottom-0.5 left-3 right-3 h-0.5 rounded-full bg-gold-sand" />}
              </Link>
            );
          })}
          {showAdmin && (
            <Link
              href="/admin"
              className={`md:hidden flex items-center gap-3 rounded-xl px-3 py-3 text-sm ${
                pathname?.startsWith("/admin") ? "bg-white/10 text-gold-sand" : "text-white/60 hover:text-white"
              }`}
            >
              <Settings size={19} /> Administration
            </Link>
          )}
        </nav>
        <div className="p-3 md:px-[18px] md:py-4 border-t border-white/10">
          <div className="flex items-center gap-3 px-3 py-2 md:p-0" title={`${user.name}${user.role ? ` · ${user.role.name}` : ""}`}>
            <span className="grid place-items-center w-9 h-9 rounded-full bg-white/10 text-xs font-semibold shrink-0">{initials}</span>
            <span className={`min-w-0 ${RAIL_LABEL}`}>
              <span className="block text-sm truncate">{user.name}</span>
              {user.role && <span className="block text-xs text-gold-sand truncate">{user.role.name}</span>}
            </span>
          </div>
          <button onClick={() => logout()} className="md:hidden flex items-center gap-3 text-sm text-white/70 hover:text-white w-full px-3 py-3">
            <LogOut size={18} /> Déconnexion
          </button>
        </div>
      </aside>
      </div>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Barre d'actions, en haut à droite comme sur le modèle */}
        <div className="hidden md:flex items-center justify-end gap-2 px-6 pt-4 print:hidden">
          {pathname === "/dashboard" && can("saisir_promesses") && (
            <Link href="/pledges" className="btn-primary !py-1.5">
              <PlusCircle size={16} /> Nouvelle promesse
            </Link>
          )}
          {showAdmin && (
            <Link href="/admin" title="Administration" aria-label="Administration" className="tap justify-center p-2 rounded-full text-ink hover:bg-white">
              <Settings size={18} />
            </Link>
          )}
          <button onClick={() => logout()} title="Déconnexion" aria-label="Déconnexion" className="tap justify-center p-2 rounded-full text-ink hover:bg-white">
            <LogOut size={18} />
          </button>
        </div>
        <main className="flex-1 min-w-0 p-4 sm:p-6 md:pt-0 print:p-0">{children}</main>
      </div>
    </div>
  );
}
