"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/context/UserContext";
import Card from "@/components/ui/Card";

interface StatusCounts {
  total: number;
  normal: number;
  warning: number;
  attention: number;
}

export default function HealthSummary({ targetUserId }: { targetUserId?: string | null }) {
  const { user, isAdmin } = useUser();
  const [counts, setCounts] = useState<StatusCounts>({ total: 0, normal: 0, warning: 0, attention: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();

    async function load() {
      setLoading(true);

      let query = supabase.from("medical_records").select("status");
      if (targetUserId) {
        query = query.eq("user_id", targetUserId);
      } else if (!isAdmin) {
        query = query.eq("user_id", user!.id);
      }

      const { data } = await query;
      const records = data || [];

      setCounts({
        total: records.length,
        normal: records.filter((r) => r.status === "normal").length,
        warning: records.filter((r) => r.status === "warning").length,
        attention: records.filter((r) => r.status === "attention").length,
      });
      setLoading(false);
    }

    load();
  }, [user, isAdmin, targetUserId]);

  const cards = [
    { label: "Всего записей", value: counts.total, color: "text-[var(--foreground)]", bg: "bg-white/5" },
    { label: "В норме", value: counts.normal, color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { label: "Требуют внимания", value: counts.warning, color: "text-amber-400", bg: "bg-amber-500/10" },
    { label: "Срочные", value: counts.attention, color: "text-red-400", bg: "bg-red-500/10" },
  ];

  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <div className="animate-pulse">
              <div className="h-4 w-24 rounded bg-[var(--border)]" />
              <div className="mt-2 h-8 w-12 rounded bg-[var(--border)]" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.label}>
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${c.bg}`}>
              <span className={`text-lg font-bold ${c.color}`}>{c.value}</span>
            </div>
            <p className="text-sm text-[var(--muted)]">{c.label}</p>
          </div>
        </Card>
      ))}
    </div>
  );
}
