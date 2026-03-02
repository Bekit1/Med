-- ============================================================
-- Family Health — Supabase Schema
-- Выполните этот файл в Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. Таблица profiles (расширение auth.users)
-- ============================================================
CREATE TABLE profiles (
  id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name       text NOT NULL,
  role            text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  date_of_birth   date,
  gender          text,
  blood_type      text,
  allergies       text,
  chronic_conditions text,
  avatar_url      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. Вспомогательная функция: проверка роли админа
--    (создаётся ПОСЛЕ таблицы profiles, т.к. ссылается на неё)
-- ============================================================
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Пользователь видит свой профиль
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (id = auth.uid());

-- Админ видит все профили
CREATE POLICY "profiles_select_admin" ON profiles
  FOR SELECT USING (is_admin() = true);

-- Пользователь редактирует свой профиль
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (id = auth.uid());

-- Админ редактирует все профили
CREATE POLICY "profiles_update_admin" ON profiles
  FOR UPDATE USING (is_admin() = true);

-- Вставка — только через триггер (service role) или сам пользователь
CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT WITH CHECK (id = auth.uid());


-- ============================================================
-- 3. Таблица medical_records
-- ============================================================
CREATE TABLE medical_records (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  record_type         text NOT NULL CHECK (record_type IN ('analysis', 'visit', 'prescription', 'note', 'vaccination')),
  title               text NOT NULL,
  description         text,
  record_date         date NOT NULL,
  doctor_name         text,
  clinic_name         text,
  status              text NOT NULL DEFAULT 'normal' CHECK (status IN ('normal', 'warning', 'attention')),
  ai_analysis         text,
  ai_recommendations  text,
  tags                text[] NOT NULL DEFAULT '{}',
  metadata            jsonb NOT NULL DEFAULT '{}',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE medical_records ENABLE ROW LEVEL SECURITY;

-- Пользователь видит свои записи
CREATE POLICY "records_select_own" ON medical_records
  FOR SELECT USING (user_id = auth.uid());

-- Админ видит все записи
CREATE POLICY "records_select_admin" ON medical_records
  FOR SELECT USING (is_admin() = true);

-- Пользователь создаёт записи для себя
CREATE POLICY "records_insert_own" ON medical_records
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Админ создаёт записи для любого
CREATE POLICY "records_insert_admin" ON medical_records
  FOR INSERT WITH CHECK (is_admin() = true);

-- Пользователь обновляет свои записи
CREATE POLICY "records_update_own" ON medical_records
  FOR UPDATE USING (user_id = auth.uid());

-- Админ обновляет все записи
CREATE POLICY "records_update_admin" ON medical_records
  FOR UPDATE USING (is_admin() = true);

-- Пользователь удаляет свои записи
CREATE POLICY "records_delete_own" ON medical_records
  FOR DELETE USING (user_id = auth.uid());

-- Админ удаляет все записи
CREATE POLICY "records_delete_admin" ON medical_records
  FOR DELETE USING (is_admin() = true);


-- ============================================================
-- 4. Таблица attachments
-- ============================================================
CREATE TABLE attachments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id     uuid NOT NULL REFERENCES medical_records(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  file_name     text NOT NULL,
  file_type     text,
  file_size     integer,
  storage_path  text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attachments_select_own" ON attachments
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "attachments_select_admin" ON attachments
  FOR SELECT USING (is_admin() = true);

CREATE POLICY "attachments_insert_own" ON attachments
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "attachments_insert_admin" ON attachments
  FOR INSERT WITH CHECK (is_admin() = true);

CREATE POLICY "attachments_delete_own" ON attachments
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "attachments_delete_admin" ON attachments
  FOR DELETE USING (is_admin() = true);


-- ============================================================
-- 5. Таблица chat_messages
-- ============================================================
CREATE TABLE chat_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role            text NOT NULL CHECK (role IN ('user', 'assistant')),
  content         text NOT NULL,
  context_user_id uuid REFERENCES profiles(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_select_own" ON chat_messages
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "chat_select_admin" ON chat_messages
  FOR SELECT USING (is_admin() = true);

CREATE POLICY "chat_insert_own" ON chat_messages
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "chat_insert_admin" ON chat_messages
  FOR INSERT WITH CHECK (is_admin() = true);


-- ============================================================
-- 6. Таблица health_metrics
-- ============================================================
CREATE TABLE health_metrics (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  record_id      uuid REFERENCES medical_records(id) ON DELETE SET NULL,
  metric_name    text NOT NULL,
  metric_value   numeric NOT NULL,
  unit           text,
  reference_min  numeric,
  reference_max  numeric,
  status         text NOT NULL DEFAULT 'normal' CHECK (status IN ('normal', 'low', 'high')),
  measured_at    date NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE health_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "metrics_select_own" ON health_metrics
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "metrics_select_admin" ON health_metrics
  FOR SELECT USING (is_admin() = true);

CREATE POLICY "metrics_insert_own" ON health_metrics
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "metrics_insert_admin" ON health_metrics
  FOR INSERT WITH CHECK (is_admin() = true);

CREATE POLICY "metrics_update_own" ON health_metrics
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "metrics_update_admin" ON health_metrics
  FOR UPDATE USING (is_admin() = true);

CREATE POLICY "metrics_delete_own" ON health_metrics
  FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "metrics_delete_admin" ON health_metrics
  FOR DELETE USING (is_admin() = true);


-- ============================================================
-- 7. Триггер: создание профиля при регистрации
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();


-- ============================================================
-- 8. Триггер: автообновление updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER medical_records_updated_at
  BEFORE UPDATE ON medical_records
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- 9. Storage bucket: medical-files
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('medical-files', 'medical-files', false);

-- Пользователь загружает файлы в свою папку: medical-files/{user_id}/*
CREATE POLICY "storage_insert_own" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'medical-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Пользователь читает файлы из своей папки
CREATE POLICY "storage_select_own" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'medical-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Пользователь удаляет файлы из своей папки
CREATE POLICY "storage_delete_own" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'medical-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Админ: полный доступ к бакету
CREATE POLICY "storage_admin_all" ON storage.objects
  FOR ALL USING (
    bucket_id = 'medical-files'
    AND is_admin() = true
  );


-- ============================================================
-- 10. Индексы для производительности
-- ============================================================
CREATE INDEX idx_medical_records_user_id ON medical_records(user_id);
CREATE INDEX idx_medical_records_record_date ON medical_records(record_date DESC);
CREATE INDEX idx_medical_records_record_type ON medical_records(record_type);
CREATE INDEX idx_attachments_record_id ON attachments(record_id);
CREATE INDEX idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at DESC);
CREATE INDEX idx_health_metrics_user_id ON health_metrics(user_id);
CREATE INDEX idx_health_metrics_measured_at ON health_metrics(measured_at DESC);
