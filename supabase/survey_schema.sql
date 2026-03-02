-- ===========================================
-- Таблица: health_surveys (Опросники самочувствия)
-- ===========================================

CREATE TABLE IF NOT EXISTS health_surveys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Ответы на вопросы: { "q1": 2, "q2": 0, ... }
  answers JSONB NOT NULL DEFAULT '{}',

  -- Баллы по категориям: { "sleep": 8, "emotional": 5, ... }
  category_scores JSONB NOT NULL DEFAULT '{}',

  -- Общий балл (0-100)
  total_score INTEGER NOT NULL DEFAULT 0,

  -- AI-анализ результатов (текст)
  ai_analysis TEXT,

  -- Зоны риска: ["sleep", "physical"]
  risk_areas TEXT[] DEFAULT '{}',

  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_health_surveys_user_id ON health_surveys(user_id);
CREATE INDEX IF NOT EXISTS idx_health_surveys_completed_at ON health_surveys(completed_at DESC);

-- RLS
ALTER TABLE health_surveys ENABLE ROW LEVEL SECURITY;

-- Пользователь видит только свои опросники
CREATE POLICY "Users can view own surveys"
  ON health_surveys FOR SELECT
  USING (auth.uid() = user_id);

-- Пользователь может создавать свои опросники
CREATE POLICY "Users can insert own surveys"
  ON health_surveys FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Пользователь может обновлять свои опросники (для AI-анализа)
CREATE POLICY "Users can update own surveys"
  ON health_surveys FOR UPDATE
  USING (auth.uid() = user_id);

-- Админ может видеть все опросники
CREATE POLICY "Admins can view all surveys"
  ON health_surveys FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );
