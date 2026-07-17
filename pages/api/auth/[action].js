// Auth endpoints: /api/auth/signup, /login, /logout, /me
import { get, run } from "../../../lib/db";
import {
  hashPassword, verifyPassword, createSession, destroySession,
  setSessionCookie, clearSessionCookie, getUser,
} from "../../../lib/auth";

const publicUser = (u) => ({ id: u.id, email: u.email, xp: u.xp, streak: u.streak });

export default async function handler(req, res) {
  const { action } = req.query;

  // --- who am I (called on page load) ---
  if (action === "me") {
    const u = await getUser(req);
    return res.json({ user: u ? publicUser(u) : null });
  }

  // --- logout ---
  if (action === "logout") {
    if (req.method !== "POST") return res.status(405).end();
    const token = (req.headers.cookie || "")
      .split(";").map((c) => c.trim().split("="))
      .find((p) => p[0] === "sc_session")?.[1];
    await destroySession(token);
    clearSessionCookie(res);
    return res.json({ ok: true });
  }

  // --- signup / login share validation ---
  if (action === "signup" || action === "login") {
    if (req.method !== "POST") return res.status(405).end();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    if (!email || !email.includes("@")) return res.status(400).json({ error: "Valid email required" });
    if (password.length < 6) return res.status(400).json({ error: "Password must be 6+ characters" });

    if (action === "signup") {
      const exists = await get("SELECT id FROM users WHERE email = ?", [email]);
      if (exists) return res.status(409).json({ error: "Email already registered — try logging in" });
      const info = await run(
        "INSERT INTO users (email, password_hash) VALUES (?, ?)",
        [email, hashPassword(password)]
      );
      const token = await createSession(info.lastInsertRowid);
      setSessionCookie(res, token);
      const u = await get("SELECT id, email, xp, streak FROM users WHERE id = ?", [info.lastInsertRowid]);
      return res.status(201).json({ user: publicUser(u) });
    }

    // login
    const u = await get("SELECT * FROM users WHERE email = ?", [email]);
    if (!u || !verifyPassword(password, u.password_hash)) {
      return res.status(401).json({ error: "Wrong email or password" });
    }
    const token = await createSession(u.id);
    setSessionCookie(res, token);
    return res.json({ user: publicUser(u) });
  }

  return res.status(404).json({ error: "Unknown auth action" });
}
