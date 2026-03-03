-- ============================================================
-- Модуль "Болезни и состояния"
-- Выполните этот файл в Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS health_conditions (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name                text NOT NULL,
  condition_type      text NOT NULL CHECK (condition_type IN ('chronic', 'acute', 'past', 'risk_factor')),
  status              text NOT NULL CHECK (status IN ('active', 'remission', 'resolved', 'monitoring')),
  severity            text CHECK (severity IN ('mild', 'moderate', 'severe')),
  diagnosed_at        date,
  resolved_at         date,
  diagnosed_by        text,
  icd_code            text,
  notes               text,
  symptoms            text[] NOT NULL DEFAULT '{}',
  related_medications uuid[] NOT NULL DEFAULT '{}',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE health_conditions ENABLE ROW LEVEL SECURITY;

-- Пользователь видит свои записи
CREATE POLICY "conditions_select_own" ON health_conditions
  FOR SELECT USING (user_id = auth.uid());

-- Админ видит все записи
CREATE POLICY "conditions_select_admin" ON health_conditions
  FOR SELECT USING (is_admin() = true);

-- Пользователь создаёт свои записи
CREATE POLICY "conditions_insert_own" ON health_conditions
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Пользователь обновляет свои записи
CREATE POLICY "conditions_update_own" ON health_conditions
  FOR UPDATE USING (user_id = auth.uid());

-- Админ обновляет все записи
CREATE POLICY "conditions_update_admin" ON health_conditions
  FOR UPDATE USING (is_admin() = true);

-- Пользователь удаляет свои записи
CREATE POLICY "conditions_delete_own" ON health_conditions
  FOR DELETE USING (user_id = auth.uid());

-- Админ удаляет все записи
CREATE POLICY "conditions_delete_admin" ON health_conditions
  FOR DELETE USING (is_admin() = true);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_conditions_user_id ON health_conditions(user_id);
CREATE INDEX IF NOT EXISTS idx_conditions_type_status ON health_conditions(user_id, condition_type, status);
