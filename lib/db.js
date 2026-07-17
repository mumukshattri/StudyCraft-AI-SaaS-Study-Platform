// Database layer. Uses libSQL / Turso — SQLite-compatible, but reachable over
// the network so it works on serverless hosts (Vercel) where a local SQLite
// file would be wiped between requests. Same SQL model I'd deploy on PostgreSQL.
//
// Env:
//   TURSO_DATABASE_URL  libsql://<db>-<org>.turso.io   (or file:studycraft.db locally)
//   TURSO_AUTH_TOKEN    the DB auth token (omit for a local file: URL)
import { createClient } from "@libsql/client";
import { scryptSync, randomBytes } from "crypto";

const url = process.env.TURSO_DATABASE_URL || "file:studycraft.db";
const authToken = process.env.TURSO_AUTH_TOKEN;
export const client = createClient(authToken ? { url, authToken } : { url });

// --- Schema init (runs once per server instance, memoized) -----------------
// Serverless functions cache modules between invocations, so this executes on
// the first request an instance handles and is a no-op thereafter.
let ready;
function init() {
  if (!ready) ready = setup();
  return ready;
}

async function setup() {
  // Schema: users -> decks -> cards -> reviews (one-to-many chain via FKs).
  await client.batch(
    [
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT,
        xp INTEGER NOT NULL DEFAULT 0,
        streak INTEGER NOT NULL DEFAULT 0,
        last_active TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS decks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS cards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        deck_id INTEGER NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        ease REAL NOT NULL DEFAULT 2.5,       -- SM-2 ease factor
        interval INTEGER NOT NULL DEFAULT 0,  -- days until next review
        next_review TEXT NOT NULL DEFAULT (date('now'))
      )`,
      `CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
        rating INTEGER NOT NULL,
        reviewed_at TEXT NOT NULL DEFAULT (datetime('now'))
      )`,
      // Index the columns we filter on most (due cards, decks per user).
      `CREATE INDEX IF NOT EXISTS idx_cards_due ON cards(deck_id, next_review)`,
      `CREATE INDEX IF NOT EXISTS idx_decks_user ON decks(user_id)`,
    ],
    "write"
  );

  // Migrations: bring older DBs up to the current schema without data loss.
  const cols = (await client.execute("PRAGMA table_info(users)")).rows.map((c) => c.name);
  if (!cols.includes("streak")) await client.execute("ALTER TABLE users ADD COLUMN streak INTEGER NOT NULL DEFAULT 0");
  if (!cols.includes("last_active")) await client.execute("ALTER TABLE users ADD COLUMN last_active TEXT");
  if (!cols.includes("password_hash")) await client.execute("ALTER TABLE users ADD COLUMN password_hash TEXT");

  // Seed a demo account so the app is usable out of the box.
  // Login: demo@studycraft.app / demo1234
  const u = (await client.execute("SELECT id, password_hash FROM users WHERE id = 1")).rows[0];
  if (!u) {
    await client.execute({
      sql: "INSERT INTO users (id, email, password_hash, xp) VALUES (1, 'demo@studycraft.app', ?, 0)",
      args: [hashPassword("demo1234")],
    });
  } else if (!u.password_hash) {
    await client.execute({ sql: "UPDATE users SET password_hash = ? WHERE id = 1", args: [hashPassword("demo1234")] });
  }
}

// Password hash format (shared with lib/auth.js): "salt:scryptHex".
function hashPassword(pw) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(pw, salt, 64).toString("hex")}`;
}

// --- Query helpers (all async; each ensures the schema exists first) --------
export async function get(sql, args = []) {
  await init();
  const r = await client.execute({ sql, args });
  return r.rows[0] ?? null;
}

export async function all(sql, args = []) {
  await init();
  const r = await client.execute({ sql, args });
  return r.rows;
}

export async function run(sql, args = []) {
  await init();
  const r = await client.execute({ sql, args });
  return {
    changes: Number(r.rowsAffected),
    lastInsertRowid: r.lastInsertRowid != null ? Number(r.lastInsertRowid) : null,
  };
}

// Interactive transaction (multi-step writes needing lastInsertRowid or
// all-or-nothing semantics — see generate.js / review.js). Caller commits.
export async function tx() {
  await init();
  return client.transaction("write");
}
