CREATE TABLE IF NOT EXISTS users (
  tg_id INTEGER PRIMARY KEY,
  first_name TEXT,
  track TEXT,                       -- native | learner
  ui_lang TEXT DEFAULT 'ar',
  theme TEXT DEFAULT 'warm',
  xp INTEGER DEFAULT 0,
  streak INTEGER DEFAULT 0,
  best_streak INTEGER DEFAULT 0,
  last_active_date TEXT,
  reminder_hour INTEGER,            -- ساعة UTC (0-23) أو NULL = بدون تذكير
  last_reminded_date TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  lang_code TEXT                    -- language_code من تليجرام
);

CREATE TABLE IF NOT EXISTS progress (
  tg_id INTEGER NOT NULL,
  lesson_id TEXT NOT NULL,
  best_score REAL DEFAULT 0,
  status TEXT DEFAULT 'in_progress', -- in_progress | passed
  attempts INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (tg_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS reviews (
  tg_id INTEGER NOT NULL,
  question_id TEXT NOT NULL,
  box INTEGER DEFAULT 1,
  due_date TEXT NOT NULL,
  PRIMARY KEY (tg_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_due ON reviews (tg_id, due_date);
CREATE INDEX IF NOT EXISTS idx_users_reminder ON users (reminder_hour);
