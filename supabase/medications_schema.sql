-- ============================================================
-- Модуль "Препараты и добавки"
-- Выполните этот файл в Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS medications (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name             text NOT NULL,
  type             text NOT NULL CHECK (type IN ('medication', 'vitamin', 'supplement', 'other')),
  dosage           text,
  frequency        text NOT NULL CHECK (frequency IN ('daily_1', 'daily_2', 'daily_3', 'weekly', 'as_needed', 'other')),
  frequency_detail text,
  reason           text,
  started_at       date NOT NULL,
  ended_at         date,
  is_active        boolean NOT NULL DEFAULT true,
  notes            text,
  prescribed_by    text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE medications ENABLE ROW LEVEL SECURITY;

-- Пользователь видит свои записи
CREATE POLICY "medications_select_own" ON medications
  FOR SELECT USING (user_id = auth.uid());

-- Админ видит все записи
CREATE POLICY "medications_select_admin" ON medications
  FOR SELECT USING (is_admin() = true);

-- Пользователь создаёт свои записи
CREATE POLICY "medications_insert_own" ON medications
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Пользователь обновляет свои записи
CREATE POLICY "medications_update_own" ON medications
  FOR UPDATE USING (user_id = auth.uid());

-- Админ обновляет все записи
CREATE POLICY "medications_update_admin" ON medications
  FOR UPDATE USING (is_admin() = true);

-- Пользователь удаляет свои записи
CREATE POLICY "medications_delete_own" ON medications
  FOR DELETE USING (user_id = auth.uid());

-- Админ удаляет все записи
CREATE POLICY "medications_delete_admin" ON medications
  FOR DELETE USING (is_admin() = true);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_medications_user_id ON medications(user_id);
CREATE INDEX IF NOT EXISTS idx_medications_active ON medications(user_id, is_active);
