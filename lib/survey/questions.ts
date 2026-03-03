// ===========================================
// Опросник самочувствия — 25 вопросов, 5 категорий
// Основан на валидированных инструментах: PSQI, PHQ-2, SF-36, WHO
// ===========================================

export interface SurveyOption {
  label: string;
  value: number;
}

export interface SurveyQuestion {
  id: string;
  text: string;
  category: SurveyCategory;
  options: SurveyOption[];
}

export type SurveyCategory = "sleep" | "emotional" | "physical" | "nutrition" | "lifestyle";

/** New answer format: score + optional text note */
export interface SurveyAnswer {
  score: number;
  note: string;
}

/** Answers map — new format uses SurveyAnswer, old format used plain numbers */
export type SurveyAnswers = Record<string, SurveyAnswer>;

/** Extract numeric score from an answer value (supports both old number and new {score,note} format) */
function extractScore(val: number | SurveyAnswer): number {
  if (typeof val === "number") return val;
  return val.score;
}

/** Extract note from an answer value (returns "" for old format) */
function extractNote(val: number | SurveyAnswer): string {
  if (typeof val === "number") return "";
  return val.note || "";
}

export interface CategoryInfo {
  id: SurveyCategory;
  label: string;
  description: string;
  icon: string;
  maxScore: number;
}

export const CATEGORIES: CategoryInfo[] = [
  {
    id: "sleep",
    label: "Сон и отдых",
    description: "Качество сна и восстановления",
    icon: "🌙",
    maxScore: 20,
  },
  {
    id: "emotional",
    label: "Эмоциональное состояние",
    description: "Настроение и психологическое здоровье",
    icon: "💭",
    maxScore: 20,
  },
  {
    id: "physical",
    label: "Физическое самочувствие",
    description: "Энергия, боли и физическая активность",
    icon: "💪",
    maxScore: 20,
  },
  {
    id: "nutrition",
    label: "Питание и гидратация",
    description: "Режим питания и водный баланс",
    icon: "🥗",
    maxScore: 20,
  },
  {
    id: "lifestyle",
    label: "Образ жизни",
    description: "Активность, стресс и вредные привычки",
    icon: "🏃",
    maxScore: 20,
  },
];

