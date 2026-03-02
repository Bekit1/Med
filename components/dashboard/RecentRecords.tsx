"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/context/UserContext";
import type { MedicalRecord } from "@/lib/types";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";

const typeLabels: Record<string, string> = {
  analysis: "Анализы",
  visit: "Приём",
  prescription: "Рецепт",
  note: "Заметка",
  vaccination: "Вакцинация",
};

const statusColors: Record<string, "success" | "warning" | "danger"> = {
  normal: "success",
  warning: "warning",
  attention: "danger",
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function RecentRecords({ targetUserId }: { targetUserId?: string | null }) {
  const { user, isAdmin } = useUser();
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();

    async function load() {
      setLoading(true);

      let query = supabase
        .from("medical_records")
        .select("*")
        .order("record_date", { ascending: false })
        .limit(5);

      if (targetUserId) {
        query = query.eq("user_id", targetUserId);
      } else if (!isAdmin) {
        query = query.eq("user_id", user!.id);
      }

      const { data } = await query;
      setRecords((data as MedicalRecord[]) ?? []);
      setLoading(false);
    }

    load();
  }, [user, isAdmin, targetUserId]);

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">Последние записи</h2>
        <a href="/records" className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors">
          Все записи &rarr;
        </a>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse rounded-lg bg-[var(--background)] p-3">
              <div className="h-4 w-3/4 rounded bg-[var(--border)]" />
              <div className="mt-2 h-3 w-1/2 rounded bg-[var(--border)]" />
            </div>
          ))}
        </div>
      ) : records.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <p className="text-sm text-[var(--muted)]">Нет записей</p>
          <a href="/records/new" className="mt-2 text-sm text-emerald-400 hover:text-emerald-300 transition-colors">
            Добавить первую запись &rarr;
          </a>
        </div>
      ) : (
        <div className="space-y-2">
          {records.map((record) => (
            <div
              key={record.id}
              className="flex items-center justify-between rounded-lg bg-[var(--background)] p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${
                    record.status === "attention" ? "bg-red-400" :
                    record.status === "warning" ? "bg-amber-400" : "bg-emerald-400"
                  }`} />
                  <p className="truncate text-sm font-medium">{record.title}</p>
                </div>
                <p className="mt-0.5 text-xs text-[var(--muted)]">
                  {formatDate(record.record_date)}
                  {record.doctor_name && ` \u00B7 ${record.doctor_name}`}
                </p>
              </div>
              <Badge variant={statusColors[record.status] || "default"}>
                {typeLabels[record.record_type] ?? record.record_type}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
