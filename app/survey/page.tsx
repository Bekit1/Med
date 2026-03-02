"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/context/UserContext";
import { useToast } from "@/components/ui/Toast";
import ProtectedLayout from "@/components/layout/ProtectedLayout";
import Header from "@/components/layout/Header";
import Card from "@/components/ui/Card";
import {
  QUESTIONS,
  CATEGORIES,
  computeScores,
  getHealthLevel,
  formatResultsForAI,
  type SurveyCategory,
} from "@/lib/survey/questions";
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

type ViewMode = "intro" | "survey" | "results" | "history";

interface SurveyHistoryItem {
  id: string;
  total_score: number;
  category_scores: Record<SurveyCategory, number>;
  risk_areas: SurveyCategory[];
  ai_analysis: string | null;
  completed_at: string;
}

export default function SurveyPage() {
  const { user } = useUser();
  const { toast } = useToast();

  const [view, setView] = useState<ViewMode>("intro");
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});

  // Results
  const [categoryScores, setCategoryScores] = useState<Record<SurveyCategory, number> | null>(null);
  const [totalScore, setTotalScore] = useState(0);
  const [riskAreas, setRiskAreas] = useState<SurveyCategory[]>([]);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [savedSurveyId, setSavedSurveyId] = useState<string | null>(null);

  // History
  const [history, setHistory] = useState<SurveyHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const totalQuestions = QUESTIONS.length;
  const answeredCount = Object.keys(answers).length;
  const currentQuestion = QUESTIONS[currentStep];

  // Текущая категория для progress bar
  const currentCategory = currentQuestion?.category;
  const categoryQuestions = QUESTIONS.filter((q) => q.category === currentCategory);
  const categoryIndex = categoryQuestions.indexOf(currentQuestion);

  async function loadHistory() {
    if (!user) {
      console.log("[survey] loadHistory skipped — no user");
      return;
    }
    console.log("[survey] loadHistory called for user:", user.id);
    setHistoryLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("health_surveys")
        .select("*")
        .eq("user_id", user.id)
        .order("completed_at", { ascending: false })
        .limit(20);

      console.log("[survey] loadHistory result:", { data, error, count: data?.length });

      if (error) {
        console.error("[survey] Supabase error:", error.message, error.code);
      } else {
        setHistory((data as SurveyHistoryItem[]) || []);
      }
    } catch (err) {
      console.error("[survey] Error loading history:", err);
    }
    setHistoryLoading(false);
  }

  useEffect(() => {
    console.log("[survey] useEffect triggered, user:", user?.id ?? "null");
    if (user) loadHistory();
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleAnswer(value: number) {
    const newAnswers = { ...answers, [currentQuestion.id]: value };
    setAnswers(newAnswers);

    // Auto-advance to next question
    if (currentStep < totalQuestions - 1) {
      setTimeout(() => setCurrentStep(currentStep + 1), 200);
    }
  }

  async function handleSubmit() {
    const { categoryScores: scores, totalScore: total, riskAreas: risks } = computeScores(answers);
    setCategoryScores(scores);
    setTotalScore(total);
    setRiskAreas(risks);
    setView("results");

    // Save to DB
    try {
      const res = await fetch("/api/survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers,
          category_scores: scores,
          total_score: total,
          risk_areas: risks,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSavedSurveyId(data.survey?.id || null);
        toast("Результаты сохранены", "success");
        loadHistory();
      } else {
        toast("Ошибка сохранения результатов", "error");
      }
    } catch {
      toast("Ошибка сети", "error");
    }
  }

  async function requestAiAnalysis() {
    if (!savedSurveyId || !categoryScores) return;
    setAnalyzing(true);

    try {
      const resultsText = formatResultsForAI(answers, categoryScores, totalScore);
      const res = await fetch("/api/survey/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          survey_id: savedSurveyId,
          results_text: resultsText,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setAiAnalysis(data.analysis);
      } else {
        const errData = await res.json().catch(() => null);
        if (res.status === 429) {
          toast("Слишком много запросов. Подождите минуту.", "warning");
        } else if (res.status === 503) {
          toast("AI-ассистент временно недоступен", "warning");
        } else {
          toast(errData?.error || "Ошибка AI-анализа", "error");
        }
      }
    } catch {
      toast("Ошибка сети", "error");
    }
    setAnalyzing(false);
  }

  function startNewSurvey() {
    setAnswers({});
    setCurrentStep(0);
    setCategoryScores(null);
    setTotalScore(0);
    setRiskAreas([]);
    setAiAnalysis(null);
    setSavedSurveyId(null);
    setView("survey");
  }

  return (
    <ProtectedLayout>
      <Header title="Опросник самочувствия" description="Оценка состояния здоровья" />
      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
        {view === "intro" && (
          <IntroView
            onStart={startNewSurvey}
            onShowHistory={() => setView("history")}
            lastScore={history.length > 0 ? history[0].total_score : null}
            lastDate={history.length > 0 ? history[0].completed_at : null}
          />
        )}

        {view === "survey" && currentQuestion && (
          <SurveyView
            question={currentQuestion}
            currentStep={currentStep}
            totalQuestions={totalQuestions}
            answeredCount={answeredCount}
            answers={answers}
            categoryIndex={categoryIndex}
            categoryTotal={categoryQuestions.length}
            categoryLabel={CATEGORIES.find((c) => c.id === currentCategory)?.label || ""}
            categoryIcon={CATEGORIES.find((c) => c.id === currentCategory)?.icon || ""}
            onAnswer={handleAnswer}
            onPrev={() => setCurrentStep(Math.max(0, currentStep - 1))}
            onNext={() => setCurrentStep(Math.min(totalQuestions - 1, currentStep + 1))}
            onSubmit={handleSubmit}
            canSubmit={answeredCount === totalQuestions}
            isLast={currentStep === totalQuestions - 1}
          />
        )}

        {view === "results" && categoryScores && (
          <ResultsView
            totalScore={totalScore}
            categoryScores={categoryScores}
            riskAreas={riskAreas}
            aiAnalysis={aiAnalysis}
            analyzing={analyzing}
            onRequestAi={requestAiAnalysis}
            onNewSurvey={startNewSurvey}
            onShowHistory={() => setView("history")}
            canAnalyze={!!savedSurveyId}
          />
        )}

        {view === "history" && (
          <HistoryView
            history={history}
            loading={historyLoading}
            onBack={() => setView("intro")}
            onNewSurvey={startNewSurvey}
          />
        )}
      </div>
    </ProtectedLayout>
  );
}

// ============================================
// IntroView
// ============================================
function IntroView({
  onStart,
  onShowHistory,
  lastScore,
  lastDate,
}: {
  onStart: () => void;
  onShowHistory: () => void;
  lastScore: number | null;
  lastDate: string | null;
}) {
  const level = lastScore !== null ? getHealthLevel(lastScore) : null;

  return (
    <div className="space-y-6">
      <Card>
        <div className="text-center py-6 space-y-4">
          <div className="text-4xl">📋</div>
          <h2 className="text-xl font-bold">Опросник самочувствия</h2>
          <p className="text-sm text-[var(--muted)] max-w-md mx-auto">
            25 вопросов по 5 категориям здоровья на основе валидированных медицинских инструментов.
            Занимает 3-5 минут.
          </p>

          {lastScore !== null && level && lastDate && (
            <div className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 ${level.bgColor}`}>
              <span className={`text-sm font-medium ${level.color}`}>
                Последний результат: {lastScore}/100 — {level.label}
              </span>
              <span className="text-xs text-[var(--muted)]">
                {formatDateShort(lastDate)}
              </span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              onClick={onStart}
              className="px-6 py-2.5 rounded-lg bg-emerald-500 text-white font-medium hover:bg-emerald-600 transition-colors"
            >
              Начать опрос
            </button>
            <button
              onClick={onShowHistory}
              className="px-6 py-2.5 rounded-lg border border-[var(--border)] text-sm hover:bg-white/5 transition-colors"
            >
              История опросов
            </button>
          </div>
        </div>
      </Card>

      {/* Category preview */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CATEGORIES.map((cat) => (
          <Card key={cat.id}>
            <div className="flex items-start gap-3">
              <span className="text-2xl">{cat.icon}</span>
              <div>
                <p className="text-sm font-medium">{cat.label}</p>
                <p className="text-xs text-[var(--muted)] mt-0.5">{cat.description}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ============================================
// SurveyView
// ============================================
function SurveyView({
  question,
  currentStep,
  totalQuestions,
  answeredCount,
  answers,
  categoryIndex,
  categoryTotal,
  categoryLabel,
  categoryIcon,
  onAnswer,
  onPrev,
  onNext,
  onSubmit,
  canSubmit,
  isLast,
}: {
  question: (typeof QUESTIONS)[number];
  currentStep: number;
  totalQuestions: number;
  answeredCount: number;
  answers: Record<string, number>;
  categoryIndex: number;
  categoryTotal: number;
  categoryLabel: string;
  categoryIcon: string;
  onAnswer: (value: number) => void;
  onPrev: () => void;
  onNext: () => void;
  onSubmit: () => void;
  canSubmit: boolean;
  isLast: boolean;
}) {
  const progress = ((currentStep + 1) / totalQuestions) * 100;
  const selectedValue = answers[question.id];

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div>
        <div className="flex items-center justify-between text-xs text-[var(--muted)] mb-2">
          <span>
            {categoryIcon} {categoryLabel} ({categoryIndex + 1}/{categoryTotal})
          </span>
          <span>{currentStep + 1} / {totalQuestions}</span>
        </div>
        <div className="h-2 rounded-full bg-[var(--border)] overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <Card>
        <div className="space-y-4">
          <h3 className="text-base font-medium leading-relaxed">{question.text}</h3>

          <div className="space-y-2">
            {question.options.map((option, i) => (
              <button
                key={i}
                onClick={() => onAnswer(option.value)}
                className={`
                  w-full text-left rounded-lg border px-4 py-3 text-sm transition-all
                  ${
                    selectedValue === option.value
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                      : "border-[var(--border)] hover:bg-white/5 hover:border-[var(--muted)]"
                  }
                `}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={onPrev}
          disabled={currentStep === 0}
          className="px-4 py-2 rounded-lg text-sm border border-[var(--border)] hover:bg-white/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Назад
        </button>

        <span className="text-xs text-[var(--muted)]">
          Отвечено: {answeredCount}/{totalQuestions}
        </span>

        {isLast ? (
          <button
            onClick={onSubmit}
            disabled={!canSubmit}
            className="px-5 py-2 rounded-lg text-sm font-medium bg-emerald-500 text-white hover:bg-emerald-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Завершить
          </button>
        ) : (
          <button
            onClick={onNext}
            className="px-4 py-2 rounded-lg text-sm border border-[var(--border)] hover:bg-white/5 transition-colors"
          >
            Далее
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================
// ResultsView
// ============================================
function ResultsView({
  totalScore,
  categoryScores,
  riskAreas,
  aiAnalysis,
  analyzing,
  onRequestAi,
  onNewSurvey,
  onShowHistory,
  canAnalyze,
}: {
  totalScore: number;
  categoryScores: Record<SurveyCategory, number>;
  riskAreas: SurveyCategory[];
  aiAnalysis: string | null;
  analyzing: boolean;
  onRequestAi: () => void;
  onNewSurvey: () => void;
  onShowHistory: () => void;
  canAnalyze: boolean;
}) {
  const level = getHealthLevel(totalScore);

  // Radar chart data
  const radarData = CATEGORIES.map((cat) => ({
    subject: cat.label,
    score: Math.round((categoryScores[cat.id] / cat.maxScore) * 100),
    fullMark: 100,
  }));

  return (
    <div className="space-y-6">
      {/* Total score */}
      <Card>
        <div className="text-center py-4 space-y-3">
          <p className="text-sm text-[var(--muted)]">Ваш результат</p>
          <div className={`text-5xl font-bold ${level.color}`}>{totalScore}</div>
          <div className={`inline-block rounded-full px-4 py-1 text-sm font-medium ${level.color} ${level.bgColor}`}>
            {level.label}
          </div>
          <p className="text-xs text-[var(--muted)]">из 100 возможных баллов</p>
        </div>
      </Card>

      {/* Radar chart */}
      <Card>
        <h3 className="text-sm font-medium mb-3">Профиль здоровья</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData}>
              <PolarGrid stroke="var(--border)" />
              <PolarAngleAxis dataKey="subject" tick={{ fill: "var(--muted)", fontSize: 11 }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
              <Radar
                name="Балл"
                dataKey="score"
                stroke="#10b981"
                fill="#10b981"
                fillOpacity={0.2}
                strokeWidth={2}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Category breakdown */}
      <Card>
        <h3 className="text-sm font-medium mb-3">По категориям</h3>
        <div className="space-y-3">
          {CATEGORIES.map((cat) => {
            const score = categoryScores[cat.id];
            const pct = Math.round((score / cat.maxScore) * 100);
            const isRisk = riskAreas.includes(cat.id);
            const barColor = pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500";

            return (
              <div key={cat.id}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="flex items-center gap-2">
                    <span>{cat.icon}</span>
                    <span>{cat.label}</span>
                    {isRisk && (
                      <span className="text-[10px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">
                        Зона риска
                      </span>
                    )}
                  </span>
                  <span className="text-[var(--muted)]">{score}/{cat.maxScore} ({pct}%)</span>
                </div>
                <div className="h-2 rounded-full bg-[var(--border)] overflow-hidden">
                  <div
                    className={`h-full rounded-full ${barColor} transition-all`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* AI Analysis */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium">AI-анализ результатов</h3>
          {!aiAnalysis && canAnalyze && (
            <button
              onClick={onRequestAi}
              disabled={analyzing}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500 text-white hover:bg-emerald-600 transition-colors disabled:opacity-50"
            >
              {analyzing ? "Анализ..." : "Получить анализ"}
            </button>
          )}
        </div>

        {analyzing && (
          <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
            <div className="h-4 w-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            AI анализирует ваши ответы...
          </div>
        )}

        {aiAnalysis && (
          <div
            className="prose prose-invert prose-sm max-w-none text-sm leading-relaxed"
            dangerouslySetInnerHTML={{ __html: formatMarkdown(aiAnalysis) }}
          />
        )}

        {!aiAnalysis && !analyzing && !canAnalyze && (
          <p className="text-sm text-[var(--muted)]">
            AI-анализ будет доступен после сохранения результатов.
          </p>
        )}
      </Card>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <button
          onClick={onNewSurvey}
          className="px-5 py-2 rounded-lg text-sm font-medium bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
        >
          Пройти снова
        </button>
        <button
          onClick={onShowHistory}
          className="px-5 py-2 rounded-lg text-sm border border-[var(--border)] hover:bg-white/5 transition-colors"
        >
          История опросов
        </button>
      </div>
    </div>
  );
}

// ============================================
// HistoryView
// ============================================
function HistoryView({
  history,
  loading,
  onBack,
  onNewSurvey,
}: {
  history: SurveyHistoryItem[];
  loading: boolean;
  onBack: () => void;
  onNewSurvey: () => void;
}) {
  // Chart data — reverse for chronological order
  const chartData = [...history]
    .reverse()
    .map((s) => ({
      date: formatDateShort(s.completed_at),
      score: s.total_score,
    }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
        >
          &larr; Назад
        </button>
        <button
          onClick={onNewSurvey}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-500 text-white hover:bg-emerald-600 transition-colors"
        >
          Новый опрос
        </button>
      </div>

      {loading ? (
        <Card>
          <div className="animate-pulse space-y-3 py-8">
            <div className="h-4 w-32 mx-auto rounded bg-[var(--border)]" />
            <div className="h-40 rounded bg-[var(--border)]" />
          </div>
        </Card>
      ) : history.length === 0 ? (
        <Card>
          <div className="text-center py-8">
            <div className="text-3xl mb-3">📋</div>
            <p className="text-sm">Вы ещё не проходили опросник</p>
            <p className="text-xs text-[var(--muted)] mt-1">Пройдите первый опрос для отслеживания динамики</p>
          </div>
        </Card>
      ) : (
        <>
          {/* Trend chart */}
          {chartData.length >= 2 && (
            <Card>
              <h3 className="text-sm font-medium mb-3">Динамика здоровья</h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="date" tick={{ fill: "var(--muted)", fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fill: "var(--muted)", fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                        fontSize: 12,
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={{ fill: "#10b981", r: 4 }}
                      name="Балл"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {/* History table */}
          <Card>
            <h3 className="text-sm font-medium mb-3">Все опросы</h3>
            <div className="space-y-2">
              {history.map((s) => {
                const lvl = getHealthLevel(s.total_score);
                return (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-lg border border-[var(--border)] px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`text-lg font-bold ${lvl.color}`}>{s.total_score}</div>
                      <div>
                        <p className={`text-sm font-medium ${lvl.color}`}>{lvl.label}</p>
                        <p className="text-xs text-[var(--muted)]">{formatDateFull(s.completed_at)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {s.risk_areas.length > 0 && (
                        <span className="text-[10px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">
                          {s.risk_areas.length} зон(ы) риска
                        </span>
                      )}
                      {s.ai_analysis && (
                        <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                          AI
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

// ============================================
// Helpers
// ============================================
function formatDateShort(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
  });
}

function formatDateFull(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/^### (.*$)/gm, '<h3 class="text-base font-semibold mt-3 mb-1">$1</h3>')
    .replace(/^## (.*$)/gm, '<h2 class="text-base font-semibold mt-3 mb-1">$1</h2>')
    .replace(/^- (.*$)/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/^\d+\. (.*$)/gm, '<li class="ml-4 list-decimal">$1</li>')
    .replace(/\n/g, "<br>");
}
