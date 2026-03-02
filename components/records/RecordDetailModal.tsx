"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { useUser } from "@/lib/context/UserContext";
import { createClient } from "@/lib/supabase/client";
import type { MedicalRecord, RecordType, RecordStatus, Attachment } from "@/lib/types";

const typeLabels: Record<RecordType, string> = {
  visit: "Приём врача",
  analysis: "Анализы",
  vaccination: "Вакцинация",
  prescription: "Рецепт",
  note: "Заметка",
};

const typeOptions: { value: RecordType; label: string }[] = [
  { value: "analysis", label: "Анализы" },
  { value: "visit", label: "Приём врача" },
  { value: "prescription", label: "Рецепт" },
  { value: "vaccination", label: "Вакцинация" },
  { value: "note", label: "Заметка" },
];

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

const ACCEPT = ".pdf,.png,.jpg,.jpeg,.heic";
const MAX_FILE_SIZE = 10 * 1024 * 1024;

interface RecordDetailModalProps {
  record: MedicalRecord | null;
  open: boolean;
  onClose: () => void;
  onRecordUpdated?: () => void;
  onRecordDeleted?: () => void;
}

export default function RecordDetailModal({
  record,
  open,
  onClose,
  onRecordUpdated,
  onRecordDeleted,
}: RecordDetailModalProps) {
  const { user, isAdmin } = useUser();
  const { toast } = useToast();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // View state
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [analyzingAi, setAnalyzingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Edit state
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editType, setEditType] = useState<RecordType>("analysis");
  const [editDate, setEditDate] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDoctorName, setEditDoctorName] = useState("");
  const [editClinicName, setEditClinicName] = useState("");
  const [editTagsInput, setEditTagsInput] = useState("");
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [deletedAttachmentIds, setDeletedAttachmentIds] = useState<Set<string>>(new Set());

  // Delete state
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const canModify = record && user && (record.user_id === user.id || isAdmin);

  // Load attachments when modal opens
  useEffect(() => {
    if (record && open) {
      loadAttachments(record.id);
      setEditing(false);
      setConfirmDelete(false);
      setNewFiles([]);
      setDeletedAttachmentIds(new Set());
      setAiError(null);
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

  // Enter edit mode — populate fields from record
  function startEditing() {
    if (!record) return;
    setEditTitle(record.title);
    setEditType(record.record_type);
    setEditDate(record.record_date);
    setEditDescription(record.description || "");
    setEditDoctorName(record.doctor_name || "");
    setEditClinicName(record.clinic_name || "");
    setEditTagsInput(record.tags.join(", "));
    setNewFiles([]);
    setDeletedAttachmentIds(new Set());
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setNewFiles([]);
    setDeletedAttachmentIds(new Set());
  }

  // File handling for edit mode
  const addFiles = useCallback(
    (fileList: FileList | File[]) => {
      const arr = Array.from(fileList).filter((f) => {
        const ext = f.name.split(".").pop()?.toLowerCase() || "";
        return ["pdf", "png", "jpg", "jpeg", "heic"].includes(ext);
      });
      const valid: File[] = [];
      for (const f of arr) {
        if (f.size > MAX_FILE_SIZE) {
          toast(`Файл "${f.name}" превышает 10 МБ`, "error");
          continue;
        }
        valid.push(f);
      }
      setNewFiles((prev) => [...prev, ...valid]);
    },
    [toast],
  );

  function removeNewFile(index: number) {
    setNewFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function markAttachmentForDeletion(attId: string) {
    setDeletedAttachmentIds((prev) => new Set(prev).add(attId));
  }

  function unmarkAttachmentForDeletion(attId: string) {
    setDeletedAttachmentIds((prev) => {
      const next = new Set(prev);
      next.delete(attId);
      return next;
    });
  }

  // Save edits
  async function handleSave() {
    if (!record || !user) return;
    setSaving(true);

    try {
      const tags = editTagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const res = await fetch("/api/records", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: record.id,
          title: editTitle,
          record_type: editType,
          record_date: editDate,
          description: editDescription || null,
          doctor_name: editDoctorName || null,
          clinic_name: editClinicName || null,
          tags,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast(data.error || "Ошибка сохранения", "error");
        setSaving(false);
        return;
      }

      // Delete marked attachments
      for (const attId of Array.from(deletedAttachmentIds)) {
        const att = attachments.find((a) => a.id === attId);
        if (!att) continue;
        await supabase.storage.from("medical-files").remove([att.storage_path]);
        await supabase.from("attachments").delete().eq("id", attId);
      }

      // Upload new files
      for (const file of newFiles) {
        const storagePath = `${user.id}/${record.id}/${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("medical-files")
          .upload(storagePath, file);

        if (uploadError) {
          toast(`Ошибка загрузки: ${file.name}`, "error");
          continue;
        }

        await supabase.from("attachments").insert({
          record_id: record.id,
          user_id: user.id,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          storage_path: storagePath,
        });
      }

      toast("Запись обновлена", "success");
      setEditing(false);
      setNewFiles([]);
      setDeletedAttachmentIds(new Set());
      onRecordUpdated?.();
    } catch {
      toast("Ошибка сохранения записи", "error");
    } finally {
      setSaving(false);
    }
  }

  // Delete record
  async function handleDelete() {
    if (!record) return;
    setDeleting(true);

    try {
      const res = await fetch(`/api/records?id=${record.id}`, { method: "DELETE" });

      if (!res.ok) {
        const data = await res.json();
        toast(data.error || "Ошибка удаления", "error");
        setDeleting(false);
        return;
      }

      toast("Запись удалена", "success");
      setConfirmDelete(false);
      onClose();
      onRecordDeleted?.();
    } catch {
      toast("Ошибка удаления записи", "error");
    } finally {
      setDeleting(false);
    }
  }

  // AI analysis
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

  async function handleDownload(attachment: Attachment) {
    const { data } = await supabase.storage
      .from("medical-files")
      .createSignedUrl(attachment.storage_path, 60);

    if (data?.signedUrl) {
      window.open(data.signedUrl, "_blank");
    }
  }

  function formatFileSize(bytes: number | null) {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (!record) return null;

  const showDoctorFields = editing
    ? editType === "visit" || editType === "prescription"
    : record.record_type === "visit" || record.record_type === "prescription";

  // ---------- DELETE CONFIRMATION MODAL ----------
  if (confirmDelete) {
    return (
      <Modal open={open} onClose={() => setConfirmDelete(false)} title="Удалить запись?" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-[var(--muted)]">
            Вы уверены, что хотите удалить запись <strong className="text-[var(--foreground)]">&laquo;{record.title}&raquo;</strong>?
            Будут удалены все вложения и метрики. Это действие нельзя отменить.
          </p>
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(false)} disabled={deleting}>
              Отмена
            </Button>
            <Button variant="danger" size="sm" loading={deleting} onClick={handleDelete}>
              Удалить
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  // ---------- EDIT MODE ----------
  if (editing) {
    return (
      <Modal open={open} onClose={cancelEditing} title="Редактирование записи" size="lg">
        <div className="space-y-4">
          {/* Title + Type */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Заголовок *"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              required
            />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm text-[var(--muted)]">Тип записи *</label>
              <select
                value={editType}
                onChange={(e) => setEditType(e.target.value as RecordType)}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
              >
                {typeOptions.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Date */}
          <Input
            label="Дата *"
            type="date"
            value={editDate}
            onChange={(e) => setEditDate(e.target.value)}
            required
          />

          {/* Doctor / Clinic */}
          {showDoctorFields && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Врач"
                placeholder="ФИО врача"
                value={editDoctorName}
                onChange={(e) => setEditDoctorName(e.target.value)}
              />
              <Input
                label="Клиника"
                placeholder="Название клиники"
                value={editClinicName}
                onChange={(e) => setEditClinicName(e.target.value)}
              />
            </div>
          )}

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-[var(--muted)]">Описание</label>
            <textarea
              rows={3}
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Подробности, результаты, заметки..."
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 resize-none"
            />
          </div>

          {/* Tags */}
          <Input
            label="Теги (через запятую)"
            placeholder="кровь, плановый, 2026"
            value={editTagsInput}
            onChange={(e) => setEditTagsInput(e.target.value)}
          />

          {/* Existing attachments */}
          <div>
            <p className="mb-2 text-xs font-medium uppercase text-[var(--muted)]">
              Вложения ({attachments.length - deletedAttachmentIds.size + newFiles.length})
            </p>

            <div className="space-y-2">
              {attachments.map((att) => {
                const isMarked = deletedAttachmentIds.has(att.id);
                return (
                  <div
                    key={att.id}
                    className={`flex items-center justify-between rounded-lg p-3 ${
                      isMarked
                        ? "bg-red-500/5 border border-red-500/20 opacity-60"
                        : "bg-[var(--background)]"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <svg className="h-4 w-4 shrink-0 text-[var(--muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                      <span className={`truncate text-sm ${isMarked ? "line-through" : ""}`}>{att.file_name}</span>
                      <span className="shrink-0 text-xs text-[var(--muted)]">{formatFileSize(att.file_size)}</span>
                    </div>
                    {isMarked ? (
                      <button
                        type="button"
                        onClick={() => unmarkAttachmentForDeletion(att.id)}
                        className="shrink-0 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                      >
                        Восстановить
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => markAttachmentForDeletion(att.id)}
                        className="shrink-0 text-[var(--muted)] hover:text-red-400 transition-colors"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                );
              })}

              {/* New files */}
              {newFiles.map((file, i) => (
                <div
                  key={`new-${file.name}-${i}`}
                  className="flex items-center justify-between rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-3"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <svg className="h-4 w-4 shrink-0 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="truncate text-sm">{file.name}</span>
                    <span className="shrink-0 text-xs text-[var(--muted)]">
                      {(file.size / 1024).toFixed(0)} KB
                    </span>
                    <Badge variant="success">новый</Badge>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeNewFile(i)}
                    className="shrink-0 text-[var(--muted)] hover:text-red-400 transition-colors"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            {/* Add files button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-2 flex items-center gap-2 rounded-lg border border-dashed border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm text-[var(--muted)] hover:border-emerald-500/50 hover:text-emerald-400 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
              </svg>
              Добавить файлы
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT}
              multiple
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = "";
              }}
              className="hidden"
            />
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 pt-2 border-t border-[var(--border)]">
            <Button onClick={handleSave} loading={saving} disabled={!editTitle.trim() || !editDate}>
              Сохранить
            </Button>
            <Button variant="secondary" onClick={cancelEditing} disabled={saving}>
              Отмена
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  // ---------- VIEW MODE ----------
  return (
    <Modal open={open} onClose={onClose} title={record.title} size="lg">
      <div className="space-y-5">
        {/* Meta badges */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="info">{typeLabels[record.record_type]}</Badge>
          <Badge variant={statusVariants[record.status]}>{statusLabels[record.status]}</Badge>
          {record.tags.map((tag) => (
            <Badge key={tag} variant="default">{tag}</Badge>
          ))}
        </div>

        {/* Info fields */}
        <div className="grid gap-3 sm:grid-cols-2">
          <InfoRow label="Дата" value={new Date(record.record_date).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })} />
          {record.doctor_name && <InfoRow label="Врач" value={record.doctor_name} />}
          {record.clinic_name && <InfoRow label="Клиника" value={record.clinic_name} />}
        </div>

        {/* Description */}
        {record.description && (
          <div>
            <p className="mb-1 text-xs font-medium uppercase text-[var(--muted)]">Описание</p>
            <p className="text-sm whitespace-pre-wrap">{record.description}</p>
          </div>
        )}

        {/* AI analysis */}
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

        {/* Action buttons: Edit + AI */}
        <div className="flex flex-wrap gap-2">
          {canModify && (
            <Button variant="secondary" size="sm" onClick={startEditing}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Редактировать
            </Button>
          )}

          {(!record.ai_analysis || aiError) && (
            <Button
              variant="secondary"
              size="sm"
              loading={analyzingAi}
              onClick={handleRequestAiAnalysis}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {analyzingAi ? "Анализ..." : record.ai_analysis ? "Повторить AI-анализ" : "AI-анализ"}
            </Button>
          )}
        </div>

        {aiError && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
            <p className="text-xs text-amber-400">{aiError}</p>
          </div>
        )}

        {/* Attachments */}
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

        {/* Timestamps */}
        <div className="flex gap-4 text-xs text-[var(--muted)] border-t border-[var(--border)] pt-3">
          <span>Создано: {new Date(record.created_at).toLocaleString("ru-RU")}</span>
          <span>Обновлено: {new Date(record.updated_at).toLocaleString("ru-RU")}</span>
        </div>

        {/* Delete button */}
        {canModify && (
          <div className="border-t border-[var(--border)] pt-3">
            <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Удалить запись
            </Button>
          </div>
        )}
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
