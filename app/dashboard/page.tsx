"use client";

import { useState } from "react";
import { useUser } from "@/lib/context/UserContext";
import ProtectedLayout from "@/components/layout/ProtectedLayout";
import Header from "@/components/layout/Header";
import HealthSummary from "@/components/dashboard/HealthSummary";
import KeyMetrics from "@/components/dashboard/KeyMetrics";
import RecentRecords from "@/components/dashboard/RecentRecords";
import AiInsights from "@/components/dashboard/AiInsights";
import MetricsChart from "@/components/dashboard/MetricsChart";
import UpcomingControls from "@/components/dashboard/UpcomingControls";
import FamilyOverview from "@/components/dashboard/FamilyOverview";

function formatDate(date: Date): string {
  return date.toLocaleDateString("ru-RU", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function DashboardPage() {
  const { profile, isAdmin } = useUser();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const firstName = profile?.full_name?.split(" ")[0] || "пользователь";

  return (
    <ProtectedLayout>
      <Header
        title="Дашборд"
        description="Обзор здоровья вашей семьи"
        onProfileChange={isAdmin ? setSelectedUserId : undefined}
        selectedUserId={selectedUserId}
      />
      <div className="space-y-6 p-6">
        {/* Greeting */}
        <div>
          <h2 className="text-lg font-semibold">
            Здравствуйте, {firstName}!
          </h2>
          <p className="text-sm text-[var(--muted)]">{formatDate(new Date())}</p>
        </div>

        {/* 4 Status cards */}
        <HealthSummary targetUserId={selectedUserId} />

        {/* Key health metrics */}
        <KeyMetrics targetUserId={selectedUserId} />

        {/* AI recommendations + Recent records */}
        <div className="grid gap-6 lg:grid-cols-2">
          <AiInsights targetUserId={selectedUserId} />
          <RecentRecords targetUserId={selectedUserId} />
        </div>

        {/* Metrics chart + Upcoming controls */}
        <div className="grid gap-6 lg:grid-cols-2">
          <MetricsChart targetUserId={selectedUserId} />
          <UpcomingControls targetUserId={selectedUserId} />
        </div>

        {/* Admin-only: Family overview */}
        {isAdmin && !selectedUserId && (
          <FamilyOverview onSelectMember={setSelectedUserId} />
        )}
      </div>
    </ProtectedLayout>
  );
}
