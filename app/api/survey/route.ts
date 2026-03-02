import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api-helpers";

// POST /api/survey — сохранить результаты опросника
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return apiError("Не авторизован", "AUTH_REQUIRED", 401);
    }

    const body = await request.json();
    const { answers, category_scores, total_score, risk_areas } = body;

    if (!answers || !category_scores || total_score === undefined) {
      return apiError("Обязательные поля: answers, category_scores, total_score", "VALIDATION_ERROR", 400);
    }

    const { data: survey, error } = await supabase
      .from("health_surveys")
      .insert({
        user_id: user.id,
        answers,
        category_scores,
        total_score,
        risk_areas: risk_areas || [],
      })
      .select()
      .single();

    if (error) {
      return apiError(error.message, "SERVER_ERROR", 500);
    }

    return NextResponse.json({ survey });
  } catch {
    return apiError("Ошибка сервера", "SERVER_ERROR", 500);
  }
}

// GET /api/survey — получить историю опросников
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return apiError("Не авторизован", "AUTH_REQUIRED", 401);
    }

    const { searchParams } = request.nextUrl;
    const userId = searchParams.get("user_id");
    const limit = parseInt(searchParams.get("limit") || "20");

    let query = supabase
      .from("health_surveys")
      .select("id, total_score, category_scores, risk_areas, ai_analysis, completed_at")
      .order("completed_at", { ascending: false })
      .limit(limit);

    if (userId) {
      query = query.eq("user_id", userId);
    } else {
      query = query.eq("user_id", user.id);
    }

    const { data: surveys, error } = await query;

    if (error) {
      return apiError(error.message, "SERVER_ERROR", 500);
    }

    return NextResponse.json({ surveys: surveys || [] });
  } catch {
    return apiError("Ошибка сервера", "SERVER_ERROR", 500);
  }
}
