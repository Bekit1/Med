"use client";

import { useEffect, useState, useCallback } from "react";
import { useUser } from "@/lib/context/UserContext";
import { useToast } from "@/components/ui/Toast";
import ProtectedLayout from "@/components/layout/ProtectedLayout";
import Header from "@/components/layout/Header";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import type {
  HealthCondition, ConditionType, ConditionStatus, ConditionSeverity, Medication,
} from "@/lib/types";

const TYPE_LABELS: Record<ConditionType, string> = {
  chronic: "Хроническое",
  acute: "Острое",
  past: "Перенесённое",
  risk_factor: "Фактор риска",
};

const STATUS_CONFIG: Record<ConditionStatus, { label: string; variant: "danger" | "warning" | "success" | "info"; border: string }> = {
  active: { label: "Активно", variant: "danger", border: "border-red-500/40" },
  remission: { label: "Ремиссия", variant: "warning", border: "border-yellow-500/40" },
  resolved: { label: "Вылечено", variant: "success", border: "border-emerald-500/40" },
  monitoring: { label: "Наблюдение", variant: "info", border: "border-blue-500/40" },
};

const SEVERITY_LABELS: Record<ConditionSeverity, string> = {
  mild: "Лёгкая",
  moderate: "Умеренная",
  severe: "Тяжёлая",
};

const POPULAR_CONDITIONS = [
  "Сахарный диабет 2 типа", "Гипертензия", "Бронхиальная астма",
  "Аллергический ринит", "Гастрит", "ОРВИ", "Ангина", "Мигрень",
  "Остеохондроз", "Варикоз", "Анемия", "Гипотиреоз",
  "Атопический дерматит", "Панкреатит", "Холецистит",
];

export default function ConditionsPage() {
  return (
    <ProtectedLayout>
      <ConditionsContent />
    </ProtectedLayout>
  );
}

