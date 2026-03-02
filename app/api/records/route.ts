import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api-helpers";

// GET /api/records — получить записи с фильтрами и пагинацией
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return apiError("Не авторизован", "AUTH_REQUIRED", 401);
    }

    const { searchParams } = request.nextUrl;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const type = searchParams.get("type");
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const userId = searchParams.get("user_id");
    const offset = (page - 1) * limit;

    let query = supabase
      .from("medical_records")
      .select("*, attachments(id)", { count: "exact" });

    // Если указан user_id и пользователь — админ, показать записи другого пользователя
    if (userId) {
      query = query.eq("user_id", userId);
    } else {
      query = query.eq("user_id", user.id);
    }

    if (type && type !== "all") {
      query = query.eq("record_type", type);
    }

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const { data: records, error, count } = await query
      .order("record_date", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return apiError(error.message, "SERVER_ERROR", 500);
    }

    // Преобразуем: добавим attachment_count
    const recordsWithCount = (records || []).map((r) => ({
      ...r,
      attachment_count: Array.isArray(r.attachments) ? r.attachments.length : 0,
      attachments: undefined,
    }));

    return NextResponse.json({
      records: recordsWithCount,
      total: count || 0,
      page,
      limit,
    });
  } catch {
    return apiError("Ошибка сервера", "SERVER_ERROR", 500);
  }
}

// POST /api/records — создать запись
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return apiError("Не авторизован", "AUTH_REQUIRED", 401);
    }

    const body = await request.json();
    const { title, record_type, record_date, description, doctor_name, clinic_name, tags, auto_ai_analysis } = body;

    if (!title || !record_type || !record_date) {
      return apiError("Обязательные поля: title, record_type, record_date", "VALIDATION_ERROR", 400);
    }

    const { data: record, error } = await supabase
      .from("medical_records")
      .insert({
        user_id: user.id,
        title,
        record_type,
        record_date,
        description: description || null,
        doctor_name: doctor_name || null,
        clinic_name: clinic_name || null,
        tags: tags || [],
      })
      .select()
      .single();

    if (error) {
      return apiError(error.message, "SERVER_ERROR", 500);
    }

    // Если запрошен AI-анализ, отправим запрос (асинхронно, не блокируя ответ)
    if (auto_ai_analysis && record) {
      analyzeRecordAsync(record.id);
    }

    return NextResponse.json({ record });
  } catch {
    return apiError("Ошибка сервера", "SERVER_ERROR", 500);
  }
}

// PATCH /api/records — обновить запись
export async function PATCH(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return apiError("Не авторизован", "AUTH_REQUIRED", 401);
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return apiError("id обязателен", "VALIDATION_ERROR", 400);
    }

    // Ownership check: verify user owns this record (or is admin)
    const { data: existing } = await supabase
      .from("medical_records")
      .select("user_id")
      .eq("id", id)
      .single();

    if (!existing) {
      return apiError("Запись не найдена", "NOT_FOUND", 404);
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (existing.user_id !== user.id && profile?.role !== "admin") {
      return apiError("Нет доступа к этой записи", "FORBIDDEN", 403);
    }

    const { data: record, error } = await supabase
      .from("medical_records")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return apiError(error.message, "SERVER_ERROR", 500);
    }

    return NextResponse.json({ record });
  } catch {
    return apiError("Ошибка сервера", "SERVER_ERROR", 500);
  }
}

// DELETE /api/records — удалить запись (каскадно удалит attachments)
export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return apiError("Не авторизован", "AUTH_REQUIRED", 401);
    }

    const { searchParams } = request.nextUrl;
    const id = searchParams.get("id");

    if (!id) {
      return apiError("id обязателен", "VALIDATION_ERROR", 400);
    }

    // Ownership check: verify user owns this record (or is admin)
    const { data: existing } = await supabase
      .from("medical_records")
      .select("user_id")
      .eq("id", id)
      .single();

    if (!existing) {
      return apiError("Запись не найдена", "NOT_FOUND", 404);
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (existing.user_id !== user.id && profile?.role !== "admin") {
      return apiError("Нет доступа к этой записи", "FORBIDDEN", 403);
    }

    // Удалим файлы из Storage
    const { data: attachments } = await supabase
      .from("attachments")
      .select("storage_path")
      .eq("record_id", id);

    if (attachments && attachments.length > 0) {
      const paths = attachments.map((a) => a.storage_path);
      await supabase.storage.from("medical-files").remove(paths);
    }

    // Удалим связанные метрики
    await supabase.from("health_metrics").delete().eq("record_id", id);

    // Удалим запись (attachments удалятся каскадно)
    const { error } = await supabase
      .from("medical_records")
      .delete()
      .eq("id", id);

    if (error) {
      return apiError(error.message, "SERVER_ERROR", 500);
    }

    return NextResponse.json({ success: true });
  } catch {
    return apiError("Ошибка сервера", "SERVER_ERROR", 500);
  }
}

// Фоновый AI-анализ записи (analyze route сам обновляет запись в БД)
async function analyzeRecordAsync(recordId: string) {
  try {
    await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/api/ai/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ record_id: recordId }),
    });
  } catch {
    // Тихо проглатываем — фоновый процесс
  }
}
