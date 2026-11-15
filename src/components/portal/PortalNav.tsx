"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X, HeartHandshake, UserRound, LayoutDashboard } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { PORTAL_LINKS } from "@/lib/portal";



// Barre de navigation du portail : liens, « Faire un don », « Mon espace »,
// menu déroulant sur téléphone.
export default function PortalNav({ name, tagline }: { name: string; tagline: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { needsSetup, loading, user } = useAuth();
  const [open, setOpen] = useState(false);

  // Première installation : l'assistant de configuration reste prioritaire.
  useEffect(() => {
    if (!loading && needsSetup && pathname === "/") router.replace("/setup");
  }, [loading, needsSetup, pathname, router]);

  useEffect(() => setOpen(false), [pathname]);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-gray-100">
      <a href="#contenu" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 btn-primary">
        Aller au contenu
      </a>
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <Link href="/" className="min-w-0 tap">
          <span className="block font-bold text-ink leading-tight truncate">{name}</span>
          <span className="block text-xs text-gray-500 truncate">{tagline}</span>
        </Link>

        <nav aria-label="Navigation principale" className="hidden lg:flex items-center gap-1">
          {PORTAL_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={isActive(l.href) ? "page" : undefined}
              className={`tap px-3 py-2 rounded-full text-sm font-medium transition-colors ${
                isActive(l.href) ? "bg-cream text-ink" : "text-gray-600 hover:text-ink hover:bg-cream"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          {user && (
            <Link
              href="/dashboard"
              title="Tableau de bord de l'équipe"
              aria-label="Tableau de bord de l'équipe"
              className="tap inline-flex items-center justify-center w-9 h-9 rounded-full text-gray-500 hover:text-ink hover:bg-cream"
            >
              <LayoutDashboard className="w-4 h-4" aria-hidden />
            </Link>
          )}
          <span className="hidden sm:block">
            <Link href="/espace" className="btn-secondary">
              <UserRound className="w-4 h-4" aria-hidden /> Mon espace
            </Link>
          </span>
          <Link href="/don" className="btn-primary px-3 sm:px-5" aria-label="Faire un don">
            <HeartHandshake className="w-4 h-4" aria-hidden /> <span className="hidden min-[380px]:inline">Faire un don</span>
          </Link>
          <button
            type="button"
            className="lg:hidden tap inline-flex items-center justify-center rounded-full w-10 h-10 text-ink hover:bg-cream"
            aria-expanded={open}
            aria-controls="menu-portail"
            aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X className="w-5 h-5" aria-hidden /> : <Menu className="w-5 h-5" aria-hidden />}
          </button>
        </div>
      </div>

      {open && (
        <nav id="menu-portail" aria-label="Menu" className="lg:hidden border-t border-gray-100 bg-white">
          <ul className="max-w-6xl mx-auto px-4 py-3 space-y-1">
            {PORTAL_LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  aria-current={isActive(l.href) ? "page" : undefined}
                  className={`tap flex w-full px-3 py-2 rounded-xl text-base font-medium ${isActive(l.href) ? "bg-cream text-ink" : "text-gray-700"}`}
                >
                  {l.label}
                </Link>
              </li>
            ))}
            <li className="sm:hidden">
              <Link href="/espace" className="tap flex w-full px-3 py-2 rounded-xl text-base font-medium text-gray-700">
                Mon espace fidèle
              </Link>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
