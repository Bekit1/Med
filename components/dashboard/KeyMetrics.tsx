"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/context/UserContext";
import Card from "@/components/ui/Card";

// Clinically important metrics in priority order
const PRIORITY_METRICS = [
  "гемоглобин",
  "глюкоза",
  "холестерин общий",
  "холестерин",
  "лпнп",
  "лпвп",
  "тромбоциты",
  "лейкоциты",
  "соэ",
  "креатинин",
  "алт",
  "аст",
  "витамин d",
  "ттг",
  "железо",
  "ферритин",
];

const MAX_METRICS = 12;

interface MetricRow {
  id: string;
  metric_name: string;
  metric_value: number;
  unit: string | null;
  reference_min: number | null;
  reference_max: number | null;
  status: "normal" | "low" | "high";
  measured_at: string;
}

interface DisplayMetric {
  name: string;
  value: number;
  unit: string;
  refMin: number | null;
  refMax: number | null;
  status: "normal" | "low" | "high";
  date: string;
  severity: "normal" | "mild" | "moderate" | "severe";
  prevValue: number | null;
  prevDate: string | null;
}

function classifySeverity(
  value: number,
  refMin: number | null,
  refMax: number | null,
): "normal" | "mild" | "moderate" | "severe" {
  if (refMin === null && refMax === null) return "normal";

  let deviationPct = 0;

  if (refMin !== null && value < refMin && refMin !== 0) {
    deviationPct = ((refMin - value) / refMin) * 100;
  } else if (refMax !== null && value > refMax && refMax !== 0) {
    deviationPct = ((value - refMax) / refMax) * 100;
  } else {
    return "normal";
  }

  if (deviationPct <= 10) return "mild";
  if (deviationPct <= 25) return "moderate";
  return "severe";
}

const severityColors: Record<string, { text: string; bg: string; bar: string }> = {
  normal: { text: "text-emerald-400", bg: "bg-emerald-500/10", bar: "bg-emerald-500" },
  mild: { text: "text-amber-400", bg: "bg-amber-500/10", bar: "bg-amber-500" },
  moderate: { text: "text-orange-400", bg: "bg-orange-500/10", bar: "bg-orange-500" },
  severe: { text: "text-red-400", bg: "bg-red-500/10", bar: "bg-red-500" },
};

function computeBarPosition(
  value: number,
  refMin: number | null,
  refMax: number | null,
): number {
  if (refMin === null || refMax === null) return 50;
  if (refMax === refMin) return 50;

  // The bar shows the normal range in the middle 60% (20%-80%)
  // Values outside the range extend to 0% or 100%
  const rangeSize = refMax - refMin;
  const padding = rangeSize * 0.35;
  const scaleMin = refMin - padding;
  const scaleMax = refMax + padding;

  const clamped = Math.max(scaleMin, Math.min(scaleMax, value));
  return ((clamped - scaleMin) / (scaleMax - scaleMin)) * 100;
}

