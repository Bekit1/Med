"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import ProtectedLayout from "@/components/layout/ProtectedLayout";
import Header from "@/components/layout/Header";
import RecordList from "@/components/records/RecordList";
import Button from "@/components/ui/Button";
import { useUser } from "@/lib/context/UserContext";
import { createClient } from "@/lib/supabase/client";
import type { RecordType, RecordStatus, Profile } from "@/lib/types";
import type { RecordWithCount } from "@/components/records/RecordCard";

const typeFilters: { value: string; label: string }[] = [
  { value: "all", label: "Все типы" },
  { value: "analysis", label: "Анализы" },
  { value: "visit", label: "Визиты" },
  { value: "prescription", label: "Рецепты" },
  { value: "note", label: "Заметки" },
  { value: "vaccination", label: "Прививки" },
];

const statusFilters: { value: string; label: string }[] = [
  { value: "all", label: "Все статусы" },
  { value: "normal", label: "Норма" },
  { value: "warning", label: "Внимание" },
  { value: "attention", label: "Требует действий" },
];

function RecordsContent() {
  const { user, isAdmin } = useUser();
  const router = useRouter();
  const supabase = createClient();

  const [records, setRecords] = useState<RecordWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");

  // Админ: профили для переключателя
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  // Debounce поиска
  useEffect(() => {
    const timer = setTimeout(() => setSearchDebounced(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Загрузка профилей для админа
  useEffect(() => {
    if (!isAdmin) return;
    async function loadProfiles() {
      const { data } = await supabase.from("profiles").select("*").order("full_name");
      if (data) setProfiles(data as Profile[]);
    }
    loadProfiles();
  }, [isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadRecords = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();

    if (typeFilter !== "all") params.set("type", typeFilter);
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (searchDebounced) params.set("search", searchDebounced);
    if (selectedUserId) params.set("user_id", selectedUserId);

    try {
      const res = await fetch(`/api/records?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setRecords(data.records || []);
      }
    } finally {
      setLoading(false);
    }
  }, [typeFilter, statusFilter, searchDebounced, selectedUserId]);

  useEffect(() => {
    if (user) loadRecords();
  }, [user, loadRecords]);

  return (
    <>
      <Header
        title="Медицинские записи"
        description="Все записи вашей семьи"
        actions={
          <Button onClick={() => router.push("/records/new")}>
            + Новая запись
          </Button>
        }
      />

      <div className="p-6 space-y-4">
        {/* Фильтры */}
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-3">
          {/* Поиск */}
          <div className="relative flex-1 min-w-0 sm:min-w-[200px]">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по названию, описанию..."
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] pl-10 pr-3 py-2 text-sm text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
            />
          </div>

          {/* Тип */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          >
            {typeFilters.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>

          {/* Статус */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          >
            {statusFilters.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>

          {/* Переключатель профилей (только для админа) */}
          {isAdmin && profiles.length > 0 && (
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            >
              <option value="">Мои записи</option>
              {profiles
                .filter((p) => p.id !== user?.id)
                .map((p) => (
                  <option key={p.id} value={p.id}>{p.full_name}</option>
                ))}
            </select>
          )}
        </div>

        {/* Список */}
        {loading ? (
          <div className="flex justify-center py-16">
            <svg className="h-8 w-8 animate-spin text-emerald-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : (
          <RecordList records={records} onRecordUpdated={loadRecords} />
        )}
      </div>
    </>
  );
}

export default function RecordsPage() {
  return (
    <ProtectedLayout>
      <RecordsContent />
    </ProtectedLayout>
  );
}
