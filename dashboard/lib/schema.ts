import type Database from "better-sqlite3";

const CREATE_BRANDS = `
CREATE TABLE IF NOT EXISTS brands (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  handle TEXT,
  platform TEXT NOT NULL,
  folder_path TEXT NOT NULL,
  posts_subfolder TEXT NOT NULL DEFAULT 'posts',
  color_primary TEXT,
  color_secondary TEXT,
  color_accent TEXT,
  cadence TEXT,
  has_brand_doc INTEGER DEFAULT 0,
  logo_path TEXT,
  logo_position TEXT,
  logo_max_width REAL,
  logo_padding INTEGER,
  logo_bg_block TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);`;

const CREATE_POSTS = `
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brand_id TEXT NOT NULL REFERENCES brands(id),
  post_number INTEGER NOT NULL,
  date TEXT,
  day TEXT,
  post_type TEXT,
  content_pillar TEXT,
  concept TEXT,
  caption TEXT,
  hashtags TEXT,
  cta TEXT,
  visual_direction TEXT,
  status TEXT NOT NULL DEFAULT 'not_started',
  file_path TEXT,
  version TEXT,
  archetype TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(brand_id, post_number)
);`;

const CREATE_APPROVALS = `
CREATE TABLE IF NOT EXISTS approvals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL REFERENCES posts(id),
  status TEXT NOT NULL,
  comment TEXT,
  created_at TEXT NOT NULL
);`;

const CREATE_SCRIPT_RUNS = `
CREATE TABLE IF NOT EXISTS script_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  script_name TEXT NOT NULL,
  brand_id TEXT REFERENCES brands(id),
  post_id INTEGER REFERENCES posts(id),
  started_at TEXT NOT NULL,
  completed_at TEXT,
  status TEXT NOT NULL,
  output TEXT
);`;

export function migrate(db: Database.Database): void {
  db.exec(CREATE_BRANDS);
  db.exec(CREATE_POSTS);
  db.exec(CREATE_APPROVALS);
  db.exec(CREATE_SCRIPT_RUNS);
}
