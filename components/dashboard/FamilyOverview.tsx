"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";

interface FamilyMember {
  id: string;
  name: string;
  worstStatus: "normal" | "warning" | "attention";
  recordCount: number;
}

const statusLabels: Record<string, string> = {
  normal: "Норма",
  warning: "Внимание",
  attention: "Срочно",
};

const statusVariant: Record<string, "success" | "warning" | "danger"> = {
  normal: "success",
  warning: "warning",
  attention: "danger",
};

const statusDot: Record<string, string> = {
  normal: "bg-emerald-400",
  warning: "bg-amber-400",
  attention: "bg-red-400",
};

export default function FamilyOverview({ onSelectMember }: { onSelectMember?: (userId: string) => void }) {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      // Get all profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .order("full_name");

      if (!profiles) {
        setLoading(false);
        return;
      }

      // Get all records with their statuses
      const { data: records } = await supabase
        .from("medical_records")
        .select("user_id, status");

      const recordsByUser: Record<string, string[]> = {};
      for (const r of records || []) {
        if (!recordsByUser[r.user_id]) recordsByUser[r.user_id] = [];
        recordsByUser[r.user_id].push(r.status);
      }

      const result: FamilyMember[] = profiles.map((p) => {
        const statuses = recordsByUser[p.id] || [];
        let worstStatus: "normal" | "warning" | "attention" = "normal";
        if (statuses.includes("attention")) worstStatus = "attention";
        else if (statuses.includes("warning")) worstStatus = "warning";

        return {
          id: p.id,
          name: p.full_name || "Без имени",
          worstStatus,
          recordCount: statuses.length,
        };
      });

      setMembers(result);
      setLoading(false);
    }

    load();
  }, []);

  if (!loading && members.length === 0) return null;

  return (
    <Card>
      <h2 className="mb-4 font-semibold">Обзор семьи</h2>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="animate-pulse rounded-lg bg-[var(--background)] p-3">
              <div className="h-4 w-1/2 rounded bg-[var(--border)]" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {members.map((m) => (
            <button
              key={m.id}
              onClick={() => onSelectMember?.(m.id)}
              className="flex w-full items-center justify-between rounded-lg bg-[var(--background)] p-3 hover:bg-white/5 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium">
                  {m.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${statusDot[m.worstStatus]}`} />
                    <p className="text-sm font-medium">{m.name}</p>
                  </div>
                  <p className="text-xs text-[var(--muted)]">{m.recordCount} записей</p>
                </div>
              </div>
              <Badge variant={statusVariant[m.worstStatus]}>
                {statusLabels[m.worstStatus]}
              </Badge>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}
