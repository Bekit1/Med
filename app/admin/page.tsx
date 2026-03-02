"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/context/UserContext";
import { useToast } from "@/components/ui/Toast";
import ProtectedLayout from "@/components/layout/ProtectedLayout";
import Header from "@/components/layout/Header";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";

interface FamilyMemberRow {
  id: string;
  full_name: string;
  role: string;
  created_at: string;
  recordCount: number;
  lastActivity: string | null;
  worstStatus: "normal" | "warning" | "attention";
}

interface FamilyStats {
  totalMembers: number;
  totalRecords: number;
  warningCount: number;
  attentionCount: number;
}

const statusVariant: Record<string, "success" | "warning" | "danger"> = {
  normal: "success",
  warning: "warning",
  attention: "danger",
};

const statusLabels: Record<string, string> = {
  normal: "Норма",
  warning: "Внимание",
  attention: "Срочно",
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function AdminPage() {
  const { user } = useUser();
  const { toast } = useToast();
  const [members, setMembers] = useState<FamilyMemberRow[]>([]);
  const [stats, setStats] = useState<FamilyStats>({ totalMembers: 0, totalRecords: 0, warningCount: 0, attentionCount: 0 });
  const [loading, setLoading] = useState(true);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData() {
    setLoading(true);
    const supabase = createClient();

    // Load profiles
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, role, created_at")
      .order("full_name");

    // Load all records for stats
    const { data: records } = await supabase
      .from("medical_records")
      .select("user_id, status, updated_at");

    const allRecords = records || [];
    const allProfiles = profiles || [];

    // Build per-user stats
    const recordsByUser: Record<string, { count: number; lastActivity: string | null; statuses: string[] }> = {};
    for (const r of allRecords) {
      if (!recordsByUser[r.user_id]) {
        recordsByUser[r.user_id] = { count: 0, lastActivity: null, statuses: [] };
      }
      recordsByUser[r.user_id].count++;
      recordsByUser[r.user_id].statuses.push(r.status);
      if (!recordsByUser[r.user_id].lastActivity || r.updated_at > recordsByUser[r.user_id].lastActivity!) {
        recordsByUser[r.user_id].lastActivity = r.updated_at;
      }
    }

    const memberRows: FamilyMemberRow[] = allProfiles.map((p) => {
      const userStats = recordsByUser[p.id] || { count: 0, lastActivity: null, statuses: [] };
      let worstStatus: "normal" | "warning" | "attention" = "normal";
      if (userStats.statuses.includes("attention")) worstStatus = "attention";
      else if (userStats.statuses.includes("warning")) worstStatus = "warning";

      return {
        id: p.id,
        full_name: p.full_name || "Без имени",
        role: p.role,
        created_at: p.created_at,
        recordCount: userStats.count,
        lastActivity: userStats.lastActivity,
        worstStatus,
      };
    });

    setMembers(memberRows);
    setStats({
      totalMembers: allProfiles.length,
      totalRecords: allRecords.length,
      warningCount: allRecords.filter((r) => r.status === "warning").length,
      attentionCount: allRecords.filter((r) => r.status === "attention").length,
    });
    setLoading(false);
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setInviting(true);

    try {
      const res = await fetch("/api/admin/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), full_name: inviteName.trim() || null }),
      });

      const data = await res.json();

      if (res.ok) {
        toast(data.message || "Приглашение отправлено!", "success");
        setInviteEmail("");
        setInviteName("");
        loadData();
      } else {
        toast(data.error || "Ошибка отправки приглашения", "error");
      }
    } catch {
      toast("Не удалось отправить запрос", "error");
    } finally {
      setInviting(false);
    }
  }

  const statCards = [
    { label: "Членов семьи", value: stats.totalMembers, color: "text-[var(--foreground)]", bg: "bg-white/5" },
    { label: "Всего записей", value: stats.totalRecords, color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { label: "Требуют внимания", value: stats.warningCount, color: "text-amber-400", bg: "bg-amber-500/10" },
    { label: "Срочные", value: stats.attentionCount, color: "text-red-400", bg: "bg-red-500/10" },
  ];

  return (
    <ProtectedLayout requireAdmin>
      <Header title="Админ-панель" description="Управление семьёй и участниками" />
      <div className="space-y-6 p-6">
        {/* Statistics */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((c) => (
            <Card key={c.label}>
              {loading ? (
                <div className="animate-pulse">
                  <div className="h-4 w-24 rounded bg-[var(--border)]" />
                  <div className="mt-2 h-8 w-12 rounded bg-[var(--border)]" />
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${c.bg}`}>
                    <span className={`text-lg font-bold ${c.color}`}>{c.value}</span>
                  </div>
                  <p className="text-sm text-[var(--muted)]">{c.label}</p>
                </div>
              )}
            </Card>
          ))}
        </div>

        {/* Family members table */}
        <Card>
          <h2 className="mb-4 font-semibold">Члены семьи</h2>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse rounded-lg bg-[var(--background)] p-3">
                  <div className="h-4 w-1/2 rounded bg-[var(--border)]" />
                </div>
              ))}
            </div>
          ) : members.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Нет участников</p>
          ) : (
            <div className="space-y-2">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between rounded-lg bg-[var(--background)] p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 text-sm font-medium">
                      {member.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{member.full_name}</p>
                        {member.role === "admin" && (
                          <Badge variant="success">Админ</Badge>
                        )}
                      </div>
                      <p className="text-xs text-[var(--muted)]">
                        {member.recordCount} записей
                        {member.lastActivity && ` · Обновлено ${formatDate(member.lastActivity)}`}
                      </p>
                    </div>
                  </div>
                  <Badge variant={statusVariant[member.worstStatus]}>
                    {statusLabels[member.worstStatus]}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Invite form */}
        <Card>
          <h2 className="mb-4 font-semibold">Пригласить члена семьи</h2>
          <form onSubmit={handleInvite} className="space-y-3">
            <div>
              <label className="mb-1 block text-sm text-[var(--muted)]">Email</label>
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="email@example.com"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-[var(--muted)]">Имя (необязательно)</label>
              <input
                type="text"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                placeholder="Имя Фамилия"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={inviting}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
            >
              {inviting ? "Отправка..." : "Пригласить"}
            </button>
          </form>
        </Card>
      </div>
    </ProtectedLayout>
  );
}
