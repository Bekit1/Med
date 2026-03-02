"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/context/UserContext";
import Card from "@/components/ui/Card";

interface Insight {
  id: string;
  title: string;
  text: string;
  status: string;
}

export default function AiInsights({ targetUserId }: { targetUserId?: string | null }) {
  const { user, isAdmin } = useUser();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();

    async function load() {
      setLoading(true);

      let query = supabase
        .from("medical_records")
        .select("id, title, ai_recommendations, ai_analysis, status")
        .not("ai_recommendations", "is", null)
        .in("status", ["warning", "attention"])
        .order("updated_at", { ascending: false })
        .limit(10);

      if (targetUserId) {
        query = query.eq("user_id", targetUserId);
      } else if (!isAdmin) {
        query = query.eq("user_id", user!.id);
      }

      const { data } = await query;

      setInsights(
        (data || []).map((r) => ({
          id: r.id,
          title: r.title,
          text: r.ai_recommendations || r.ai_analysis || "",
          status: r.status,
        })),
      );
      setLoading(false);
    }

    load();
  }, [user, isAdmin, targetUserId]);

  const statusIcon = (status: string) => {
    if (status === "attention") {
      return (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-500/10">
          <svg className="h-4 w-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      );
    }
    return (
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-500/10">
        <svg className="h-4 w-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
    );
  };

  return (
    <Card>
      <h2 className="mb-4 font-semibold">AI-рекомендации</h2>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="animate-pulse rounded-lg bg-[var(--background)] p-3">
              <div className="h-4 w-1/2 rounded bg-[var(--border)]" />
              <div className="mt-2 h-3 w-full rounded bg-[var(--border)]" />
            </div>
          ))}
        </div>
      ) : insights.length === 0 ? (
        <div className="flex items-center gap-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10">
            <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm text-emerald-400">Всё в порядке! Нет срочных рекомендаций.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {insights.map((item) => (
            <div key={item.id} className="flex gap-3 rounded-lg bg-[var(--background)] p-3">
              {statusIcon(item.status)}
              <div className="min-w-0">
                <p className="text-sm font-medium">{item.title}</p>
                <p className="mt-0.5 text-xs text-[var(--muted)] line-clamp-2">{item.text}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
