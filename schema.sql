-- GlucoFit Web v2.2 — Cloudflare D1 数据库初始化脚本（中心化托管）
-- 用法（任选其一）：
--   1. wrangler CLI:  npx wrangler d1 execute glucofit --remote --file=./schema.sql
--   2. Cloudflare Dashboard -> Storage & Databases -> D1 -> 数据库 -> Console，粘贴执行
-- 说明：v2.2 起为多租户 SaaS 架构，凭证由部署环境注入（见 .env.example），
--       应用后端首次请求时会自动幂等初始化表结构，本脚本供手动预建库使用。

-- 用户账户与初始体态档案表（id 由系统下发 UUID，多租户隔离主键）
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,       -- PBKDF2-SHA256
  gender TEXT,                       -- male / female
  birth_year INTEGER,
  height_cm REAL,
  initial_weight_kg REAL,
  initial_fat_rate REAL,
  initial_fat_mass_kg REAL,
  initial_protein_kg REAL,
  target_weight_kg REAL,
  target_fat_rate REAL,
  strategy TEXT,                     -- conservative / moderate / aggressive
  activity_level REAL DEFAULT 1.2,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME
);

-- 体脂秤历史表
CREATE TABLE IF NOT EXISTS body_composition (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  date TEXT NOT NULL,
  weight_kg REAL NOT NULL,
  bmi REAL NOT NULL,
  body_fat_rate REAL NOT NULL,
  fat_mass_kg REAL NOT NULL,
  water_weight_kg REAL,
  bone_mass_kg REAL,
  protein_weight_kg REAL,
  body_score REAL,
  image_url TEXT,                    -- 图片暂不同步，保留字段
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 饮食记录表
CREATE TABLE IF NOT EXISTS meal_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  timestamp TEXT NOT NULL,
  meal_type TEXT NOT NULL,
  followed_sequence INTEGER NOT NULL,     -- 0 or 1
  avoided_refined_carb INTEGER NOT NULL,  -- 0 or 1
  post_meal_activity INTEGER NOT NULL,    -- 0 or 1
  energy_reaction TEXT NOT NULL,
  satiety_duration TEXT,
  score INTEGER NOT NULL,
  calories INTEGER DEFAULT 0,
  carbs_g REAL DEFAULT 0,
  fiber_g REAL DEFAULT 0,
  protein_g REAL DEFAULT 0,
  fat_g REAL DEFAULT 0,
  food_summary TEXT,
  image_url TEXT,                    -- 图片暂不同步，保留字段
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 运动记录表
CREATE TABLE IF NOT EXISTS exercise_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  timestamp TEXT NOT NULL,
  category TEXT NOT NULL,            -- post_meal_walk / resistance / cardio / other
  duration_minutes INTEGER NOT NULL,
  calories_burned REAL NOT NULL,
  is_post_meal INTEGER DEFAULT 0,
  muscle_feel TEXT,                  -- JSON 数组字符串
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- AI 代谢诊断缓存表（每用户每天一条，按 generated_at 取最新）
CREATE TABLE IF NOT EXISTS ai_diagnoses (
  id TEXT PRIMARY KEY,               -- {user_id}:{date_str}
  user_id TEXT NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,             -- 诊断报告 JSON 字符串
  generated_at TEXT NOT NULL,
  date_str TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_body_user_date ON body_composition(user_id, date);
CREATE INDEX IF NOT EXISTS idx_meal_user_ts ON meal_logs(user_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_exercise_user_ts ON exercise_logs(user_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_diag_user_time ON ai_diagnoses(user_id, generated_at);
