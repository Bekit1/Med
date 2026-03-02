import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { analyzeRecord, getMediaType } from "@/lib/ai/analyze";
import { apiError, checkRateLimit } from "@/lib/api-helpers";
import type { Attachment } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error("[analyze] Auth error:", authError.message);
    }

    if (!user) {
      return apiError("Не авторизован. Войдите в систему заново.", "AUTH_REQUIRED", 401);
    }

    // Rate limiting
    const rl = checkRateLimit(user.id, "ai_analyze", 10);
    if (!rl.allowed) {
      return apiError("Слишком много запросов. Подождите минуту.", "RATE_LIMIT", 429);
    }

    const body = await request.json();
    const { record_id } = body;

    if (!record_id) {
      return apiError("record_id обязателен", "VALIDATION_ERROR", 400);
    }

    console.log("[analyze] Starting analysis for record:", record_id, "user:", user.id);

    // Load the record
    const { data: record, error: recordError } = await supabase
      .from("medical_records")
      .select("*")
      .eq("id", record_id)
      .single();

    if (recordError || !record) {
      console.error("[analyze] Record not found:", record_id, recordError?.message);
      return apiError("Запись не найдена", "RECORD_NOT_FOUND", 404);
    }

    // Load attachments
    const { data: attachments } = await supabase
      .from("attachments")
      .select("*")
      .eq("record_id", record_id);

    // Download and encode each supported attachment
    const attachmentData: {
      attachment: Attachment;
      base64: string;
      mediaType: "application/pdf" | "image/png" | "image/jpeg" | "image/webp";
    }[] = [];

    for (const att of (attachments as Attachment[]) || []) {
      const mediaType = getMediaType(att.file_name);
      if (!mediaType) {
        console.log("[analyze] Skipping unsupported file type:", att.file_name);
        continue;
      }

      const { data: fileData, error: downloadError } = await supabase.storage
        .from("medical-files")
        .download(att.storage_path);

      if (downloadError || !fileData) {
        console.warn("[analyze] Failed to download attachment:", att.file_name, downloadError?.message);
        continue;
      }

      const arrayBuffer = await fileData.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");

      attachmentData.push({ attachment: att, base64, mediaType });
      console.log("[analyze] Loaded attachment:", att.file_name, mediaType);
    }

    // Build text content from record
    const textParts = [record.title];
    if (record.description) textParts.push(record.description);
    if (record.doctor_name) textParts.push(`Врач: ${record.doctor_name}`);
    if (record.clinic_name) textParts.push(`Клиника: ${record.clinic_name}`);
    const textContent = textParts.join("\n");

    // Run AI analysis
    console.log("[analyze] Calling Claude API with", attachmentData.length, "attachments");
    const result = await analyzeRecord(textContent, attachmentData);
    console.log("[analyze] Analysis complete, status:", result.status, "findings:", result.findings.length);

    // Format analysis and recommendations as readable strings for DB
    const analysisText = result.summary;
    const recommendationsText =
      result.recommendations.length > 0
        ? result.recommendations.join("\n• ")
        : null;

    // Determine the effective date — document_date takes priority over record_date
    let effectiveDate = record.record_date;
    if (result.document_date) {
      console.log("[analyze] Document date extracted:", result.document_date, "— updating record date");
      effectiveDate = result.document_date;
    }

    // Build record update payload
    const recordUpdate: Record<string, unknown> = {
      ai_analysis: analysisText,
      ai_recommendations: recommendationsText
        ? `• ${recommendationsText}`
        : null,
      status: result.status,
      tags: result.tags.length > 0 ? result.tags : record.tags,
    };

    // Update record_date if document_date was extracted
    if (result.document_date) {
      recordUpdate.record_date = result.document_date;
    }

    // Update the medical record
    const { error: updateError } = await supabase
      .from("medical_records")
      .update(recordUpdate)
      .eq("id", record_id);

    if (updateError) {
      console.error("[analyze] Failed to update record:", updateError.message);
    }

    // Save numeric findings as health_metrics
    for (const finding of result.findings) {
      const numericValue = parseFloat(finding.value || "");
      if (isNaN(numericValue)) continue;

      const { error: metricError } = await supabase.from("health_metrics").insert({
        user_id: record.user_id,
        record_id: record_id,
        metric_name: finding.name,
        metric_value: numericValue,
        unit: finding.unit || null,
        reference_min: finding.reference_min,
        reference_max: finding.reference_max,
        status: finding.status,
        measured_at: effectiveDate,
      });

      if (metricError) {
        console.warn("[analyze] Failed to save metric:", finding.name, metricError.message);
      }
    }

    // Return in format expected by RecordDetailModal
    return NextResponse.json({
      analysis: analysisText,
      recommendations: recommendationsText
        ? `• ${recommendationsText}`
        : null,
      document_date: result.document_date,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[analyze] Error:", message);

    if (message.includes("ANTHROPIC_API_KEY")) {
      return apiError("AI-сервис не настроен. Обратитесь к администратору.", "AI_UNAVAILABLE", 503);
    }

    if (message.includes("401") || message.includes("authentication")) {
      return apiError("Ошибка авторизации AI-сервиса. Проверьте API-ключ.", "AI_UNAVAILABLE", 503);
    }

    if (message.includes("rate") || message.includes("429")) {
      return apiError("AI-сервис перегружен. Попробуйте через минуту.", "RATE_LIMIT", 429);
    }

    return apiError(`Ошибка анализа: ${message}`, "ANALYSIS_ERROR", 500);
  }
}
