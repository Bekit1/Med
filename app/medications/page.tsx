"use client";

import { useEffect, useState, useCallback } from "react";
import { useUser } from "@/lib/context/UserContext";
import { useToast } from "@/components/ui/Toast";
import ProtectedLayout from "@/components/layout/ProtectedLayout";
import Header from "@/components/layout/Header";
import Card from "@/components/ui/Card";
import type { Medication, MedicationType, MedicationFrequency } from "@/lib/types";

const TYPE_CONFIG: Record<MedicationType, { icon: string; label: string; border: string }> = {
  medication: { icon: "\u{1F48A}", label: "Лекарство", border: "border-blue-500/30" },
  vitamin: { icon: "\u{1F7E1}", label: "Витамин", border: "border-orange-500/30" },
  supplement: { icon: "\u{1F9EA}", label: "Добавка", border: "border-emerald-500/30" },
  other: { icon: "\u{1F4CB}", label: "Другое", border: "border-gray-500/30" },
};

const FREQUENCY_LABELS: Record<MedicationFrequency, string> = {
  daily_1: "1 раз в день",
  daily_2: "2 раза в день",
  daily_3: "3 раза в день",
  weekly: "Раз в неделю",
  as_needed: "По необходимости",
  other: "Другое",
};

const POPULAR_NAMES = [
  "Витамин D3", "Омега-3", "Магний", "Железо", "Витамин B12",
  "Цинк", "Пробиотики", "Мелатонин", "Витамин C", "Кальций",
  "Фолиевая кислота", "Коэнзим Q10", "Куркумин", "Селен",
];

export default function MedicationsPage() {
  return (
    <ProtectedLayout>
      <MedicationsContent />
    </ProtectedLayout>
  );
}