function ConditionsContent() {
  const { user } = useUser();
  const { toast } = useToast();

  const [conditions, setConditions] = useState<HealthCondition[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCondition, setEditingCondition] = useState<HealthCondition | null>(null);
  const [pastExpanded, setPastExpanded] = useState(false);

  const chronic = conditions.filter((c) => c.condition_type === "chronic");
  const acute = conditions.filter((c) => c.condition_type === "acute" && c.status === "active");
  const riskFactors = conditions.filter((c) => c.condition_type === "risk_factor");
  const past = conditions.filter(
    (c) => c.condition_type === "past" || c.status === "resolved"
  ).filter((c) => !chronic.includes(c) && !acute.includes(c) && !riskFactors.includes(c));

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [condRes, medRes] = await Promise.all([
        fetch("/api/conditions"),
        fetch("/api/medications?active=true"),
      ]);
      if (condRes.ok) {
        const data = await condRes.json();
        setConditions(data.conditions);
      }
      if (medRes.ok) {
        const data = await medRes.json();
        setMedications(data.medications);
      }
    } catch {
      toast("Ошибка загрузки данных", "error");
    }
    setLoading(false);
  }, [user, toast]);

  useEffect(() => {
    if (user) loadData();
  }, [user, loadData]);

  function handleAdd() {
    setEditingCondition(null);
    setModalOpen(true);
  }

  function handleEdit(c: HealthCondition) {
    setEditingCondition(c);
    setModalOpen(true);
  }

  async function handleResolve(c: HealthCondition) {
    try {
      const res = await fetch("/api/conditions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: c.id,
          status: "resolved",
          resolved_at: new Date().toISOString().split("T")[0],
        }),
      });
      if (res.ok) {
        toast("Состояние обновлено", "success");
        loadData();
      }
    } catch {
      toast("Ошибка сети", "error");
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/conditions?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        toast("Запись удалена", "success");
        loadData();
      }
    } catch {
      toast("Ошибка сети", "error");
    }
  }

  async function handleSave(data: ConditionFormData) {
    try {
      const method = editingCondition ? "PATCH" : "POST";
      const body = editingCondition ? { id: editingCondition.id, ...data } : data;

      const res = await fetch("/api/conditions", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast(editingCondition ? "Обновлено" : "Добавлено", "success");
        setModalOpen(false);
        loadData();
      } else {
        const err = await res.json().catch(() => null);
        toast(err?.error || "Ошибка сохранения", "error");
      }
    } catch {
      toast("Ошибка сети", "error");
    }
  }

  function getMedName(id: string): string | null {
    const med = medications.find((m) => m.id === id);
    return med?.name || null;
  }

  return (
    <>
      <Header
        title="Болезни и состояния"
        description="Хронические, острые заболевания и факторы риска"
        actions={
          <button
            onClick={handleAdd}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
          >
            + Добавить
          </button>
        }
      />

      <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <div className="animate-pulse space-y-3">
                  <div className="h-5 w-2/3 rounded bg-[var(--border)]" />
                  <div className="h-4 w-1/2 rounded bg-[var(--border)]" />
                </div>
              </Card>
            ))}
          </div>
        ) : conditions.length === 0 ? (
          <Card>
            <div className="text-center py-8">
              <div className="text-3xl mb-2">{"\u{1F3E5}"}</div>
              <p className="text-sm text-[var(--muted)]">Нет записей о заболеваниях</p>
              <button
                onClick={handleAdd}
                className="mt-3 px-4 py-2 rounded-lg text-xs font-medium bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
              >
                Добавить первую запись
              </button>
            </div>
          </Card>
        ) : (
          <>
            {/* Chronic conditions */}
            {chronic.length > 0 && (
              <Section title="Хронические заболевания" count={chronic.length}>
                <div className="grid gap-3 sm:grid-cols-2">
                  {chronic.map((c) => (
                    <ConditionCard
                      key={c.id}
                      condition={c}
                      getMedName={getMedName}
                      onEdit={() => handleEdit(c)}
                      onResolve={() => handleResolve(c)}
                      onDelete={() => handleDelete(c.id)}
                    />
                  ))}
                </div>
              </Section>
            )}

            {/* Acute conditions */}
            {acute.length > 0 && (
              <Section title="Текущие заболевания" count={acute.length}>
                <div className="grid gap-3 sm:grid-cols-2">
                  {acute.map((c) => (
                    <ConditionCard
                      key={c.id}
                      condition={c}
                      getMedName={getMedName}
                      onEdit={() => handleEdit(c)}
                      onResolve={() => handleResolve(c)}
                      onDelete={() => handleDelete(c.id)}
                      showResolve
                    />
                  ))}
                </div>
              </Section>
            )}

            {/* Risk factors */}
            {riskFactors.length > 0 && (
              <Section title="Факторы риска" count={riskFactors.length}>
                <Card>
                  <div className="space-y-2">
                    {riskFactors.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between rounded-lg bg-[var(--background)] p-3"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-amber-400">
                            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                            </svg>
                          </span>
                          <div>
                            <p className="text-sm font-medium">{c.name}</p>
                            {c.notes && <p className="text-xs text-[var(--muted)]">{c.notes}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleEdit(c)}
                            className="px-2 py-1 rounded text-xs border border-[var(--border)] hover:bg-white/5 transition-colors"
                          >
                            Ред.
                          </button>
                          <button
                            onClick={() => handleDelete(c.id)}
                            className="px-2 py-1 rounded text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </Section>
            )}

            {/* Past / Resolved */}
            {past.length > 0 && (
              <div>
                <button
                  onClick={() => setPastExpanded(!pastExpanded)}
                  className="flex items-center gap-2 text-base font-semibold mb-3 hover:text-emerald-400 transition-colors"
                >
                  <svg
                    className={`h-4 w-4 transition-transform ${pastExpanded ? "rotate-90" : ""}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  Перенесённые заболевания
                  <span className="text-sm font-normal text-[var(--muted)]">({past.length})</span>
                </button>
                {pastExpanded && (
                  <Card>
                    <div className="space-y-2">
                      {past.map((c) => (
                        <div
                          key={c.id}
                          className="flex items-center justify-between rounded-lg bg-[var(--background)] p-3"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{c.name}</p>
                            <p className="text-xs text-[var(--muted)]">
                              {c.diagnosed_at ? formatDate(c.diagnosed_at) : "?"}
                              {" \u2014 "}
                              {c.resolved_at ? formatDate(c.resolved_at) : "н/д"}
                              {c.severity && ` \u00B7 ${SEVERITY_LABELS[c.severity]}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            <Badge variant="success">Вылечено</Badge>
                            <button
                              onClick={() => handleDelete(c.id)}
                              className="px-2 py-1 rounded text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {modalOpen && (
        <ConditionModal
          condition={editingCondition}
          medications={medications}
          onSave={handleSave}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}

// ============================================
// Section wrapper
// ============================================
function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-base font-semibold mb-3">
        {title}
        <span className="ml-2 text-sm font-normal text-[var(--muted)]">({count})</span>
      </h2>
      {children}
    </div>
  );
}

// ============================================
// Condition Card
// ============================================
function ConditionCard({
  condition: c,
  getMedName,
  onEdit,
  onResolve,
  onDelete,
  showResolve,
}: {
  condition: HealthCondition;
  getMedName: (id: string) => string | null;
  onEdit: () => void;
  onResolve: () => void;
  onDelete: () => void;
  showResolve?: boolean;
}) {
  const statusCfg = STATUS_CONFIG[c.status];
  const relMeds = c.related_medications
    .map((id) => getMedName(id))
    .filter(Boolean) as string[];

  return (
    <Card className={`border-l-4 ${statusCfg.border}`}>
      <div className="space-y-2">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold">{c.name}</p>
            {c.icd_code && <p className="text-[10px] text-[var(--muted)]">МКБ-10: {c.icd_code}</p>}
          </div>
          <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
        </div>

        <div className="text-xs text-[var(--muted)] space-y-0.5">
          {c.severity && <p>Тяжесть: {SEVERITY_LABELS[c.severity]}</p>}
          {c.diagnosed_at && <p>Диагностировано: {formatDate(c.diagnosed_at)}</p>}
          {c.diagnosed_by && <p>Врач: {c.diagnosed_by}</p>}
          {c.notes && <p>{c.notes}</p>}
        </div>

        {c.symptoms.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {c.symptoms.map((s, i) => (
              <span key={i} className="text-[10px] bg-white/5 px-1.5 py-0.5 rounded text-[var(--muted)]">
                {s}
              </span>
            ))}
          </div>
        )}

        {relMeds.length > 0 && (
          <div className="text-xs text-[var(--muted)]">
            Препараты: {relMeds.join(", ")}
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={onEdit}
            className="px-3 py-1 rounded text-xs border border-[var(--border)] hover:bg-white/5 transition-colors"
          >
            Редактировать
          </button>
          {showResolve && (
            <button
              onClick={onResolve}
              className="px-3 py-1 rounded text-xs text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/10 transition-colors"
            >
              Выздоровел
            </button>
          )}
          <button
            onClick={onDelete}
            className="px-2 py-1 rounded text-xs text-red-400 hover:bg-red-500/10 transition-colors ml-auto"
            title="Удалить"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </Card>
  );
}

// ============================================
// Modal
// ============================================
interface ConditionFormData {
  name: string;
  condition_type: ConditionType;
  status: ConditionStatus;
  severity: ConditionSeverity | "";
  diagnosed_at: string;
  resolved_at: string;
  diagnosed_by: string;
  icd_code: string;
  notes: string;
  symptoms: string[];
  related_medications: string[];
}

function ConditionModal({
  condition,
  medications,
  onSave,
  onClose,
}: {
  condition: HealthCondition | null;
  medications: Medication[];
  onSave: (data: ConditionFormData) => Promise<void>;
  onClose: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [symptomsText, setSymptomsText] = useState(condition?.symptoms.join(", ") || "");

  const [form, setForm] = useState<ConditionFormData>({
    name: condition?.name || "",
    condition_type: condition?.condition_type || "chronic",
    status: condition?.status || "active",
    severity: condition?.severity || "",
    diagnosed_at: condition?.diagnosed_at || "",
    resolved_at: condition?.resolved_at || "",
    diagnosed_by: condition?.diagnosed_by || "",
    icd_code: condition?.icd_code || "",
    notes: condition?.notes || "",
    symptoms: condition?.symptoms || [],
    related_medications: condition?.related_medications || [],
  });

  function updateField<K extends keyof ConditionFormData>(key: K, value: ConditionFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const filteredSuggestions = POPULAR_CONDITIONS.filter(
    (n) => form.name.length > 0 && n.toLowerCase().includes(form.name.toLowerCase()) && n !== form.name
  );

  function handleSymptomsChange(text: string) {
    setSymptomsText(text);
    const arr = text.split(",").map((s) => s.trim()).filter(Boolean);
    updateField("symptoms", arr);
  }

  function toggleMedication(id: string) {
    setForm((prev) => {
      const arr = prev.related_medications.includes(id)
        ? prev.related_medications.filter((m) => m !== id)
        : [...prev.related_medications, id];
      return { ...prev, related_medications: arr };
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            {condition ? "Редактировать" : "Добавить заболевание"}
          </h2>
          <button onClick={onClose} className="text-[var(--muted)] hover:text-[var(--foreground)] transition-colors">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type */}
          <div>
            <label className="mb-1 block text-sm text-[var(--muted)]">Тип</label>
            <select
              value={form.condition_type}
              onChange={(e) => updateField("condition_type", e.target.value as ConditionType)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-emerald-500 focus:outline-none"
            >
              <option value="chronic">Хроническое</option>
              <option value="acute">Острое</option>
              <option value="past">Перенесённое</option>
              <option value="risk_factor">Фактор риска</option>
            </select>
          </div>

          {/* Name with suggestions */}
          <div className="relative">
            <label className="mb-1 block text-sm text-[var(--muted)]">Название</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => {
                updateField("name", e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              placeholder="Бронхиальная астма"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-emerald-500 focus:outline-none"
            />
            {showSuggestions && filteredSuggestions.length > 0 && (
              <div className="absolute z-20 top-full left-0 right-0 mt-1 rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-lg max-h-40 overflow-y-auto">
                {filteredSuggestions.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onMouseDown={() => {
                      updateField("name", name);
                      setShowSuggestions(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-white/5 transition-colors"
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Status */}
          <div>
            <label className="mb-1 block text-sm text-[var(--muted)]">Статус</label>
            <select
              value={form.status}
              onChange={(e) => updateField("status", e.target.value as ConditionStatus)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-emerald-500 focus:outline-none"
            >
              <option value="active">Активно</option>
              <option value="remission">Ремиссия</option>
              <option value="resolved">Вылечено</option>
              <option value="monitoring">Под наблюдением</option>
            </select>
          </div>

          {/* Severity */}
          <div>
            <label className="mb-1 block text-sm text-[var(--muted)]">Тяжесть</label>
            <select
              value={form.severity}
              onChange={(e) => updateField("severity", e.target.value as ConditionSeverity | "")}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-emerald-500 focus:outline-none"
            >
              <option value="">Не указана</option>
              <option value="mild">Лёгкая</option>
              <option value="moderate">Умеренная</option>
              <option value="severe">Тяжёлая</option>
            </select>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm text-[var(--muted)]">Дата диагноза</label>
              <input
                type="date"
                value={form.diagnosed_at}
                onChange={(e) => updateField("diagnosed_at", e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-[var(--muted)]">Дата выздоровления</label>
              <input
                type="date"
                value={form.resolved_at}
                onChange={(e) => updateField("resolved_at", e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Doctor */}
          <div>
            <label className="mb-1 block text-sm text-[var(--muted)]">Врач</label>
            <input
              type="text"
              value={form.diagnosed_by}
              onChange={(e) => updateField("diagnosed_by", e.target.value)}
              placeholder="Кто поставил диагноз"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {/* ICD code */}
          <div>
            <label className="mb-1 block text-sm text-[var(--muted)]">Код МКБ-10</label>
            <input
              type="text"
              value={form.icd_code}
              onChange={(e) => updateField("icd_code", e.target.value)}
              placeholder="J45, E11, I10..."
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {/* Symptoms */}
          <div>
            <label className="mb-1 block text-sm text-[var(--muted)]">Симптомы (через запятую)</label>
            <input
              type="text"
              value={symptomsText}
              onChange={(e) => handleSymptomsChange(e.target.value)}
              placeholder="кашель, одышка, головная боль"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {/* Related medications */}
          {medications.length > 0 && (
            <div>
              <label className="mb-1 block text-sm text-[var(--muted)]">Связанные препараты</label>
              <div className="space-y-1 max-h-32 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--background)] p-2">
                {medications.map((med) => (
                  <label key={med.id} className="flex items-center gap-2 cursor-pointer py-1 px-1 rounded hover:bg-white/5">
                    <input
                      type="checkbox"
                      checked={form.related_medications.includes(med.id)}
                      onChange={() => toggleMedication(med.id)}
                      className="accent-emerald-500"
                    />
                    <span className="text-sm">{med.name}</span>
                    {med.dosage && <span className="text-[10px] text-[var(--muted)]">{med.dosage}</span>}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="mb-1 block text-sm text-[var(--muted)]">Заметки</label>
            <textarea
              value={form.notes}
              onChange={(e) => updateField("notes", e.target.value)}
              rows={2}
              placeholder="Дополнительная информация"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-emerald-500 focus:outline-none resize-none"
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={saving || !form.name.trim()}
              className="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition-colors"
            >
              {saving ? "Сохранение..." : condition ? "Сохранить" : "Добавить"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm hover:bg-white/5 transition-colors"
            >
              Отмена
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================
// Helpers
// ============================================
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