export const QUESTIONS: SurveyQuestion[] = [
  // ===== СОН И ОТДЫХ (5 вопросов, макс 20) =====
  {
    id: "q1",
    text: "Как вы оцениваете качество вашего сна за последнюю неделю?",
    category: "sleep",
    options: [
      { label: "Очень плохое — постоянные проблемы с засыпанием или пробуждением", value: 0 },
      { label: "Плохое — частые нарушения сна", value: 1 },
      { label: "Удовлетворительное — иногда бывают проблемы", value: 2 },
      { label: "Хорошее — просыпаюсь отдохнувшим", value: 3 },
      { label: "Отличное — крепкий, восстанавливающий сон", value: 4 },
    ],
  },
  {
    id: "q2",
    text: "Сколько часов вы обычно спите за ночь?",
    category: "sleep",
    options: [
      { label: "Менее 5 часов", value: 0 },
      { label: "5–6 часов", value: 1 },
      { label: "6–7 часов", value: 2 },
      { label: "7–8 часов", value: 4 },
      { label: "Более 9 часов", value: 2 },
    ],
  },
  {
    id: "q3",
    text: "Как быстро вы обычно засыпаете?",
    category: "sleep",
    options: [
      { label: "Более 60 минут", value: 0 },
      { label: "30–60 минут", value: 1 },
      { label: "15–30 минут", value: 3 },
      { label: "Менее 15 минут", value: 4 },
    ],
  },
  {
    id: "q4",
    text: "Просыпаетесь ли вы ночью?",
    category: "sleep",
    options: [
      { label: "Да, 3 и более раз за ночь", value: 0 },
      { label: "Да, 1–2 раза за ночь", value: 2 },
      { label: "Редко", value: 3 },
      { label: "Нет, сплю без пробуждений", value: 4 },
    ],
  },
  {
    id: "q5",
    text: "Чувствуете ли вы сонливость днём?",
    category: "sleep",
    options: [
      { label: "Постоянно, мешает работе", value: 0 },
      { label: "Часто", value: 1 },
      { label: "Иногда, после обеда", value: 3 },
      { label: "Редко или никогда", value: 4 },
    ],
  },

  // ===== ЭМОЦИОНАЛЬНОЕ СОСТОЯНИЕ (5 вопросов, макс 20) =====
  {
    id: "q6",
    text: "Как часто за последние 2 недели вас беспокоило подавленное настроение или чувство безнадёжности?",
    category: "emotional",
    options: [
      { label: "Почти каждый день", value: 0 },
      { label: "Более половины дней", value: 1 },
      { label: "Несколько дней", value: 3 },
      { label: "Ни разу", value: 4 },
    ],
  },
  {
    id: "q7",
    text: "Как часто за последние 2 недели вы испытывали мало интереса или удовольствия от дел?",
    category: "emotional",
    options: [
      { label: "Почти каждый день", value: 0 },
      { label: "Более половины дней", value: 1 },
      { label: "Несколько дней", value: 3 },
      { label: "Ни разу", value: 4 },
    ],
  },
  {
    id: "q8",
    text: "Как вы оцениваете свой общий уровень тревожности?",
    category: "emotional",
    options: [
      { label: "Сильная тревога, мешающая повседневной жизни", value: 0 },
      { label: "Умеренная — часто переживаю", value: 1 },
      { label: "Лёгкая — иногда беспокоюсь", value: 3 },
      { label: "Минимальная или отсутствует", value: 4 },
    ],
  },
  {
    id: "q9",
    text: "Как вы справляетесь со стрессом?",
    category: "emotional",
    options: [
      { label: "Не справляюсь, стресс подавляет", value: 0 },
      { label: "С трудом, часто чувствую перегрузку", value: 1 },
      { label: "В целом справляюсь, но бывают срывы", value: 3 },
      { label: "Хорошо справляюсь, есть стратегии управления", value: 4 },
    ],
  },
  {
    id: "q10",
    text: "Насколько вы удовлетворены своими социальными контактами?",
    category: "emotional",
    options: [
      { label: "Чувствую сильное одиночество и изоляцию", value: 0 },
      { label: "Хотелось бы больше общения", value: 1 },
      { label: "В целом достаточно", value: 3 },
      { label: "Полностью удовлетворён(а)", value: 4 },
    ],
  },

  // ===== ФИЗИЧЕСКОЕ САМОЧУВСТВИЕ (5 вопросов, макс 20) =====
  {
    id: "q11",
    text: "Как вы оцениваете свой уровень энергии в течение дня?",
    category: "physical",
    options: [
      { label: "Очень низкий — постоянная усталость", value: 0 },
      { label: "Низкий — часто не хватает сил", value: 1 },
      { label: "Средний — бывают спады", value: 3 },
      { label: "Высокий — энергии хватает на весь день", value: 4 },
    ],
  },
  {
    id: "q12",
    text: "Испытываете ли вы регулярные боли (голова, спина, суставы)?",
    category: "physical",
    options: [
      { label: "Да, ежедневно, сильные", value: 0 },
      { label: "Да, часто, умеренные", value: 1 },
      { label: "Иногда, слабые", value: 3 },
      { label: "Нет, болей нет", value: 4 },
    ],
  },
  {
    id: "q13",
    text: "Как часто вы занимаетесь физической активностью (ходьба, спорт, зарядка)?",
    category: "physical",
    options: [
      { label: "Практически не занимаюсь", value: 0 },
      { label: "1–2 раза в неделю", value: 2 },
      { label: "3–4 раза в неделю", value: 3 },
      { label: "5+ раз в неделю или ежедневно", value: 4 },
    ],
  },
  {
    id: "q14",
    text: "Есть ли у вас проблемы с пищеварением (изжога, вздутие, боли в животе)?",
    category: "physical",
    options: [
      { label: "Да, постоянно", value: 0 },
      { label: "Часто", value: 1 },
      { label: "Иногда", value: 3 },
      { label: "Нет", value: 4 },
    ],
  },
  {
    id: "q15",
    text: "Как вы оцениваете свою общую физическую форму?",
    category: "physical",
    options: [
      { label: "Плохая — ограничения в повседневных действиях", value: 0 },
      { label: "Ниже среднего", value: 1 },
      { label: "Средняя — справляюсь с обычными нагрузками", value: 3 },
      { label: "Хорошая — чувствую себя в форме", value: 4 },
    ],
  },

  // ===== ПИТАНИЕ И ГИДРАТАЦИЯ (5 вопросов, макс 20) =====
  {
    id: "q16",
    text: "Сколько полноценных приёмов пищи у вас обычно в день?",
    category: "nutrition",
    options: [
      { label: "1 или менее", value: 0 },
      { label: "2 приёма пищи", value: 2 },
      { label: "3 приёма пищи", value: 4 },
      { label: "3+ с перекусами", value: 3 },
    ],
  },
  {
    id: "q17",
    text: "Как часто вы едите овощи и фрукты?",
    category: "nutrition",
    options: [
      { label: "Очень редко или никогда", value: 0 },
      { label: "1–2 раза в неделю", value: 1 },
      { label: "Через день", value: 3 },
      { label: "Каждый день", value: 4 },
    ],
  },
  {
    id: "q18",
    text: "Сколько воды вы выпиваете в день?",
    category: "nutrition",
    options: [
      { label: "Менее 2 стаканов", value: 0 },
      { label: "2–4 стакана", value: 1 },
      { label: "5–7 стаканов", value: 3 },
      { label: "8+ стаканов (около 2 литров)", value: 4 },
    ],
  },
  {
    id: "q19",
    text: "Как часто вы едите фастфуд или сильно обработанную пищу?",
    category: "nutrition",
    options: [
      { label: "Ежедневно", value: 0 },
      { label: "4–6 раз в неделю", value: 1 },
      { label: "1–3 раза в неделю", value: 3 },
      { label: "Редко или никогда", value: 4 },
    ],
  },
  {
    id: "q20",
    text: "Пропускаете ли вы завтрак?",
    category: "nutrition",
    options: [
      { label: "Почти всегда пропускаю", value: 0 },
      { label: "Часто пропускаю", value: 1 },
      { label: "Иногда", value: 3 },
      { label: "Всегда завтракаю", value: 4 },
    ],
  },

  // ===== ОБРАЗ ЖИЗНИ (5 вопросов, макс 20) =====
  {
    id: "q21",
    text: "Сколько времени в день вы проводите на свежем воздухе?",
    category: "lifestyle",
    options: [
      { label: "Почти не выхожу", value: 0 },
      { label: "Менее 30 минут", value: 1 },
      { label: "30–60 минут", value: 3 },
      { label: "Более 1 часа", value: 4 },
    ],
  },
  {
    id: "q22",
    text: "Сколько времени вы проводите за экранами (телефон, компьютер, ТВ) вне работы?",
    category: "lifestyle",
    options: [
      { label: "Более 6 часов", value: 0 },
      { label: "4–6 часов", value: 1 },
      { label: "2–4 часа", value: 3 },
      { label: "Менее 2 часов", value: 4 },
    ],
  },
  {
    id: "q23",
    text: "Употребляете ли вы алкоголь?",
    category: "lifestyle",
    options: [
      { label: "Ежедневно", value: 0 },
      { label: "Несколько раз в неделю", value: 1 },
      { label: "Редко (1–2 раза в месяц)", value: 3 },
      { label: "Не употребляю", value: 4 },
    ],
  },
  {
    id: "q24",
    text: "Курите ли вы (сигареты, вейп, кальян)?",
    category: "lifestyle",
    options: [
      { label: "Да, ежедневно", value: 0 },
      { label: "Иногда", value: 1 },
      { label: "Бросил(а) менее года назад", value: 3 },
      { label: "Не курю / бросил(а) давно", value: 4 },
    ],
  },
  {
    id: "q25",
    text: "Проходите ли вы регулярные медицинские осмотры?",
    category: "lifestyle",
    options: [
      { label: "Не помню, когда последний раз был(а) у врача", value: 0 },
      { label: "Хожу только при болезни", value: 1 },
      { label: "Раз в год прохожу базовый осмотр", value: 3 },
      { label: "Регулярно, включая профилактические обследования", value: 4 },
    ],
  },
];

