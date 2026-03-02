"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { createClient } from "@/lib/supabase/client";
import type { MedicalRecord, RecordType, RecordStatus, Attachment } from "@/lib/types";

const typeLabels: Record<RecordType, string> = {
  visit: "Приём врача",
  analysis: "Анализы",
  vaccination: "Вакцинация",
  prescription: "Рецепт",
  note: "Заметка",
};

const statusVariants: Record<RecordStatus, "success" | "warning" | "danger"> = {
  normal: "success",
  warning: "warning",
  attention: "danger",
};

const statusLabels: Record<RecordStatus, string> = {
  normal: "Норма",
  warning: "Внимание",
  attention: "Требует действий",
};

interface RecordDetailModalProps {
  record: MedicalRecord | null;
  open: boolean;
  onClose: () => void;
  onRecordUpdated?: () => void;
}

export default function RecordDetailModal({ record, open, onClose, onRecordUpdated }: RecordDetailModalProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [analyzingAi, setAnalyzingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const { toast } = useToast();

  const supabase = createClient();

  useEffect(() => {
    if (record && open) {
      loadAttachments(record.id);
    }
  }, [record, open]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadAttachments(recordId: string) {
    setLoadingAttachments(true);
    const { data } = await supabase
      .from("attachments")
      .select("*")
      .eq("record_id", recordId)
      .order("created_at", { ascending: false });

    setAttachments((data as Attachment[]) || []);
    setLoadingAttachments(false);
  }

  async function handleDownload(attachment: Attachment) {
    const { data } = await supabase.storage
      .from("medical-files")
      .createSignedUrl(attachment.storage_path, 60);

    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
    }
  }

  async function handleRequestAiAnalysis() {
    if (!record) return;
    setAnalyzingAi(true);
    setAiError(null);

    try {
      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ record_id: record.id }),
      });

      const result = await res.json();

      if (!res.ok) {
        if (res.status === 503) {
          setAiError("AI-ассистент временно недоступен. Попробуйте позже.");
          toast("AI-ассистент временно недоступен", "warning");
        } else if (res.status === 429) {
          setAiError("Слишком много запросов. Подождите минуту.");
          toast("Превышен лимит запросов к AI", "warning");
        } else {
          setAiError(result.error || `Ошибка сервера (${res.status})`);
        }
        return;
      }

      if (result.analysis) {
        // The API route already updated the record in DB,
        // but also update from client side for immediate UI feedback
        await supabase
          .from("medical_records")
          .update({
            ai_analysis: result.analysis,
            ai_recommendations: result.recommendations || null,
          })
          .eq("id", record.id);

        toast("AI-анализ завершён", "success");
        onRecordUpdated?.();
      } else {
        setAiError("AI не вернул результат анализа. Попробуйте ещё раз.");
        toast("AI не вернул результат", "warning");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Неизвестная ошибка";
      setAiError(`Не удалось выполнить анализ: ${msg}`);
      toast("Ошибка AI-анализа", "error");
    } finally {
      setAnalyzingAi(false);
    }
  }

  function formatFileSize(bytes: number | null) {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (!record) return null;

  return (
    <Modal open={open} onClose={onClose} title={record.title} size="lg">
      <div className="space-y-5">
        {/* Мета-информация */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="info">{typeLabels[record.record_type]}</Badge>
          <Badge variant={statusVariants[record.status]}>{statusLabels[record.status]}</Badge>
          {record.tags.map((tag) => (
            <Badge key={tag} variant="default">{tag}</Badge>
          ))}
        </div>

        {/* Основные поля */}
        <div className="grid gap-3 sm:grid-cols-2">
          <InfoRow label="Дата" value={new Date(record.record_date).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })} />
          {record.doctor_name && <InfoRow label="Врач" value={record.doctor_name} />}
          {record.clinic_name && <InfoRow label="Клиника" value={record.clinic_name} />}
        </div>

        {/* Описание */}
        {record.description && (
          <div>
            <p className="mb-1 text-xs font-medium uppercase text-[var(--muted)]">Описание</p>
            <p className="text-sm whitespace-pre-wrap">{record.description}</p>
          </div>
        )}

        {/* AI-анализ */}
        {record.ai_analysis && (
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
            <div className="mb-2 flex items-center gap-2">
              <svg className="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <p className="text-sm font-medium text-emerald-400">AI-анализ</p>
            </div>
            <p className="text-sm whitespace-pre-wrap">{record.ai_analysis}</p>
          </div>
        )}

        {record.ai_recommendations && (
          <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
            <p className="mb-2 text-sm font-medium text-blue-400">Рекомендации AI</p>
            <p className="text-sm whitespace-pre-wrap">{record.ai_recommendations}</p>
          </div>
        )}

        {/* Кнопка AI-анализа */}
        {(!record.ai_analysis || aiError) && (
          <div className="space-y-2">
            <Button
              variant="secondary"
              size="sm"
              loading={analyzingAi}
              onClick={handleRequestAiAnalysis}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {analyzingAi ? "Анализ выполняется..." : record.ai_analysis ? "Повторить AI-анализ" : "Запросить AI-анализ"}
            </Button>
            {aiError && (
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                <p className="text-xs text-amber-400">{aiError}</p>
              </div>
            )}
          </div>
        )}

        {/* Вложения */}
        <div>
          <p className="mb-2 text-xs font-medium uppercase text-[var(--muted)]">
            Вложения {!loadingAttachments && `(${attachments.length})`}
          </p>

          {loadingAttachments ? (
            <p className="text-sm text-[var(--muted)]">Загрузка...</p>
          ) : attachments.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Нет вложений</p>
          ) : (
            <div className="space-y-2">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center justify-between rounded-lg bg-[var(--background)] p-3"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <svg className="h-4 w-4 shrink-0 text-[var(--muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                    </svg>
                    <span className="truncate text-sm">{att.file_name}</span>
                    <span className="shrink-0 text-xs text-[var(--muted)]">{formatFileSize(att.file_size)}</span>
                  </div>
                  <button
                    onClick={() => handleDownload(att)}
                    className="shrink-0 text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Даты */}
        <div className="flex gap-4 text-xs text-[var(--muted)] border-t border-[var(--border)] pt-3">
          <span>Создано: {new Date(record.created_at).toLocaleString("ru-RU")}</span>
          <span>Обновлено: {new Date(record.updated_at).toLocaleString("ru-RU")}</span>
        </div>
      </div>
    </Modal>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}
