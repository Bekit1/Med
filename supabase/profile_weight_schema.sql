-- ============================================================
-- Расширение профиля: рост, вес, история веса
-- Выполните этот файл в Supabase SQL Editor
-- ============================================================

-- 1. Добавляем колонки в profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS height_cm numeric;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS weight_kg numeric;

-- 2. Таблица истории веса
CREATE TABLE IF NOT EXISTS weight_history (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  weight_kg   numeric NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE weight_history ENABLE ROW LEVEL SECURITY;

-- 3. RLS: пользователь видит свои записи
CREATE POLICY "weight_history_select_own" ON weight_history
  FOR SELECT USING (user_id = auth.uid());

-- Админ видит все записи
CREATE POLICY "weight_history_select_admin" ON weight_history
  FOR SELECT USING (is_admin() = true);

-- Пользователь создаёт свои записи
CREATE POLICY "weight_history_insert_own" ON weight_history
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- 4. Индексы
CREATE INDEX IF NOT EXISTS idx_weight_history_user_id ON weight_history(user_id);
CREATE INDEX IF NOT EXISTS idx_weight_history_recorded_at ON weight_history(user_id, recorded_at DESC);
