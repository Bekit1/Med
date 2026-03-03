export type UserRole = "admin" | "member";

export type RecordType = "analysis" | "visit" | "prescription" | "note" | "vaccination";

export type RecordStatus = "normal" | "warning" | "attention";

export type MetricStatus = "normal" | "low" | "high";

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  date_of_birth: string | null;
  gender: string | null;
  blood_type: string | null;
  allergies: string | null;
  chronic_conditions: string | null;
  avatar_url: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  created_at: string;
  updated_at: string;
}

export interface WeightHistoryEntry {
  id: string;
  user_id: string;
  weight_kg: number;
  recorded_at: string;
  created_at: string;
}

export interface MedicalRecord {
  id: string;
  user_id: string;
  record_type: RecordType;
  title: string;
  description: string | null;
  record_date: string;
  doctor_name: string | null;
  clinic_name: string | null;
  status: RecordStatus;
  ai_analysis: string | null;
  ai_recommendations: string | null;
  tags: string[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Attachment {
  id: string;
  record_id: string;
  user_id: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  storage_path: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  context_user_id: string | null;
  created_at: string;
}

export interface HealthMetric {
  id: string;
  user_id: string;
  record_id: string | null;
  metric_name: string;
  metric_value: number;
  unit: string | null;
  reference_min: number | null;
  reference_max: number | null;
  status: MetricStatus;
  measured_at: string;
  created_at: string;
}

export type MedicationType = "medication" | "vitamin" | "supplement" | "other";

export type MedicationFrequency = "daily_1" | "daily_2" | "daily_3" | "weekly" | "as_needed" | "other";

export interface Medication {
  id: string;
  user_id: string;
  name: string;
  type: MedicationType;
  dosage: string | null;
  frequency: MedicationFrequency;
  frequency_detail: string | null;
  reason: string | null;
  started_at: string;
  ended_at: string | null;
  is_active: boolean;
  notes: string | null;
  prescribed_by: string | null;
  created_at: string;
  updated_at: string;
}

export type ConditionType = "chronic" | "acute" | "past" | "risk_factor";

export type ConditionStatus = "active" | "remission" | "resolved" | "monitoring";

export type ConditionSeverity = "mild" | "moderate" | "severe";

export interface HealthCondition {
  id: string;
  user_id: string;
  name: string;
  condition_type: ConditionType;
  status: ConditionStatus;
  severity: ConditionSeverity | null;
  diagnosed_at: string | null;
  resolved_at: string | null;
  diagnosed_by: string | null;
  icd_code: string | null;
  notes: string | null;
  symptoms: string[];
  related_medications: string[];
  created_at: string;
  updated_at: string;
}

export interface AiInsight {
  id: string;
  title: string;
  description: string;
  type: "recommendation" | "reminder" | "warning";
  created_at: string;
}
