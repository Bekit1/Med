"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/context/UserContext";
import Card from "@/components/ui/Card";
import type { HealthMetric } from "@/lib/types";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface ChartPoint {
  date: string;
  [key: string]: string | number;
}

export default function MetricsChart({ targetUserId }: { targetUserId?: string | null }) {
  const { user, isAdmin } = useUser();
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [metricNames, setMetricNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();

    async function load() {
      setLoading(true);

      let query = supabase
        .from("health_metrics")
        .select("metric_name, metric_value, unit, measured_at")
        .order("measured_at", { ascending: true })
        .limit(200);

      if (targetUserId) {
        query = query.eq("user_id", targetUserId);
      } else if (!isAdmin) {
        query = query.eq("user_id", user!.id);
      }

      const { data } = await query;
      const metrics = (data as HealthMetric[]) || [];

      if (metrics.length === 0) {
        setChartData([]);
        setMetricNames([]);
        setLoading(false);
        return;
      }

      // Find the 2 most frequent metrics
      const freq: Record<string, number> = {};
      for (const m of metrics) {
        freq[m.metric_name] = (freq[m.metric_name] || 0) + 1;
      }
      const topNames = Object.entries(freq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([name]) => name);

      setMetricNames(topNames);

      // Group by date
      const byDate: Record<string, ChartPoint> = {};
      for (const m of metrics) {
        if (!topNames.includes(m.metric_name)) continue;
        const date = new Date(m.measured_at).toLocaleDateString("ru-RU", {
          day: "2-digit",
          month: "2-digit",
        });
        if (!byDate[date]) byDate[date] = { date };
        byDate[date][m.metric_name] = m.metric_value;
      }

      setChartData(Object.values(byDate));
      setLoading(false);
    }

    load();
  }, [user, isAdmin, targetUserId]);

  // Don't render the block at all if no data
  if (!loading && chartData.length === 0) return null;

  const colors = ["#10b981", "#3b82f6"];

  return (
    <Card>
      <h2 className="mb-4 font-semibold">Динамика показателей</h2>

      {loading ? (
        <div className="h-48 animate-pulse rounded-lg bg-[var(--background)]" />
      ) : (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis
                dataKey="date"
                tick={{ fill: "#94a3b8", fontSize: 12 }}
                axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
              />
              <YAxis
                tick={{ fill: "#94a3b8", fontSize: 12 }}
                axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                width={45}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1e293b",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
              />
              {metricNames.map((name, i) => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={colors[i]}
                  strokeWidth={2}
                  dot={{ r: 3, fill: colors[i] }}
                  name={name}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
