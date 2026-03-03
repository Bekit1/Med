import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api-helpers";

// GET /api/medications — список препаратов пользователя
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return apiError("Не авторизован", "AUTH_REQUIRED", 401);
    }

    const { searchParams } = request.nextUrl;
    const active = searchParams.get("active"); // "true", "false", or null (all)
    const userId = searchParams.get("user_id");

    const targetUserId = userId || user.id;

    let query = supabase
      .from("medications")
      .select("*")
      .eq("user_id", targetUserId)
      .order("is_active", { ascending: false })
      .order("started_at", { ascending: false });

    if (active === "true") {
      query = query.eq("is_active", true);
    } else if (active === "false") {
      query = query.eq("is_active", false);
    }

    const { data, error } = await query;

    if (error) {
      return apiError(error.message, "SERVER_ERROR", 500);
    }

    return NextResponse.json({ medications: data || [] });
  } catch {
    return apiError("Ошибка сервера", "SERVER_ERROR", 500);
  }
}

// POST /api/medications — добавить препарат
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return apiError("Не авторизован", "AUTH_REQUIRED", 401);
    }

    const body = await request.json();
    const { name, type, dosage, frequency, frequency_detail, reason, started_at, notes, prescribed_by } = body;

    if (!name || !type || !frequency || !started_at) {
      return apiError("Обязательные поля: name, type, frequency, started_at", "VALIDATION_ERROR", 400);
    }

    const { data, error } = await supabase
      .from("medications")
      .insert({
        user_id: user.id,
        name,
        type,
        dosage: dosage || null,
        frequency,
        frequency_detail: frequency_detail || null,
        reason: reason || null,
        started_at,
        notes: notes || null,
        prescribed_by: prescribed_by || null,
      })
      .select()
      .single();

    if (error) {
      return apiError(error.message, "SERVER_ERROR", 500);
    }

    return NextResponse.json({ medication: data });
  } catch {
    return apiError("Ошибка сервера", "SERVER_ERROR", 500);
  }
}

// PATCH /api/medications — обновить препарат
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

    // Add updated_at
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("medications")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return apiError(error.message, "SERVER_ERROR", 500);
    }

    return NextResponse.json({ medication: data });
  } catch {
    return apiError("Ошибка сервера", "SERVER_ERROR", 500);
  }
}

// DELETE /api/medications — удалить препарат
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

    const { error } = await supabase
      .from("medications")
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