function computeRefBarBounds(
  refMin: number | null,
  refMax: number | null,
): { left: number; width: number } | null {
  if (refMin === null || refMax === null) return null;
  if (refMax === refMin) return null;

  const rangeSize = refMax - refMin;
  const padding = rangeSize * 0.35;
  const scaleMin = refMin - padding;
  const scaleMax = refMax + padding;
  const total = scaleMax - scaleMin;

  const left = ((refMin - scaleMin) / total) * 100;
  const right = ((refMax - scaleMin) / total) * 100;
  return { left, width: right - left };
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function trendInfo(current: number, prev: number | null): { icon: string; pct: string; dir: "up" | "down" | "same" } | null {
  if (prev === null || prev === 0) return null;
  const pct = ((current - prev) / Math.abs(prev)) * 100;
  if (Math.abs(pct) < 0.5) return { icon: "→", pct: "0%", dir: "same" };
  if (pct > 0) return { icon: "↑", pct: `+${pct.toFixed(1)}%`, dir: "up" };
  return { icon: "↓", pct: `${pct.toFixed(1)}%`, dir: "down" };
}

export default function KeyMetrics({ targetUserId }: { targetUserId?: string | null }) {
  const { user, isAdmin } = useUser();
  const [metrics, setMetrics] = useState<DisplayMetric[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    async function load() {
      setLoading(true);
      const supabase = createClient();

      const uid = targetUserId || (isAdmin ? null : user!.id);

      // Fetch all metrics for the user, ordered by date desc
      let query = supabase
        .from("health_metrics")
        .select("id, metric_name, metric_value, unit, reference_min, reference_max, status, measured_at")
        .order("measured_at", { ascending: false })
        .limit(500);

      if (uid) {
        query = query.eq("user_id", uid);
      }

      const { data } = await query;
      const rows = (data as MetricRow[]) || [];

      if (rows.length === 0) {
        setMetrics([]);
        setLoading(false);
        return;
      }

      // Group by metric_name — latest value + previous value
      const grouped = new Map<string, { latest: MetricRow; prev: MetricRow | null }>();
      for (const row of rows) {
        const key = row.metric_name.toLowerCase();
        const existing = grouped.get(key);
        if (!existing) {
          grouped.set(key, { latest: row, prev: null });
        } else if (!existing.prev) {
          existing.prev = row;
        }
        // Only need 2 most recent per metric
      }

      // Separate abnormal vs normal
      const abnormal: DisplayMetric[] = [];
      const normal: DisplayMetric[] = [];

      for (const [, { latest, prev }] of Array.from(grouped)) {
        const severity = classifySeverity(latest.metric_value, latest.reference_min, latest.reference_max);
        const dm: DisplayMetric = {
          name: latest.metric_name,
          value: latest.metric_value,
          unit: latest.unit || "",
          refMin: latest.reference_min,
          refMax: latest.reference_max,
          status: latest.status,
          date: latest.measured_at,
          severity,
          prevValue: prev ? prev.metric_value : null,
          prevDate: prev ? prev.measured_at : null,
        };

        if (latest.status === "high" || latest.status === "low") {
          abnormal.push(dm);
        } else {
          normal.push(dm);
        }
      }

      // Sort normal ones by clinical priority
      normal.sort((a, b) => {
        const aIdx = PRIORITY_METRICS.indexOf(a.name.toLowerCase());
        const bIdx = PRIORITY_METRICS.indexOf(b.name.toLowerCase());
        const aPrio = aIdx === -1 ? 999 : aIdx;
        const bPrio = bIdx === -1 ? 999 : bIdx;
        return aPrio - bPrio;
      });

      // Sort abnormal by severity (severe first)
      const sevOrder = { severe: 0, moderate: 1, mild: 2, normal: 3 };
      abnormal.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity]);

      const result = [...abnormal, ...normal].slice(0, MAX_METRICS);
      setMetrics(result);
      setLoading(false);
    }

    load();
  }, [user, isAdmin, targetUserId]);

  if (loading) {
    return (
      <div>
        <div className="mb-4">
          <h2 className="font-semibold">Ключевые показатели</h2>
          <p className="text-xs text-[var(--muted)]">На основе последних анализов</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <div className="animate-pulse space-y-2">
                <div className="h-3 w-24 rounded bg-[var(--border)]" />
                <div className="h-6 w-16 rounded bg-[var(--border)]" />
                <div className="h-2 w-full rounded bg-[var(--border)]" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (metrics.length === 0) {
    return (
      <Card>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <svg className="h-10 w-10 text-[var(--muted)] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-sm text-[var(--foreground)]">Нет данных о показателях</p>
          <p className="text-xs text-[var(--muted)] mt-1">
            Загрузите результаты анализов для отслеживания показателей
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <h2 className="font-semibold">Ключевые показатели</h2>
        <p className="text-xs text-[var(--muted)]">На основе последних анализов</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((m) => (
          <MetricCard key={m.name} metric={m} />
        ))}
      </div>
    </div>
  );
}

function MetricCard({ metric }: { metric: DisplayMetric }) {
  const colors = severityColors[metric.severity];
  const trend = trendInfo(metric.value, metric.prevValue);
  const barPos = computeBarPosition(metric.value, metric.refMin, metric.refMax);
  const refBounds = computeRefBarBounds(metric.refMin, metric.refMax);

  return (
    <Card>
      <div className="space-y-2.5">
        {/* Header: name + date */}
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium leading-tight">{metric.name}</p>
          <span className="shrink-0 text-[10px] text-[var(--muted)]">{formatDate(metric.date)}</span>
        </div>

        {/* Value + unit + trend */}
        <div className="flex items-baseline gap-2">
          <span className={`text-xl font-bold ${colors.text}`}>
            {Number.isInteger(metric.value) ? metric.value : metric.value.toFixed(1)}
          </span>
          {metric.unit && (
            <span className="text-xs text-[var(--muted)]">{metric.unit}</span>
          )}
          {trend && (
            <span
              className={`ml-auto text-xs font-medium ${
                trend.dir === "up"
                  ? "text-red-400"
                  : trend.dir === "down"
                    ? "text-blue-400"
                    : "text-[var(--muted)]"
              }`}
            >
              {trend.icon} {trend.pct}
            </span>
          )}
        </div>

        {/* Reference range bar */}
        <div className="relative h-2 rounded-full bg-[var(--border)] overflow-hidden">
          {/* Normal range background */}
          {refBounds && (
            <div
              className="absolute top-0 h-full rounded-full bg-emerald-500/20"
              style={{ left: `${refBounds.left}%`, width: `${refBounds.width}%` }}
            />
          )}
          {/* Value indicator */}
          <div
            className={`absolute top-0 h-full w-2.5 rounded-full ${colors.bar} transition-all`}
            style={{ left: `calc(${barPos}% - 5px)` }}
          />
        </div>

        {/* Reference range text */}
        {(metric.refMin !== null || metric.refMax !== null) && (
          <div className="flex justify-between text-[10px] text-[var(--muted)]">
            <span>{metric.refMin !== null ? `мин: ${metric.refMin}` : ""}</span>
            <span>{metric.refMax !== null ? `макс: ${metric.refMax}` : ""}</span>
          </div>
        )}
      </div>
    </Card>
  );
}