// Вычислить баллы по категориям и общий балл
// Поддерживает оба формата: старый Record<string, number> и новый Record<string, SurveyAnswer>
export function computeScores(answers: Record<string, number | SurveyAnswer>): {
  categoryScores: Record<SurveyCategory, number>;
  totalScore: number;
  riskAreas: SurveyCategory[];
} {
  const categoryScores: Record<SurveyCategory, number> = {
    sleep: 0,
    emotional: 0,
    physical: 0,
    nutrition: 0,
    lifestyle: 0,
  };

  for (const q of QUESTIONS) {
    const val = answers[q.id];
    if (val !== undefined) {
      categoryScores[q.category] += extractScore(val);
    }
  }

  // Общий балл = сумма всех категорий, нормализованная к 100
  const maxTotal = CATEGORIES.reduce((sum, c) => sum + c.maxScore, 0); // 100
  const rawTotal = Object.values(categoryScores).reduce((s, v) => s + v, 0);
  const totalScore = Math.round((rawTotal / maxTotal) * 100);

  // Зоны риска: категории с баллом <= 40% от максимума
  const riskAreas: SurveyCategory[] = [];
  for (const cat of CATEGORIES) {
    const score = categoryScores[cat.id];
    if (score / cat.maxScore <= 0.4) {
      riskAreas.push(cat.id);
    }
  }

  return { categoryScores, totalScore, riskAreas };
}

