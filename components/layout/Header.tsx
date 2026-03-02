"use client";

import { useEffect, useState } from "react";
import { useUser } from "@/lib/context/UserContext";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

interface HeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  /** Called when admin selects a different family member profile */
  onProfileChange?: (userId: string | null) => void;
  /** Currently selected profile for admin view */
  selectedUserId?: string | null;
}

export default function Header({ title, description, actions, onProfileChange, selectedUserId }: HeaderProps) {
  const { isAdmin } = useUser();
  const [familyMembers, setFamilyMembers] = useState<Profile[]>([]);

  useEffect(() => {
    if (!isAdmin || !onProfileChange) return;
    const supabase = createClient();
    supabase
      .from("profiles")
      .select("id, full_name, role")
      .order("full_name")
      .then(({ data }) => {
        if (data) setFamilyMembers(data as Profile[]);
      });
  }, [isAdmin, onProfileChange]);

  return (
    <header className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--card)] pl-14 md:pl-6 pr-4 md:pr-6 py-3 md:py-4">
      <div className="min-w-0">
        <h1 className="text-lg md:text-xl font-semibold truncate">{title}</h1>
        {description && (
          <p className="mt-0.5 text-sm text-[var(--muted)] hidden md:block">{description}</p>
        )}
      </div>
      <div className="flex items-center gap-2 md:gap-3">
        {/* Admin profile switcher */}
        {isAdmin && onProfileChange && familyMembers.length > 1 && (
          <select
            value={selectedUserId || ""}
            onChange={(e) => onProfileChange(e.target.value || null)}
            className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-2 md:px-3 py-1.5 text-xs md:text-sm text-[var(--foreground)]"
          >
            <option value="">Вся семья</option>
            {familyMembers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.full_name || "Без имени"}
              </option>
            ))}
          </select>
        )}

        {/* Notification bell (stub) */}
        <button className="relative rounded-lg p-2 text-[var(--muted)] hover:bg-white/5 hover:text-[var(--foreground)] transition-colors">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </button>

        {actions && <>{actions}</>}
      </div>
    </header>
  );
}
