"use client";

import ProtectedLayout from "@/components/layout/ProtectedLayout";
import Header from "@/components/layout/Header";
import RecordForm from "@/components/records/RecordForm";

export default function NewRecordPage() {
  return (
    <ProtectedLayout>
      <Header title="Новая запись" description="Добавьте медицинскую запись" />
      <div className="p-6">
        <RecordForm />
      </div>
    </ProtectedLayout>
  );
}
