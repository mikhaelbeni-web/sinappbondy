import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";

// L'application est entièrement authentifiée (cookies de session) et
// dépend de variables d'environnement fournies au runtime : pas de
// pré-rendu statique.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Gestion des dons - Synagogue",
  description: "Suivi des promesses de dons et relances par la synagogue",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="font-sans antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
