"use client";

import { useState } from "react";
import RecordCard, { type RecordWithCount } from "./RecordCard";
import RecordDetailModal from "./RecordDetailModal";
import type { MedicalRecord } from "@/lib/types";

interface RecordListProps {
  records: RecordWithCount[];
  onRecordUpdated?: () => void;
}

export default function RecordList({ records, onRecordUpdated }: RecordListProps) {
  const [selectedRecord, setSelectedRecord] = useState<MedicalRecord | null>(null);

  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <svg className="h-12 w-12 text-[var(--muted)] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-[var(--foreground)]">Записей не найдено</p>
        <p className="text-sm text-[var(--muted)] mt-1">Попробуйте изменить фильтры или добавьте новую запись</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {records.map((record) => (
          <RecordCard
            key={record.id}
            record={record}
            onClick={() => setSelectedRecord(record)}
          />
        ))}
      </div>

      <RecordDetailModal
        record={selectedRecord}
        open={!!selectedRecord}
        onClose={() => setSelectedRecord(null)}
        onRecordUpdated={() => {
          setSelectedRecord(null);
          onRecordUpdated?.();
        }}
        onRecordDeleted={() => {
          setSelectedRecord(null);
          onRecordUpdated?.();
        }}
      />
    </>
  );
}
