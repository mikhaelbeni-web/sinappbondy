"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function Home() {
  const router = useRouter();
  const { user, loading, needsSetup } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (needsSetup) router.replace("/setup");
    else if (user) router.replace("/dashboard");
    else router.replace("/login");
  }, [loading, needsSetup, user, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream">
      <p className="text-gray-500">Chargement…</p>
    </div>
  );
}
