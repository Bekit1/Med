"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/context/UserContext";
import Card from "@/components/ui/Card";

interface UpcomingItem {
  id: string;
  title: string;
  followUp: string;
  recordDate: string;
}

// Match dates in various Russian formats: "через 3 месяца", "01.06.2025", "июнь 2025" etc.
const DATE_PATTERNS = [
  /\d{1,2}[./]\d{1,2}[./]\d{2,4}/,
  /через\s+\d+\s+(дн|недел|месяц|год)/i,
  /повтор/i,
  /контроль/i,
  /повторн/i,
  /следующ/i,
];

function extractFollowUp(text: string | null): string | null {
  if (!text) return null;
  for (const pat of DATE_PATTERNS) {
    const match = text.match(pat);
    if (match) {
      // Return the sentence containing the match
      const idx = text.indexOf(match[0]);
      const start = text.lastIndexOf(".", idx - 1) + 1;
      const end = text.indexOf(".", idx + match[0].length);
      return text.slice(start, end > 0 ? end + 1 : undefined).trim();
    }
  }
  return null;
}

export default function UpcomingControls({ targetUserId }: { targetUserId?: string | null }) {
  const { user, isAdmin } = useUser();
  const [items, setItems] = useState<UpcomingItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();

    async function load() {
      setLoading(true);

      let query = supabase
        .from("medical_records")
        .select("id, title, record_date, ai_analysis, ai_recommendations")
        .not("ai_analysis", "is", null)
        .order("record_date", { ascending: false })
        .limit(50);

      if (targetUserId) {
        query = query.eq("user_id", targetUserId);
      } else if (!isAdmin) {
        query = query.eq("user_id", user!.id);
      }

      const { data } = await query;
      const found: UpcomingItem[] = [];

      for (const r of data || []) {
        const fromAnalysis = extractFollowUp(r.ai_analysis);
        const fromRecs = extractFollowUp(r.ai_recommendations);
        const followUp = fromRecs || fromAnalysis;
        if (followUp) {
          found.push({
            id: r.id,
            title: r.title,
            followUp,
            recordDate: r.record_date,
          });
        }
        if (found.length >= 5) break;
      }

      setItems(found);
      setLoading(false);
    }

    load();
  }, [user, isAdmin, targetUserId]);

  if (!loading && items.length === 0) return null;

  return (
    <Card>
      <h2 className="mb-4 font-semibold">Предстоящие контроли</h2>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="animate-pulse rounded-lg bg-[var(--background)] p-3">
              <div className="h-4 w-3/4 rounded bg-[var(--border)]" />
              <div className="mt-2 h-3 w-1/2 rounded bg-[var(--border)]" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex gap-3 rounded-lg bg-[var(--background)] p-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500/10">
                <svg className="h-4 w-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">{item.title}</p>
                <p className="mt-0.5 text-xs text-[var(--muted)]">{item.followUp}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
