"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/context/UserContext";
import Card from "@/components/ui/Card";
import Link from "next/link";
import { CATEGORIES, getHealthLevel, type SurveyCategory } from "@/lib/survey/questions";

interface LatestSurvey {
  id: string;
  total_score: number;
  category_scores: Record<SurveyCategory, number>;
  risk_areas: SurveyCategory[];
  completed_at: string;
}

export default function SurveyWidget({ targetUserId }: { targetUserId?: string | null }) {
  const { user, isAdmin } = useUser();
  const [survey, setSurvey] = useState<LatestSurvey | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    async function load() {
      setLoading(true);
      const supabase = createClient();

      const uid = targetUserId || (isAdmin ? null : user!.id);

      let query = supabase
        .from("health_surveys")
        .select("id, total_score, category_scores, risk_areas, completed_at")
        .order("completed_at", { ascending: false })
        .limit(1);

      if (uid) {
        query = query.eq("user_id", uid);
      }

      const { data, error } = await query;
      if (error) {
        console.error("[SurveyWidget] Error loading survey:", error.message, error.code);
      }
      setSurvey(data && data.length > 0 ? (data[0] as LatestSurvey) : null);
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
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-2 rounded bg-[var(--border)]" />
            ))}
          </div>
        </div>
      </Card>
    );
  }

  if (!survey) {
    return (
      <Card>
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <div className="text-3xl mb-2">📋</div>
          <p className="text-sm font-medium">Опросник самочувствия</p>
          <p className="text-xs text-[var(--muted)] mt-1 mb-3">
            Пройдите опрос для оценки состояния здоровья
          </p>
          <Link
            href="/survey"
            className="px-4 py-2 rounded-lg text-xs font-medium bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
          >
            Пройти опрос
          </Link>
        </div>
      </Card>
    );
  }

  const level = getHealthLevel(survey.total_score);
  const daysAgo = Math.floor(
    (Date.now() - new Date(survey.completed_at).getTime()) / (1000 * 60 * 60 * 24)
  );
  const daysLabel = daysAgo === 0 ? "сегодня" : daysAgo === 1 ? "вчера" : `${daysAgo} дн. назад`;

  return (
    <Card>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Самочувствие</h3>
          <span className="text-[10px] text-[var(--muted)]">{daysLabel}</span>
        </div>

        {/* Score */}
        <div className="flex items-baseline gap-2">
          <span className={`text-2xl font-bold ${level.color}`}>{survey.total_score}</span>
          <span className="text-xs text-[var(--muted)]">/100</span>
          <span className={`ml-auto text-xs font-medium ${level.color} ${level.bgColor} rounded-full px-2 py-0.5`}>
            {level.label}
          </span>
        </div>

        {/* Mini category bars */}
        <div className="space-y-1.5">
          {CATEGORIES.map((cat) => {
            const score = survey.category_scores[cat.id] || 0;
            const pct = Math.round((score / cat.maxScore) * 100);
            const barColor = pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500";

            return (
              <div key={cat.id} className="flex items-center gap-2">
                <span className="text-xs w-5 text-center">{cat.icon}</span>
                <div className="flex-1 h-1.5 rounded-full bg-[var(--border)] overflow-hidden">
                  <div
                    className={`h-full rounded-full ${barColor} transition-all`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-[10px] text-[var(--muted)] w-8 text-right">{pct}%</span>
              </div>
            );
          })}
        </div>

        {/* Risk areas */}
        {survey.risk_areas.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {survey.risk_areas.map((area) => {
              const cat = CATEGORIES.find((c) => c.id === area);
              return (
                <span key={area} className="text-[10px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">
                  {cat?.icon} {cat?.label}
                </span>
              );
            })}
          </div>
        )}

        <Link
          href="/survey"
          className="block text-center text-xs text-emerald-400 hover:text-emerald-300 transition-colors pt-1"
        >
          {daysAgo >= 7 ? "Пройти снова" : "Подробнее"}
        </Link>
      </div>
    </Card>
  );
}
