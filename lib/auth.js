// Auth layer: password hashing + cookie-based sessions.
// No external deps — Node's built-in crypto (scrypt) and SQLite sessions table.
import { scryptSync, randomBytes, timingSafeEqual } from "crypto";
import db from "./db";

const COOKIE = "sc_session";

// --- Passwords: "salt:scryptHex" (same format lib/db.js seeds with) ---
export function hashPassword(pw) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(pw, salt, 64).toString("hex")}`;
}

export function verifyPassword(pw, stored) {
  if (!stored || !stored.includes(":")) return false;
  const [salt, hashHex] = stored.split(":");
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(pw, salt, 64);
  // Constant-time compare to avoid leaking match progress via timing.
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

// --- Sessions ---
export function createSession(userId) {
  const token = randomBytes(32).toString("hex");
  db.prepare("INSERT INTO sessions (token, user_id) VALUES (?, ?)").run(token, userId);
  return token;
}

export function destroySession(token) {
  if (token) db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

// --- Cookie helpers (framework-agnostic, work with Next API routes) ---
export function setSessionCookie(res, token) {
  // 30-day, HttpOnly, SameSite=Lax. Secure is added in production (HTTPS hosts);
  // omitted in dev so it works on localhost http.
  const secure = process.env.NODE_ENV === "production" ? " Secure;" : "";
  res.setHeader(
    "Set-Cookie",
    `${COOKIE}=${token}; HttpOnly;${secure} Path=/; Max-Age=${60 * 60 * 24 * 30}; SameSite=Lax`
  );
}

export function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", `${COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`);
}

function parseCookies(req) {
  const raw = req.headers.cookie || "";
  return Object.fromEntries(
    raw.split(";").map((c) => c.trim().split("=")).filter((p) => p[0])
  );
}

// Resolve the logged-in user from the session cookie, or null.
export function getUser(req) {
  const token = parseCookies(req)[COOKIE];
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT u.id, u.email, u.xp, u.streak, u.last_active
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ?`
    )
    .get(token);
  return row || null;
}

// Guard for API routes: returns the user, or sends 401 and returns null.
export function requireUser(req, res) {
  const user = getUser(req);
  if (!user) {
    res.status(401).json({ error: "Not signed in" });
    return null;
  }
  return user;
}
