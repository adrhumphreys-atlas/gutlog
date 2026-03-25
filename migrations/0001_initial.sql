-- GutLog D1 Migration: Initial Schema
-- Tables: users, auth_tokens, entries (STI), correlations, experiments

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  settings TEXT, -- JSON
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_tokens (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS entries (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  timestamp TEXT NOT NULL,
  type TEXT NOT NULL, -- meal|symptom|bowel|emotion|impact|note

  -- Shared
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,

  -- Meal fields
  meal_type TEXT,
  foods TEXT, -- JSON array
  portion_size TEXT,

  -- Symptom fields
  symptom_type TEXT,
  severity INTEGER,
  location TEXT,
  duration INTEGER,

  -- Bowel fields
  bristol_type INTEGER,
  urgency TEXT,
  blood INTEGER, -- boolean (0/1)
  mucus INTEGER, -- boolean (0/1)

  -- Emotion fields
  mood INTEGER,
  stress_level INTEGER,
  sleep_quality INTEGER,
  anxiety_level INTEGER,

  -- Impact fields
  impact_severity TEXT,
  affected_activities TEXT, -- JSON array
  description TEXT
);

CREATE INDEX IF NOT EXISTS idx_entries_user_timestamp ON entries(user_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_entries_user_type ON entries(user_id, type);

CREATE TABLE IF NOT EXISTS correlations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  trigger_type TEXT NOT NULL,
  trigger_value TEXT NOT NULL,
  symptom_type TEXT NOT NULL,
  confidence REAL NOT NULL,
  relative_risk REAL NOT NULL,
  consistency_ratio REAL NOT NULL,
  occurrences INTEGER NOT NULL,
  total_opportunities INTEGER NOT NULL,
  window_hours INTEGER NOT NULL DEFAULT 6,
  created_at TEXT NOT NULL,
  last_updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_correlations_user ON correlations(user_id);

CREATE TABLE IF NOT EXISTS experiments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  eliminated_foods TEXT NOT NULL, -- JSON array
  start_date TEXT NOT NULL,
  end_date TEXT,
  duration_days INTEGER NOT NULL,
  baseline_symptom_rate REAL,
  current_symptom_rate REAL,
  result TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_experiments_user ON experiments(user_id);
