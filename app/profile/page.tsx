"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/context/UserContext";
import { useToast } from "@/components/ui/Toast";
import ProtectedLayout from "@/components/layout/ProtectedLayout";
import Header from "@/components/layout/Header";
import Card from "@/components/ui/Card";
import type { Profile, WeightHistoryEntry } from "@/lib/types";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

export default function ProfilePage() {
  return (
    <ProtectedLayout>
      <ProfileContent />
    </ProtectedLayout>
  );
}

// BMI helpers
function computeBMI(weightKg: number, heightCm: number): number {
  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
}

function getBMICategory(bmi: number): { label: string; color: string; bgColor: string } {
  if (bmi < 18.5) return { label: "Недостаток веса", color: "text-blue-400", bgColor: "bg-blue-500/10" };
  if (bmi < 25) return { label: "Норма", color: "text-emerald-400", bgColor: "bg-emerald-500/10" };
  if (bmi < 30) return { label: "Избыточный вес", color: "text-amber-400", bgColor: "bg-amber-500/10" };
  return { label: "Ожирение", color: "text-red-400", bgColor: "bg-red-500/10" };
}

function ProfileContent() {
  const { user, isAdmin, refreshProfile } = useUser();
  const { toast } = useToast();
  const searchParams = useSearchParams();

  const viewingUserId = searchParams.get("user_id");
  const isReadOnly = !!(viewingUserId && viewingUserId !== user?.id);

  const [profileData, setProfileData] = useState<Profile | null>(null);
  const [weightHistory, setWeightHistory] = useState<WeightHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [fullName, setFullName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState("");
  const [bloodType, setBloodType] = useState("");
  const [allergies, setAllergies] = useState("");
  const [chronicConditions, setChronicConditions] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");

  const targetUserId = isReadOnly ? viewingUserId! : user?.id;

  const loadData = useCallback(async () => {
    if (!targetUserId) return;
    setLoading(true);
    const supabase = createClient();

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", targetUserId)
      .single();

    if (profile) {
      const p = profile as Profile;
      setProfileData(p);
      setFullName(p.full_name || "");
      setDateOfBirth(p.date_of_birth || "");
      setGender(p.gender || "");
      setBloodType(p.blood_type || "");
      setAllergies(p.allergies || "");
      setChronicConditions(p.chronic_conditions || "");
      setHeightCm(p.height_cm != null ? String(p.height_cm) : "");
      setWeightKg(p.weight_kg != null ? String(p.weight_kg) : "");
    }

    const { data: history } = await supabase
      .from("weight_history")
      .select("*")
      .eq("user_id", targetUserId)
      .order("recorded_at", { ascending: false })
      .limit(50);

    setWeightHistory((history as WeightHistoryEntry[]) || []);
    setLoading(false);
  }, [targetUserId]);

  useEffect(() => {
    if (user) loadData();
  }, [user, loadData]);

  async function handleSave() {
    if (!user || isReadOnly) return;
    setSaving(true);

    const supabase = createClient();
    const newWeight = weightKg ? parseFloat(weightKg) : null;
    const oldWeight = profileData?.weight_kg ?? null;

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim() || profileData?.full_name,
        date_of_birth: dateOfBirth || null,
        gender: gender || null,
        blood_type: bloodType || null,
        allergies: allergies || null,
        chronic_conditions: chronicConditions || null,
        height_cm: heightCm ? parseFloat(heightCm) : null,
        weight_kg: newWeight,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) {
      toast("Ошибка сохранения профиля", "error");
      setSaving(false);
      return;
    }

    // If weight changed, add to history
    if (newWeight != null && newWeight !== oldWeight) {
      await supabase.from("weight_history").insert({
        user_id: user.id,
        weight_kg: newWeight,
      });
    }

    toast("Профиль сохранён", "success");
    await refreshProfile();
    await loadData();
    setSaving(false);
  }

  // BMI calculation
  const currentWeight = weightKg ? parseFloat(weightKg) : null;
  const currentHeight = heightCm ? parseFloat(heightCm) : null;
  const bmi = currentWeight && currentHeight && currentHeight > 0
    ? computeBMI(currentWeight, currentHeight)
    : null;
  const bmiCategory = bmi ? getBMICategory(bmi) : null;

  // Chart data
  const chartData = [...weightHistory]
    .reverse()
    .map((entry) => ({
      date: new Date(entry.recorded_at).toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
      }),
      weight: entry.weight_kg,
    }));

  const displayName = profileData?.full_name || "Пользователь";
  const initial = displayName.charAt(0).toUpperCase();

  if (loading) {
    return (
      <>
        <Header
          title={isReadOnly ? "Профиль участника" : "Профиль"}
          description="Загрузка..."
        />
        <div className="p-6 space-y-6 max-w-3xl mx-auto">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <div className="animate-pulse space-y-3">
                <div className="h-4 w-1/3 rounded bg-[var(--border)]" />
                <div className="h-10 rounded bg-[var(--border)]" />
              </div>
            </Card>
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <Header
        title={isReadOnly ? `Профиль: ${displayName}` : "Профиль"}
        description={isReadOnly ? "Просмотр (только чтение)" : "Личные данные и показатели"}
      />
      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
        {/* Avatar + name */}
        <Card>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-2xl font-bold">
              {initial}
            </div>
            <div>
              <h2 className="text-lg font-semibold">{displayName}</h2>
              <p className="text-sm text-[var(--muted)]">
                {profileData?.role === "admin" ? "Администратор" : "Участник"}
              </p>
            </div>
          </div>
        </Card>

        {/* Personal data form */}
        <Card>
          <h3 className="font-semibold mb-4">Личные данные</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm text-[var(--muted)]">ФИО</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={isReadOnly}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-emerald-500 focus:outline-none disabled:opacity-60"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-[var(--muted)]">Дата рождения</label>
              <input
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                disabled={isReadOnly}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-emerald-500 focus:outline-none disabled:opacity-60"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-[var(--muted)]">Пол</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                disabled={isReadOnly}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-emerald-500 focus:outline-none disabled:opacity-60"
              >
                <option value="">Не указан</option>
                <option value="male">Мужской</option>
                <option value="female">Женский</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-[var(--muted)]">Группа крови</label>
              <select
                value={bloodType}
                onChange={(e) => setBloodType(e.target.value)}
                disabled={isReadOnly}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-emerald-500 focus:outline-none disabled:opacity-60"
              >
                <option value="">Не указана</option>
                <option value="I+">I (O) Rh+</option>
                <option value="I-">I (O) Rh−</option>
                <option value="II+">II (A) Rh+</option>
                <option value="II-">II (A) Rh−</option>
                <option value="III+">III (B) Rh+</option>
                <option value="III-">III (B) Rh−</option>
                <option value="IV+">IV (AB) Rh+</option>
                <option value="IV-">IV (AB) Rh−</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm text-[var(--muted)]">Рост (см)</label>
              <input
                type="number"
                min="50"
                max="250"
                step="1"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                disabled={isReadOnly}
                placeholder="170"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-emerald-500 focus:outline-none disabled:opacity-60"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-[var(--muted)]">Вес (кг)</label>
              <input
                type="number"
                min="20"
                max="300"
                step="0.1"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                disabled={isReadOnly}
                placeholder="70"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-emerald-500 focus:outline-none disabled:opacity-60"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm text-[var(--muted)]">Аллергии</label>
              <textarea
                value={allergies}
                onChange={(e) => setAllergies(e.target.value)}
                disabled={isReadOnly}
                rows={2}
                placeholder="Укажите известные аллергии"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-emerald-500 focus:outline-none disabled:opacity-60 resize-none"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm text-[var(--muted)]">Хронические заболевания</label>
              <textarea
                value={chronicConditions}
                onChange={(e) => setChronicConditions(e.target.value)}
                disabled={isReadOnly}
                rows={2}
                placeholder="Укажите хронические заболевания"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-emerald-500 focus:outline-none disabled:opacity-60 resize-none"
              />
            </div>
          </div>

          {!isReadOnly && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="mt-4 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
            >
              {saving ? "Сохранение..." : "Сохранить"}
            </button>
          )}
        </Card>

        {/* BMI card */}
        {bmi != null && bmiCategory && (
          <Card>
            <h3 className="font-semibold mb-3">Индекс массы тела (ИМТ)</h3>
            <div className="flex items-center gap-4">
              <div className={`flex h-16 w-16 items-center justify-center rounded-xl ${bmiCategory.bgColor}`}>
                <span className={`text-2xl font-bold ${bmiCategory.color}`}>
                  {bmi.toFixed(1)}
                </span>
              </div>
              <div>
                <p className={`text-sm font-medium ${bmiCategory.color}`}>{bmiCategory.label}</p>
                <p className="text-xs text-[var(--muted)] mt-0.5">
                  {currentHeight} см / {currentWeight} кг
                </p>
              </div>
            </div>
            {/* BMI scale bar */}
            <div className="mt-4">
              <div className="flex h-2 rounded-full overflow-hidden">
                <div className="flex-1 bg-blue-500/40" />
                <div className="flex-1 bg-emerald-500/40" />
                <div className="flex-1 bg-amber-500/40" />
                <div className="flex-1 bg-red-500/40" />
              </div>
              <div className="flex justify-between mt-1 text-[10px] text-[var(--muted)]">
                <span>&lt;18.5</span>
                <span>18.5–24.9</span>
                <span>25–29.9</span>
                <span>&ge;30</span>
              </div>
            </div>
          </Card>
        )}

        {/* Weight history chart */}
        {chartData.length >= 2 && (
          <Card>
            <h3 className="font-semibold mb-3">История веса</h3>
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
                    domain={["dataMin - 2", "dataMax + 2"]}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    formatter={(value) => [`${value} кг`, "Вес"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="weight"
                    stroke="#10b981"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "#10b981" }}
                    name="Вес"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {/* Weight history table (if only 1 entry or as reference) */}
        {weightHistory.length > 0 && chartData.length < 2 && (
          <Card>
            <h3 className="font-semibold mb-3">История веса</h3>
            <p className="text-sm text-[var(--muted)]">
              Для отображения графика нужно минимум 2 записи. Текущий вес: {weightHistory[0].weight_kg} кг
              ({new Date(weightHistory[0].recorded_at).toLocaleDateString("ru-RU")})
            </p>
          </Card>
        )}
      </div>
    </>
  );
}
