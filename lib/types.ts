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
  created_at: string;
  updated_at: string;
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

export interface AiInsight {
  id: string;
  title: string;
  description: string;
  type: "recommendation" | "reminder" | "warning";
  created_at: string;
}
