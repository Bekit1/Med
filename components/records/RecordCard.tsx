"use client";

import Badge from "@/components/ui/Badge";
import type { MedicalRecord, RecordType, RecordStatus } from "@/lib/types";

// --- Иконки типов ---
const typeIcons: Record<RecordType, React.ReactNode> = {
  analysis: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  visit: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
  prescription: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
    </svg>
  ),
  vaccination: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  note: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
};

const typeLabels: Record<RecordType, string> = {
  visit: "Приём врача",
  analysis: "Анализы",
  vaccination: "Вакцинация",
  prescription: "Рецепт",
  note: "Заметка",
};

const typeColors: Record<RecordType, string> = {
  visit: "text-blue-400 bg-blue-500/10",
  analysis: "text-emerald-400 bg-emerald-500/10",
  vaccination: "text-yellow-400 bg-yellow-500/10",
  prescription: "text-purple-400 bg-purple-500/10",
  note: "text-gray-400 bg-white/5",
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

export interface RecordWithCount extends MedicalRecord {
  attachment_count?: number;
}

interface RecordCardProps {
  record: RecordWithCount;
  onClick?: () => void;
}

export default function RecordCard({ record, onClick }: RecordCardProps) {
  return (
    <div
      onClick={onClick}
      className="
        flex gap-3 rounded-xl border border-white/[0.06] bg-[var(--card)] p-4
        hover:bg-[var(--card-hover)] transition-colors cursor-pointer
      "
    >
      {/* Иконка типа */}
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${typeColors[record.record_type]}`}>
        {typeIcons[record.record_type]}
      </div>

      {/* Контент */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-medium truncate">{record.title}</h3>
            <p className="text-xs text-[var(--muted)] mt-0.5">
              {new Date(record.record_date).toLocaleDateString("ru-RU", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
              {record.doctor_name && ` · ${record.doctor_name}`}
            </p>
          </div>
          <Badge variant={statusVariants[record.status]}>
            {statusLabels[record.status]}
          </Badge>
        </div>

        {record.description && (
          <p className="mt-1.5 text-sm text-[var(--muted)] line-clamp-2">{record.description}</p>
        )}

        {/* Нижняя строка: тип, вложения, теги */}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-xs text-[var(--muted)]">{typeLabels[record.record_type]}</span>

          {(record.attachment_count ?? 0) > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-[var(--muted)]">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              {record.attachment_count}
            </span>
          )}

          {record.ai_analysis && (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              AI
            </span>
          )}

          {record.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-white/5 px-2 py-0.5 text-xs text-[var(--muted)]">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