function MedicationsContent() {
  const { user } = useUser();
  const { toast } = useToast();

  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMed, setEditingMed] = useState<Medication | null>(null);

  const activeMeds = medications.filter((m) => m.is_active);
  const historyMeds = medications.filter((m) => !m.is_active);

  const loadMedications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await fetch("/api/medications");
      if (res.ok) {
        const data = await res.json();
        setMedications(data.medications);
      }
    } catch {
      toast("Ошибка загрузки препаратов", "error");
    }
    setLoading(false);
  }, [user, toast]);

  useEffect(() => {
    if (user) loadMedications();
  }, [user, loadMedications]);

  function handleAdd() {
    setEditingMed(null);
    setModalOpen(true);
  }

  function handleEdit(med: Medication) {
    setEditingMed(med);
    setModalOpen(true);
  }

  async function handleDeactivate(med: Medication) {
    try {
      const res = await fetch("/api/medications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: med.id,
          is_active: false,
          ended_at: new Date().toISOString().split("T")[0],
        }),
      });
      if (res.ok) {
        toast("Приём завершён", "success");
        loadMedications();
      } else {
        toast("Ошибка обновления", "error");
      }
    } catch {
      toast("Ошибка сети", "error");
    }
  }

  async function handleResume(med: Medication) {
    try {
      const res = await fetch("/api/medications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: med.name,
          type: med.type,
          dosage: med.dosage,
          frequency: med.frequency,
          frequency_detail: med.frequency_detail,
          reason: med.reason,
          started_at: new Date().toISOString().split("T")[0],
          notes: med.notes,
          prescribed_by: med.prescribed_by,
        }),
      });
      if (res.ok) {
        toast("Приём возобновлён", "success");
        loadMedications();
      } else {
        toast("Ошибка создания", "error");
      }
    } catch {
      toast("Ошибка сети", "error");
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/medications?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        toast("Препарат удалён", "success");
        loadMedications();
      } else {
        toast("Ошибка удаления", "error");
      }
    } catch {
      toast("Ошибка сети", "error");
    }
  }

  async function handleSave(data: MedicationFormData) {
    try {
      const method = editingMed ? "PATCH" : "POST";
      const body = editingMed ? { id: editingMed.id, ...data } : data;

      const res = await fetch("/api/medications", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast(editingMed ? "Препарат обновлён" : "Препарат добавлен", "success");
        setModalOpen(false);
        loadMedications();
      } else {
        const err = await res.json().catch(() => null);
        toast(err?.error || "Ошибка сохранения", "error");
      }
    } catch {
      toast("Ошибка сети", "error");
    }
  }

  return (
    <>
      <Header
        title="Препараты и добавки"
        description="Управление текущими и прошлыми препаратами"
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
        {/* Active medications */}
        <div>
          <h2 className="text-base font-semibold mb-3">
            Текущие препараты
            {!loading && activeMeds.length > 0 && (
              <span className="ml-2 text-sm font-normal text-[var(--muted)]">({activeMeds.length})</span>
            )}
          </h2>

          {loading ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {[1, 2].map((i) => (
                <Card key={i}>
                  <div className="animate-pulse space-y-3">
                    <div className="h-5 w-2/3 rounded bg-[var(--border)]" />
                    <div className="h-4 w-1/2 rounded bg-[var(--border)]" />
                    <div className="h-4 w-1/3 rounded bg-[var(--border)]" />
                  </div>
                </Card>
              ))}
            </div>
          ) : activeMeds.length === 0 ? (
            <Card>
              <div className="text-center py-8">
                <div className="text-3xl mb-2">{"\u{1F48A}"}</div>
                <p className="text-sm text-[var(--muted)]">Нет активных препаратов</p>
                <button
                  onClick={handleAdd}
                  className="mt-3 px-4 py-2 rounded-lg text-xs font-medium bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
                >
                  Добавить первый препарат
                </button>
              </div>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {activeMeds.map((med) => {
                const cfg = TYPE_CONFIG[med.type];
                return (
                  <Card key={med.id} className={`border-l-4 ${cfg.border}`}>
                    <div className="space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{cfg.icon}</span>
                          <div>
                            <p className="text-sm font-semibold">{med.name}</p>
                            {med.dosage && (
                              <p className="text-xs text-[var(--muted)]">{med.dosage}</p>
                            )}
                          </div>
                        </div>
                        <span className="text-[10px] text-[var(--muted)] bg-white/5 px-2 py-0.5 rounded-full">
                          {cfg.label}
                        </span>
                      </div>

                      <div className="text-xs text-[var(--muted)] space-y-0.5">
                        <p>{FREQUENCY_LABELS[med.frequency]}
                          {med.frequency_detail && ` \u2014 ${med.frequency_detail}`}
                        </p>
                        <p>C {formatDate(med.started_at)}</p>
                        {med.reason && <p>Причина: {med.reason}</p>}
                        {med.prescribed_by && <p>Назначил: {med.prescribed_by}</p>}
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => handleEdit(med)}
                          className="px-3 py-1 rounded text-xs border border-[var(--border)] hover:bg-white/5 transition-colors"
                        >
                          Редактировать
                        </button>
                        <button
                          onClick={() => handleDeactivate(med)}
                          className="px-3 py-1 rounded text-xs text-amber-400 border border-amber-500/30 hover:bg-amber-500/10 transition-colors"
                        >
                          Завершить приём
                        </button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* History */}
        {historyMeds.length > 0 && (
          <div>
            <h2 className="text-base font-semibold mb-3">
              История приёма
              <span className="ml-2 text-sm font-normal text-[var(--muted)]">({historyMeds.length})</span>
            </h2>
            <Card>
              <div className="space-y-2">
                {historyMeds.map((med) => {
                  const cfg = TYPE_CONFIG[med.type];
                  return (
                    <div
                      key={med.id}
                      className="flex items-center justify-between rounded-lg bg-[var(--background)] p-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-base shrink-0">{cfg.icon}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {med.name}
                            {med.dosage && <span className="text-[var(--muted)]"> \u2014 {med.dosage}</span>}
                          </p>
                          <p className="text-xs text-[var(--muted)]">
                            {formatDate(med.started_at)} \u2014 {med.ended_at ? formatDate(med.ended_at) : "н/д"}
                            {med.reason && ` \u00B7 ${med.reason}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <button
                          onClick={() => handleResume(med)}
                          className="px-3 py-1 rounded text-xs text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/10 transition-colors"
                        >
                          Возобновить
                        </button>
                        <button
                          onClick={() => handleDelete(med.id)}
                          className="px-2 py-1 rounded text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Удалить"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <MedicationModal
          medication={editingMed}
          onSave={handleSave}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}

// ============================================
// Modal form
// ============================================

interface MedicationFormData {
  name: string;
  type: MedicationType;
  dosage: string;
  frequency: MedicationFrequency;
  frequency_detail: string;
  reason: string;
  started_at: string;
  notes: string;
  prescribed_by: string;
}

function MedicationModal({
  medication,
  onSave,
  onClose,
}: {
  medication: Medication | null;
  onSave: (data: MedicationFormData) => Promise<void>;
  onClose: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  const [form, setForm] = useState<MedicationFormData>({
    name: medication?.name || "",
    type: medication?.type || "vitamin",
    dosage: medication?.dosage || "",
    frequency: medication?.frequency || "daily_1",
    frequency_detail: medication?.frequency_detail || "",
    reason: medication?.reason || "",
    started_at: medication?.started_at || today,
    notes: medication?.notes || "",
    prescribed_by: medication?.prescribed_by || "",
  });

  function updateField<K extends keyof MedicationFormData>(key: K, value: MedicationFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const filteredSuggestions = POPULAR_NAMES.filter(
    (n) => form.name.length > 0 && n.toLowerCase().includes(form.name.toLowerCase()) && n !== form.name
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.started_at) return;
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
            {medication ? "Редактировать препарат" : "Добавить препарат"}
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
              value={form.type}
              onChange={(e) => updateField("type", e.target.value as MedicationType)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-emerald-500 focus:outline-none"
            >
              <option value="medication">Лекарство</option>
              <option value="vitamin">Витамин</option>
              <option value="supplement">Добавка</option>
              <option value="other">Другое</option>
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
              placeholder="Витамин D3"
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

          {/* Dosage */}
          <div>
            <label className="mb-1 block text-sm text-[var(--muted)]">Дозировка</label>
            <input
              type="text"
              value={form.dosage}
              onChange={(e) => updateField("dosage", e.target.value)}
              placeholder="500 мг, 1000 IU"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {/* Frequency */}
          <div>
            <label className="mb-1 block text-sm text-[var(--muted)]">Частота приёма</label>
            <select
              value={form.frequency}
              onChange={(e) => updateField("frequency", e.target.value as MedicationFrequency)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-emerald-500 focus:outline-none"
            >
              <option value="daily_1">1 раз в день</option>
              <option value="daily_2">2 раза в день</option>
              <option value="daily_3">3 раза в день</option>
              <option value="weekly">Раз в неделю</option>
              <option value="as_needed">По необходимости</option>
              <option value="other">Другое</option>
            </select>
          </div>

          {/* Frequency detail */}
          <div>
            <label className="mb-1 block text-sm text-[var(--muted)]">Уточнение по приёму</label>
            <input
              type="text"
              value={form.frequency_detail}
              onChange={(e) => updateField("frequency_detail", e.target.value)}
              placeholder="утром натощак"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {/* Reason */}
          <div>
            <label className="mb-1 block text-sm text-[var(--muted)]">Причина приёма</label>
            <input
              type="text"
              value={form.reason}
              onChange={(e) => updateField("reason", e.target.value)}
              placeholder="для суставов, назначение эндокринолога"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {/* Started at */}
          <div>
            <label className="mb-1 block text-sm text-[var(--muted)]">Дата начала</label>
            <input
              type="date"
              required
              value={form.started_at}
              onChange={(e) => updateField("started_at", e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {/* Prescribed by */}
          <div>
            <label className="mb-1 block text-sm text-[var(--muted)]">Назначил</label>
            <input
              type="text"
              value={form.prescribed_by}
              onChange={(e) => updateField("prescribed_by", e.target.value)}
              placeholder="имя врача или самостоятельно"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-emerald-500 focus:outline-none"
            />
          </div>

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
              {saving ? "Сохранение..." : medication ? "Сохранить" : "Добавить"}
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