// Уровень здоровья по общему баллу
export function getHealthLevel(totalScore: number): {
  label: string;
  color: string;
  bgColor: string;
} {
  if (totalScore >= 80) return { label: "Отличное", color: "text-emerald-400", bgColor: "bg-emerald-500/10" };
  if (totalScore >= 60) return { label: "Хорошее", color: "text-blue-400", bgColor: "bg-blue-500/10" };
  if (totalScore >= 40) return { label: "Удовлетворительное", color: "text-amber-400", bgColor: "bg-amber-500/10" };
  if (totalScore >= 20) return { label: "Требует внимания", color: "text-orange-400", bgColor: "bg-orange-500/10" };
  return { label: "Критическое", color: "text-red-400", bgColor: "bg-red-500/10" };
}

// Подготовить текстовое описание результатов для AI
// Поддерживает оба формата ответов
export function formatResultsForAI(
  answers: Record<string, number | SurveyAnswer>,
  categoryScores: Record<SurveyCategory, number>,
  totalScore: number,
): string {
  const lines: string[] = [];
  lines.push(`Общий балл здоровья: ${totalScore}/100`);
  lines.push("");

  for (const cat of CATEGORIES) {
    const score = categoryScores[cat.id];
    const pct = Math.round((score / cat.maxScore) * 100);
    lines.push(`${cat.label}: ${score}/${cat.maxScore} (${pct}%)`);
  }

  lines.push("");
  lines.push("Ответы на вопросы:");

  for (const q of QUESTIONS) {
    const val = answers[q.id];
    if (val !== undefined) {
      const score = extractScore(val);
      const note = extractNote(val);
      const option = q.options.find((o) => o.value === score);
      lines.push(`- ${q.text}`);
      lines.push(`  Ответ: ${option?.label || score}`);
      if (note) {
        lines.push(`  Уточнение пациента: ${note}`);
      }
    }
  }

  return lines.join("\n");
}
