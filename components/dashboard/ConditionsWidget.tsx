"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/context/UserContext";
import Card from "@/components/ui/Card";
import Link from "next/link";
import type { HealthCondition } from "@/lib/types";

export default function ConditionsWidget({ targetUserId }: { targetUserId?: string | null }) {
  const { user, isAdmin } = useUser();
  const [conditions, setConditions] = useState<HealthCondition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    async function load() {
      setLoading(true);
      const supabase = createClient();

      const uid = targetUserId || (isAdmin ? null : user!.id);

      let query = supabase
        .from("health_conditions")
        .select("id, name, condition_type, status, severity")
        .order("created_at", { ascending: false });

      if (uid) {
        query = query.eq("user_id", uid);
      }

      const { data } = await query;
      setConditions((data as HealthCondition[]) || []);
      setLoading(false);
    }

    load();
  }, [user, isAdmin, targetUserId]);

  if (loading) {
    return (
      <Card>
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-32 rounded bg-[var(--border)]" />
          <div className="h-8 w-16 rounded bg-[var(--border)]" />
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-3 rounded bg-[var(--border)]" />
            ))}
          </div>
        </div>
      </Card>
    );
  }

  const chronicActive = conditions.filter(
    (c) => c.condition_type === "chronic" && c.status !== "resolved"
  );
  const acuteActive = conditions.filter(
    (c) => c.condition_type === "acute" && c.status === "active"
  );
  const riskFactors = conditions.filter((c) => c.condition_type === "risk_factor");

  if (conditions.length === 0) {
    return (
      <Card>
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <div className="text-3xl mb-2">{"\u{1F3E5}"}</div>
          <p className="text-sm font-medium">Здоровье</p>
          <p className="text-xs text-[var(--muted)] mt-1 mb-3">
            Добавьте информацию о заболеваниях
          </p>
          <Link
            href="/conditions"
            className="px-4 py-2 rounded-lg text-xs font-medium bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
          >
            Добавить
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Здоровье</h3>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-[var(--background)] p-2">
            <p className="text-lg font-bold text-red-400">{chronicActive.length}</p>
            <p className="text-[10px] text-[var(--muted)]">Хронич.</p>
          </div>
          <div className="rounded-lg bg-[var(--background)] p-2">
            <p className="text-lg font-bold text-amber-400">{acuteActive.length}</p>
            <p className="text-[10px] text-[var(--muted)]">Острых</p>
          </div>
          <div className="rounded-lg bg-[var(--background)] p-2">
            <p className="text-lg font-bold text-blue-400">{riskFactors.length}</p>
            <p className="text-[10px] text-[var(--muted)]">Риски</p>
          </div>
        </div>

        {acuteActive.length > 0 && (
          <div className="space-y-1">
            {acuteActive.map((c) => (
              <div key={c.id} className="flex items-center gap-2 text-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" />
                <span className="truncate">{c.name}</span>
              </div>
            ))}
          </div>
        )}

        <Link
          href="/conditions"
          className="block text-center text-xs text-emerald-400 hover:text-emerald-300 transition-colors pt-1"
        >
          Подробнее
        </Link>
      </div>
    </Card>
  );
}
