import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAnthropicClient } from "@/lib/ai/anthropic";
import { CHAT_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { checkRateLimit } from "@/lib/api-helpers";

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) {
      console.error("[chat] Auth error:", authError.message);
    }

    if (!user) {
      return new Response(
        JSON.stringify({ error: "Не авторизован. Войдите в систему заново.", code: "AUTH_REQUIRED" }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }

    // Rate limiting
    const rl = checkRateLimit(user.id, "ai_chat", 10);
    if (!rl.allowed) {
      return new Response(
        JSON.stringify({ error: "Слишком много запросов. Подождите минуту.", code: "RATE_LIMIT" }),
        { status: 429, headers: { "Content-Type": "application/json" } },
      );
    }

    const { message, context_user_id } = await request.json();

    if (!message || typeof message !== "string") {
      return new Response(
        JSON.stringify({ error: "Сообщение обязательно", code: "VALIDATION_ERROR" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    console.log("[chat] Message from user:", user.id, "length:", message.length);

    // Determine which patient's context to use
    let targetUserId = user.id;

    if (context_user_id && context_user_id !== user.id) {
      const { data: callerProfile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (callerProfile?.role !== "admin") {
        return new Response(
          JSON.stringify({ error: "Нет доступа к данным другого пользователя" }),
          { status: 403, headers: { "Content-Type": "application/json" } },
        );
      }
      targetUserId = context_user_id;
      console.log("[chat] Admin viewing context of user:", targetUserId);
    }

    // Load patient context
    const contextString = await buildPatientContext(supabase, targetUserId);

    // Build system prompt with context
    const systemPrompt = CHAT_SYSTEM_PROMPT.replace("{context}", contextString);

    // Load recent chat history for conversation continuity
    const { data: chatHistory } = await supabase
      .from("chat_messages")
      .select("role, content")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(20);

    // Build messages array
    const messages: { role: "user" | "assistant"; content: string }[] = [];
    for (const msg of chatHistory || []) {
      messages.push({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      });
    }
    messages.push({ role: "user", content: message });

    // Save user message BEFORE streaming
    const { error: insertError } = await supabase.from("chat_messages").insert({
      user_id: user.id,
      role: "user",
      content: message,
      context_user_id: targetUserId,
    });

    if (insertError) {
      console.warn("[chat] Failed to save user message:", insertError.message);
    }

    // Get Anthropic client (will throw with clear message if API key missing)
    let client;
    try {
      client = getAnthropicClient();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[chat] Anthropic client error:", msg);
      return new Response(
        JSON.stringify({ error: "AI-сервис не настроен. Обратитесь к администратору.", code: "AI_UNAVAILABLE" }),
        { status: 503, headers: { "Content-Type": "application/json" } },
      );
    }

    // Stream response
    console.log("[chat] Calling Claude API, messages:", messages.length);

    const stream = client.messages.stream({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2048,
      system: systemPrompt,
      messages,
    });

    let fullResponse = "";

    const readableStream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              const text = event.delta.text;
              fullResponse += text;
              controller.enqueue(encoder.encode(text));
            }
          }

          console.log("[chat] Stream complete, response length:", fullResponse.length);

          // Save assistant message AFTER stream completes
          const { error: saveError } = await supabase.from("chat_messages").insert({
            user_id: user.id,
            role: "assistant",
            content: fullResponse,
            context_user_id: targetUserId,
          });

          if (saveError) {
            console.warn("[chat] Failed to save assistant message:", saveError.message);
          }

          controller.close();
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error("[chat] Stream error:", msg);
          // Send error text to client so they see something
          controller.enqueue(encoder.encode(`\n\n[Ошибка: ${msg}]`));
          controller.close();
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[chat] Error:", message);

    let userMessage = `Ошибка чата: ${message}`;
    let code = "SERVER_ERROR";
    if (message.includes("ANTHROPIC_API_KEY")) {
      userMessage = "AI-сервис не настроен. Обратитесь к администратору.";
      code = "AI_UNAVAILABLE";
    }

    return new Response(
      JSON.stringify({ error: userMessage, code }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buildPatientContext(supabase: any, userId: string): Promise<string> {
  const parts: string[] = [];

  // Profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, date_of_birth, gender, blood_type, allergies, chronic_conditions, height_cm, weight_kg")
    .eq("id", userId)
    .single();

  if (profile) {
    parts.push("== Профиль пациента ==");
    if (profile.full_name) parts.push(`Имя: ${profile.full_name}`);
    if (profile.date_of_birth) parts.push(`Дата рождения: ${profile.date_of_birth}`);
    if (profile.gender) parts.push(`Пол: ${profile.gender}`);
    if (profile.blood_type) parts.push(`Группа крови: ${profile.blood_type}`);
    if (profile.allergies) parts.push(`Аллергии: ${profile.allergies}`);
    if (profile.chronic_conditions) parts.push(`Хронические заболевания: ${profile.chronic_conditions}`);
    if (profile.height_cm) parts.push(`Рост: ${profile.height_cm} см`);
    if (profile.weight_kg) parts.push(`Вес: ${profile.weight_kg} кг`);
    if (profile.height_cm && profile.weight_kg) {
      const heightM = profile.height_cm / 100;
      const bmi = (profile.weight_kg / (heightM * heightM)).toFixed(1);
      parts.push(`ИМТ: ${bmi}`);
    }
  }

  // Weight history (last 10)
  const { data: weightHistory } = await supabase
    .from("weight_history")
    .select("weight_kg, recorded_at")
    .eq("user_id", userId)
    .order("recorded_at", { ascending: false })
    .limit(10);

  if (weightHistory && weightHistory.length > 0) {
    parts.push("\n== История веса ==");
    for (const w of weightHistory) {
      parts.push(`[${w.recorded_at}] ${w.weight_kg} кг`);
    }
  }

  // Active medications
  const { data: activeMeds } = await supabase
    .from("medications")
    .select("name, type, dosage, frequency, frequency_detail, reason, started_at, prescribed_by")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("started_at", { ascending: false });

  if (activeMeds && activeMeds.length > 0) {
    const freqLabels: Record<string, string> = {
      daily_1: "ежедневно", daily_2: "2 раза/день", daily_3: "3 раза/день",
      weekly: "еженедельно", as_needed: "по необходимости", other: "другое",
    };
    parts.push("\n== Текущие препараты ==");
    for (const m of activeMeds) {
      let line = `- ${m.name}`;
      if (m.dosage) line += `, ${m.dosage}`;
      line += `, ${freqLabels[m.frequency] || m.frequency}`;
      if (m.frequency_detail) line += ` (${m.frequency_detail})`;
      line += `, с ${m.started_at}`;
      if (m.prescribed_by) line += ` (${m.prescribed_by})`;
      if (m.reason) line += ` — ${m.reason}`;
      parts.push(line);
    }
  }

  // Recently ended medications (last 6 months)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const { data: endedMeds } = await supabase
    .from("medications")
    .select("name, type, dosage, frequency, reason, started_at, ended_at, prescribed_by")
    .eq("user_id", userId)
    .eq("is_active", false)
    .gte("ended_at", sixMonthsAgo.toISOString().split("T")[0])
    .order("ended_at", { ascending: false })
    .limit(20);

  if (endedMeds && endedMeds.length > 0) {
    const freqLabels: Record<string, string> = {
      daily_1: "ежедневно", daily_2: "2 раза/день", daily_3: "3 раза/день",
      weekly: "еженедельно", as_needed: "по необходимости", other: "другое",
    };
    parts.push("\n== Завершённые препараты (последние 6 мес.) ==");
    for (const m of endedMeds) {
      let line = `- ${m.name}`;
      if (m.dosage) line += `, ${m.dosage}`;
      line += `, ${freqLabels[m.frequency] || m.frequency}`;
      line += `, ${m.started_at} — ${m.ended_at}`;
      if (m.prescribed_by) line += ` (${m.prescribed_by})`;
      if (m.reason) line += ` — ${m.reason}`;
      parts.push(line);
    }
  }

  // Health conditions
  interface ConditionRow {
    name: string; condition_type: string; status: string; severity: string | null;
    diagnosed_at: string | null; resolved_at: string | null; diagnosed_by: string | null;
    symptoms: string[] | null; notes: string | null;
  }
  const { data: rawConditions } = await supabase
    .from("health_conditions")
    .select("name, condition_type, status, severity, diagnosed_at, resolved_at, diagnosed_by, symptoms, notes")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  const allConditions = (rawConditions || []) as ConditionRow[];

  if (allConditions.length > 0) {
    const severityLabels: Record<string, string> = { mild: "лёгкая", moderate: "умеренная", severe: "тяжёлая" };
    const statusLabels: Record<string, string> = { active: "активно", remission: "ремиссия", monitoring: "наблюдение", resolved: "вылечено" };

    const chronicActive = allConditions.filter((c) => c.condition_type === "chronic" && c.status !== "resolved");
    const acuteActive = allConditions.filter((c) => c.condition_type === "acute" && c.status === "active");
    const riskFactors = allConditions.filter((c) => c.condition_type === "risk_factor");

    // Recently resolved (last year)
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const recentResolved = allConditions.filter(
      (c) => c.status === "resolved" && c.resolved_at && new Date(c.resolved_at) >= oneYearAgo
    );

    if (chronicActive.length > 0) {
      parts.push("\n== Хронические заболевания ==");
      for (const c of chronicActive) {
        let line = `- ${c.name}, ${statusLabels[c.status] || c.status}`;
        if (c.severity) line += `, ${severityLabels[c.severity] || c.severity}`;
        if (c.diagnosed_at) line += `, диагн. ${c.diagnosed_at}`;
        if (c.diagnosed_by) line += ` (${c.diagnosed_by})`;
        if (c.symptoms && c.symptoms.length > 0) line += `, симптомы: ${c.symptoms.join(", ")}`;
        parts.push(line);
      }
    }

    if (acuteActive.length > 0) {
      parts.push("\n== Текущие острые заболевания ==");
      for (const c of acuteActive) {
        let line = `- ${c.name}`;
        if (c.severity) line += `, ${severityLabels[c.severity] || c.severity}`;
        if (c.diagnosed_at) line += `, с ${c.diagnosed_at}`;
        if (c.symptoms && c.symptoms.length > 0) line += `, симптомы: ${c.symptoms.join(", ")}`;
        parts.push(line);
      }
    }

    if (riskFactors.length > 0) {
      parts.push("\n== Факторы риска ==");
      for (const c of riskFactors) {
        let line = `- ${c.name}`;
        if (c.notes) line += `: ${c.notes}`;
        parts.push(line);
      }
    }

    if (recentResolved.length > 0) {
      parts.push("\n== Перенесённые заболевания (последний год) ==");
      for (const c of recentResolved) {
        let line = `- ${c.name}`;
        if (c.diagnosed_at) line += `, ${c.diagnosed_at}`;
        if (c.resolved_at) line += ` — ${c.resolved_at}`;
        line += ", вылечено";
        parts.push(line);
      }
    }
  }

  // Recent medical records (last 50)
  const { data: records } = await supabase
    .from("medical_records")
    .select("title, record_type, record_date, description, doctor_name, status, ai_analysis, tags")
    .eq("user_id", userId)
    .order("record_date", { ascending: false })
    .limit(50);

  if (records && records.length > 0) {
    parts.push("\n== Последние медицинские записи ==");
    for (const r of records) {
      const line = `[${r.record_date}] ${r.title} (${r.record_type}, ${r.status})`;
      parts.push(line);
      if (r.ai_analysis) parts.push(`  AI-анализ: ${r.ai_analysis}`);
      if (r.description) {
        const desc = r.description.length > 200 ? r.description.slice(0, 200) + "..." : r.description;
        parts.push(`  Описание: ${desc}`);
      }
    }
  }

  // Recent health metrics (last 50)
  const { data: metrics } = await supabase
    .from("health_metrics")
    .select("metric_name, metric_value, unit, status, measured_at")
    .eq("user_id", userId)
    .order("measured_at", { ascending: false })
    .limit(50);

  if (metrics && metrics.length > 0) {
    parts.push("\n== Последние показатели здоровья ==");
    for (const m of metrics) {
      parts.push(`[${m.measured_at}] ${m.metric_name}: ${m.metric_value}${m.unit ? ` ${m.unit}` : ""} (${m.status})`);
    }
  }

  // Latest health survey
  const { data: surveys } = await supabase
    .from("health_surveys")
    .select("total_score, category_scores, risk_areas, ai_analysis, answers, completed_at")
    .eq("user_id", userId)
    .order("completed_at", { ascending: false })
    .limit(3);

  if (surveys && surveys.length > 0) {
    parts.push("\n== Результаты опросников самочувствия ==");
    for (const s of surveys) {
      const scores = s.category_scores as Record<string, number>;
      const categoryStr = Object.entries(scores)
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ");
      parts.push(`[${s.completed_at}] Общий балл: ${s.total_score}/100 (${categoryStr})`);
      if (s.risk_areas && s.risk_areas.length > 0) {
        parts.push(`  Зоны риска: ${s.risk_areas.join(", ")}`);
      }
      // Extract notes from answers (new format: {q1: {score, note}})
      if (s.answers && typeof s.answers === "object") {
        const answersObj = s.answers as Record<string, { score?: number; note?: string } | number>;
        const notes: string[] = [];
        for (const [key, val] of Object.entries(answersObj)) {
          if (typeof val === "object" && val?.note) {
            notes.push(`${key}: ${val.note}`);
          }
        }
        if (notes.length > 0) {
          parts.push(`  Уточнения пациента: ${notes.join("; ")}`);
        }
      }
      if (s.ai_analysis) {
        const short = s.ai_analysis.length > 300 ? s.ai_analysis.slice(0, 300) + "..." : s.ai_analysis;
        parts.push(`  AI-анализ: ${short}`);
      }
    }
  }

  if (parts.length === 0) {
    return "Медицинская история пациента пока пуста.";
  }

  return parts.join("\n");
}
