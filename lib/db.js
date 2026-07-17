// Database layer. Uses Node's built-in SQLite (node:sqlite, no native build).
// Same SQL concepts I'd use in PostgreSQL: tables, foreign keys, indexes, joins.
import { DatabaseSync } from "node:sqlite";
import { scryptSync, randomBytes } from "crypto";
import path from "path";

// DB path is configurable so a host can point it at a persistent volume
// (e.g. DB_PATH=/data/studycraft.db). Falls back to the project dir locally.
const db = new DatabaseSync(process.env.DB_PATH || path.join(process.cwd(), "studycraft.db"));

// Foreign keys are off by default in SQLite — enable so ON DELETE CASCADE works.
db.exec("PRAGMA foreign_keys = ON");

// Schema: users -> decks -> cards -> reviews (one-to-many chain via foreign keys).
// Deleting a deck cascades to its cards, and each card to its reviews.
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  xp INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  last_active TEXT
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS decks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deck_id INTEGER NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  ease REAL NOT NULL DEFAULT 2.5,       -- SM-2 ease factor
  interval INTEGER NOT NULL DEFAULT 0,  -- days until next review
  next_review TEXT NOT NULL DEFAULT (date('now'))
);
CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL,
  reviewed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
-- Index the column we filter on most (due cards). Speeds reads as data grows.
CREATE INDEX IF NOT EXISTS idx_cards_due ON cards(deck_id, next_review);
CREATE INDEX IF NOT EXISTS idx_decks_user ON decks(user_id);
`);

// Migrations: bring older DBs up to the current schema without data loss.
const cols = db.prepare("PRAGMA table_info(users)").all().map((c) => c.name);
if (!cols.includes("streak")) db.exec("ALTER TABLE users ADD COLUMN streak INTEGER NOT NULL DEFAULT 0");
if (!cols.includes("last_active")) db.exec("ALTER TABLE users ADD COLUMN last_active TEXT");
if (!cols.includes("password_hash")) db.exec("ALTER TABLE users ADD COLUMN password_hash TEXT");

// Password hash format (shared with lib/auth.js): "salt:scryptHex".
function hashPassword(pw) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(pw, salt, 64).toString("hex")}`;
}

// Seed a demo account so the app is usable out of the box.
// Login: demo@studycraft.app / demo1234
const u = db.prepare("SELECT id, password_hash FROM users WHERE id = 1").get();
if (!u) {
  db.prepare("INSERT INTO users (id, email, password_hash, xp) VALUES (1, 'demo@studycraft.app', ?, 0)")
    .run(hashPassword("demo1234"));
} else if (!u.password_hash) {
  // Demo user predates auth — backfill its password so it can log in.
  db.prepare("UPDATE users SET password_hash = ? WHERE id = 1").run(hashPassword("demo1234"));
}

export default db;
