import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiError, checkRateLimit } from "@/lib/api-helpers";
import Anthropic from "@anthropic-ai/sdk";

const SURVEY_ANALYSIS_PROMPT = `Ты — медицинский AI-ассистент. Проанализируй результаты опросника самочувствия пациента.

Результаты опросника:
{results}

На основе ответов:
1. Дай общую оценку состояния здоровья (2-3 предложения)
2. Выдели сильные стороны (что хорошо)
3. Укажи зоны, требующие внимания
4. Дай 3-5 конкретных практических рекомендаций для улучшения здоровья
5. Если есть тревожные сигналы — рекомендуй обратиться к специалисту

Формат ответа — структурированный текст на русском языке с использованием markdown.
НЕ ставь диагнозы. Давай общие рекомендации по улучшению образа жизни.`;

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return apiError("Не авторизован", "AUTH_REQUIRED", 401);
    }

    const { allowed } = checkRateLimit(user.id, "survey_analyze", 10);
    if (!allowed) {
      return apiError("Слишком много запросов. Подождите минуту.", "RATE_LIMIT", 429);
    }

    const body = await request.json();
    const { survey_id, results_text } = body;

    if (!survey_id || !results_text) {
      return apiError("Обязательные поля: survey_id, results_text", "VALIDATION_ERROR", 400);
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return apiError("AI-сервис не настроен", "AI_UNAVAILABLE", 503);
    }

    const anthropic = new Anthropic({ apiKey });

    const prompt = SURVEY_ANALYSIS_PROMPT.replace("{results}", results_text);

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });

    const analysisText = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    // Сохранить анализ в БД
    await supabase
      .from("health_surveys")
      .update({ ai_analysis: analysisText })
      .eq("id", survey_id)
      .eq("user_id", user.id);

    return NextResponse.json({ analysis: analysisText });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ошибка AI-анализа";
    if (message.includes("ANTHROPIC_API_KEY")) {
      return apiError("AI-сервис не настроен", "AI_UNAVAILABLE", 503);
    }
    return apiError("Ошибка AI-анализа", "ANALYSIS_ERROR", 500);
  }
}
