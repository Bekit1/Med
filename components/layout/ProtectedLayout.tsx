"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { UserProvider, useUser } from "@/lib/context/UserContext";
import Sidebar from "./Sidebar";

const MAX_LOADING_MS = 5000;

function ProtectedContent({ children, requireAdmin }: { children: React.ReactNode; requireAdmin?: boolean }) {
  const { user, isAdmin, loading } = useUser();
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Safety net: if loading takes more than 5 seconds, force redirect to login
  useEffect(() => {
    if (loading) {
      timerRef.current = setTimeout(() => {
        window.location.href = "/login";
      }, MAX_LOADING_MS);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [loading]);

  // Not loading + no user → redirect to login immediately
  useEffect(() => {
    if (!loading && !user) {
      window.location.href = "/login";
    }
  }, [user, loading]);

  // Admin guard
  useEffect(() => {
    if (!loading && requireAdmin && !isAdmin) {
      router.replace("/dashboard");
    }
  }, [isAdmin, loading, requireAdmin, router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <svg className="h-8 w-8 animate-spin text-emerald-500" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm text-[var(--muted)]">Загрузка...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;
  if (requireAdmin && !isAdmin) return null;

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}

interface ProtectedLayoutProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export default function ProtectedLayout({ children, requireAdmin }: ProtectedLayoutProps) {
  return (
    <UserProvider>
      <ProtectedContent requireAdmin={requireAdmin}>{children}</ProtectedContent>
    </UserProvider>
  );
}
