"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { useUser } from "@/lib/context/UserContext";
import { createClient } from "@/lib/supabase/client";
import type { RecordType } from "@/lib/types";

const recordTypes: { value: RecordType; label: string }[] = [
  { value: "analysis", label: "Анализы" },
  { value: "visit", label: "Приём врача" },
  { value: "prescription", label: "Рецепт" },
  { value: "vaccination", label: "Вакцинация" },
  { value: "note", label: "Заметка" },
];

const ACCEPT = ".pdf,.png,.jpg,.jpeg,.heic";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 10;

export default function RecordForm() {
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [title, setTitle] = useState("");
  const [recordType, setRecordType] = useState<RecordType>("analysis");
  const [recordDate, setRecordDate] = useState(new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [autoAi, setAutoAi] = useState(false);

  // Файлы
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);

  const showDoctorFields = recordType === "visit" || recordType === "prescription";

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles).filter((f) => {
      const ext = f.name.split(".").pop()?.toLowerCase() || "";
      return ["pdf", "png", "jpg", "jpeg", "heic"].includes(ext);
    });

    // Validate file sizes
    const validFiles: File[] = [];
    for (const f of arr) {
      if (f.size > MAX_FILE_SIZE) {
        toast(`Файл "${f.name}" превышает 10 МБ`, "error");
        continue;
      }
      const ext = f.name.split(".").pop()?.toLowerCase();
      if (ext === "heic") {
        toast(`"${f.name}": HEIC не поддерживается AI-анализом`, "warning");
      }
      validFiles.push(f);
    }

    setFiles((prev) => {
      const total = prev.length + validFiles.length;
      if (total > MAX_FILES) {
        toast(`Максимум ${MAX_FILES} файлов`, "error");
        return [...prev, ...validFiles.slice(0, MAX_FILES - prev.length)];
      }
      return [...prev, ...validFiles];
    });
  }, [toast]);

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setError("");
    setLoading(true);

    try {
      // 1. Создаём запись
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const res = await fetch("/api/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          record_type: recordType,
          record_date: recordDate,
          description: description || null,
          doctor_name: showDoctorFields ? doctorName || null : null,
          clinic_name: showDoctorFields ? clinicName || null : null,
          tags,
          auto_ai_analysis: autoAi,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Ошибка создания записи");
        return;
      }

      const { record } = await res.json();

      // 2. Загружаем файлы в Storage + создаём attachments
      for (const file of files) {
        const storagePath = `${user.id}/${record.id}/${file.name}`;

        const { error: uploadError } = await supabase.storage
          .from("medical-files")
          .upload(storagePath, file);

        if (uploadError) {
          console.error("Upload error:", uploadError.message);
          toast(`Ошибка загрузки файла: ${file.name}`, "error");
          continue;
        }

        // 3. Запись в таблицу attachments
        await supabase.from("attachments").insert({
          record_id: record.id,
          user_id: user.id,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          storage_path: storagePath,
        });
      }

      toast("Запись успешно создана", "success");
      router.push("/records");
    } catch {
      setError("Произошла ошибка. Попробуйте снова.");
      toast("Ошибка создания записи", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 w-full max-w-2xl">
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Заголовок *"
          placeholder="Например: Общий анализ крови"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-[var(--muted)]">Тип записи *</label>
          <select
            value={recordType}
            onChange={(e) => setRecordType(e.target.value as RecordType)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
          >
            {recordTypes.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      <Input
        label="Дата *"
        type="date"
        value={recordDate}
        onChange={(e) => setRecordDate(e.target.value)}
        required
      />

      {/* Врач и клиника — только для визитов и рецептов */}
      {showDoctorFields && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Врач"
            placeholder="ФИО врача"
            value={doctorName}
            onChange={(e) => setDoctorName(e.target.value)}
          />
          <Input
            label="Клиника"
            placeholder="Название клиники"
            value={clinicName}
            onChange={(e) => setClinicName(e.target.value)}
          />
        </div>
      )}

      {/* Описание */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-[var(--muted)]">Описание</label>
        <textarea
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Подробности, результаты, заметки..."
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 resize-none"
        />
      </div>

      {/* Загрузка файлов — drag-and-drop */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-[var(--muted)]">Файлы (PDF, JPG, PNG, HEIC)</label>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl
            border-2 border-dashed p-4 md:p-6 transition-colors
            ${dragging
              ? "border-emerald-500 bg-emerald-500/5"
              : "border-[var(--border)] bg-[var(--card)] hover:border-emerald-500/50 hover:bg-[var(--card-hover)]"
            }
          `}
        >
          <svg className="h-8 w-8 text-[var(--muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-sm text-[var(--muted)]">
            Перетащите файлы сюда или нажмите для выбора
          </p>
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

        {/* Список выбранных файлов */}
        {files.length > 0 && (
          <div className="space-y-2 mt-2">
            {files.map((file, i) => (
              <div key={`${file.name}-${i}`} className="flex items-center justify-between rounded-lg bg-[var(--card)] border border-[var(--border)] px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <svg className="h-4 w-4 shrink-0 text-[var(--muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                  <span className="truncate text-sm">{file.name}</span>
                  <span className="shrink-0 text-xs text-[var(--muted)]">
                    {(file.size / 1024).toFixed(0)} KB
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                  className="shrink-0 text-[var(--muted)] hover:text-red-400 transition-colors"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Теги */}
      <Input
        label="Теги (через запятую)"
        placeholder="кровь, плановый, 2026"
        value={tagsInput}
        onChange={(e) => setTagsInput(e.target.value)}
      />

      {/* AI-анализ */}
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={autoAi}
          onChange={(e) => setAutoAi(e.target.checked)}
          className="h-4 w-4 rounded border-[var(--border)] bg-[var(--card)] text-emerald-500 focus:ring-emerald-500/40 accent-emerald-500"
        />
        <div>
          <p className="text-sm font-medium">Автоматический AI-анализ</p>
          <p className="text-xs text-[var(--muted)]">Claude проанализирует запись после сохранения</p>
        </div>
      </label>

      {/* Кнопки */}
      <div className="flex gap-3 pt-2">
        <Button type="submit" loading={loading}>
          Сохранить запись
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.push("/records")}>
          Отмена
        </Button>
      </div>
    </form>
  );
}
