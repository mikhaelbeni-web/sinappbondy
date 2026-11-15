"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

// Accès discret de l'équipe : tableau de bord si déjà connecté.
export default function StaffLink() {
  const { user } = useAuth();
  return (
    <Link href={user ? "/dashboard" : "/login"} className="tap hover:text-white">
      {user ? "Espace membre" : "Espace équipe"}
    </Link>
  );
}
