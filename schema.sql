-- GlucoFit Web v2.1 — Cloudflare D1 数据库初始化脚本
-- 用法（任选其一）：
--   1. wrangler CLI:  npx wrangler d1 execute glucofit --remote --file=./schema.sql
--   2. Cloudflare Dashboard -> Storage & Databases -> D1 -> 数据库 -> Console，粘贴执行
-- 应用内「设置 -> 云端同步 -> 初始化表结构」亦可自动执行本文件全部语句。

-- 用户初始体态档案表
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,               -- 同步码 (syncCode)
  email TEXT UNIQUE,
  gender TEXT,
  birth_year INTEGER,
  height_cm REAL NOT NULL,
  initial_weight_kg REAL NOT NULL,
  initial_fat_rate REAL,
  initial_fat_mass_kg REAL,
  initial_protein_kg REAL,
  target_weight_kg REAL NOT NULL,
  target_fat_rate REAL,
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
  image_url TEXT,                    -- v2.1 暂不同步图片，保留字段
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
  image_url TEXT,                    -- v2.1 暂不同步图片，保留字段
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

CREATE INDEX IF NOT EXISTS idx_body_user_date ON body_composition(user_id, date);
CREATE INDEX IF NOT EXISTS idx_meal_user_ts ON meal_logs(user_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_exercise_user_ts ON exercise_logs(user_id, timestamp);
