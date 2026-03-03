import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api-helpers";

// GET /api/conditions
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return apiError("Не авторизован", "AUTH_REQUIRED", 401);
    }

    const { searchParams } = request.nextUrl;
    const conditionType = searchParams.get("type");
    const status = searchParams.get("status");
    const userId = searchParams.get("user_id");

    const targetUserId = userId || user.id;

    let query = supabase
      .from("health_conditions")
      .select("*")
      .eq("user_id", targetUserId)
      .order("created_at", { ascending: false });

    if (conditionType) {
      query = query.eq("condition_type", conditionType);
    }

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
      return apiError(error.message, "SERVER_ERROR", 500);
    }

    return NextResponse.json({ conditions: data || [] });
  } catch {
    return apiError("Ошибка сервера", "SERVER_ERROR", 500);
  }
}

// POST /api/conditions
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return apiError("Не авторизован", "AUTH_REQUIRED", 401);
    }

    const body = await request.json();
    const {
      name, condition_type, status, severity,
      diagnosed_at, resolved_at, diagnosed_by, icd_code,
      notes, symptoms, related_medications,
    } = body;

    if (!name || !condition_type || !status) {
      return apiError("Обязательные поля: name, condition_type, status", "VALIDATION_ERROR", 400);
    }

    const { data, error } = await supabase
      .from("health_conditions")
      .insert({
        user_id: user.id,
        name,
        condition_type,
        status,
        severity: severity || null,
        diagnosed_at: diagnosed_at || null,
        resolved_at: resolved_at || null,
        diagnosed_by: diagnosed_by || null,
        icd_code: icd_code || null,
        notes: notes || null,
        symptoms: symptoms || [],
        related_medications: related_medications || [],
      })
      .select()
      .single();

    if (error) {
      return apiError(error.message, "SERVER_ERROR", 500);
    }

    return NextResponse.json({ condition: data });
  } catch {
    return apiError("Ошибка сервера", "SERVER_ERROR", 500);
  }
}

// PATCH /api/conditions
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

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("health_conditions")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return apiError(error.message, "SERVER_ERROR", 500);
    }

    return NextResponse.json({ condition: data });
  } catch {
    return apiError("Ошибка сервера", "SERVER_ERROR", 500);
  }
}

// DELETE /api/conditions
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
      .from("health_conditions")
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
