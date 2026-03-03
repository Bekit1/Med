"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/context/UserContext";
import Card from "@/components/ui/Card";
import Link from "next/link";
import type { Medication } from "@/lib/types";

const TYPE_ICONS: Record<string, string> = {
  medication: "\u{1F48A}",
  vitamin: "\u{1F7E1}",
  supplement: "\u{1F9EA}",
  other: "\u{1F4CB}",
};

export default function MedicationsWidget({ targetUserId }: { targetUserId?: string | null }) {
  const { user, isAdmin } = useUser();
  const [meds, setMeds] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    async function load() {
      setLoading(true);
      const supabase = createClient();

      const uid = targetUserId || (isAdmin ? null : user!.id);

      let query = supabase
        .from("medications")
        .select("id, name, type, dosage, frequency")
        .eq("is_active", true)
        .order("name");

      if (uid) {
        query = query.eq("user_id", uid);
      }

      const { data } = await query;
      setMeds((data as Medication[]) || []);
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

  if (meds.length === 0) {
    return (
      <Card>
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <div className="text-3xl mb-2">{"\u{1F48A}"}</div>
          <p className="text-sm font-medium">Препараты</p>
          <p className="text-xs text-[var(--muted)] mt-1 mb-3">
            Добавьте принимаемые препараты и добавки
          </p>
          <Link
            href="/medications"
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
          <h3 className="text-sm font-medium">Препараты</h3>
          <span className="text-xs text-[var(--muted)]">{meds.length} активн.</span>
        </div>

        <div className="space-y-1.5">
          {meds.slice(0, 5).map((med) => (
            <div key={med.id} className="flex items-center gap-2">
              <span className="text-xs">{TYPE_ICONS[med.type] || "\u{1F48A}"}</span>
              <span className="text-sm truncate flex-1">{med.name}</span>
              {med.dosage && (
                <span className="text-[10px] text-[var(--muted)] shrink-0">{med.dosage}</span>
              )}
            </div>
          ))}
          {meds.length > 5 && (
            <p className="text-[10px] text-[var(--muted)]">+{meds.length - 5} ещё</p>
          )}
        </div>

        <Link
          href="/medications"
          className="block text-center text-xs text-emerald-400 hover:text-emerald-300 transition-colors pt-1"
        >
          Подробнее
        </Link>
      </div>
    </Card>
  );
}
