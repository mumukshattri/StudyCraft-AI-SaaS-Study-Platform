// POST /api/review  { cardId, rating }
// Applies SM-2 to reschedule the card, logs the review, awards XP, and updates
// the daily streak — all in ONE transaction so nothing drifts apart.
// The card must belong to the signed-in user (verified via join through decks).
import db from "../../lib/db";
import { schedule } from "../../lib/srs";
import { requireUser } from "../../lib/auth";

export default function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const user = requireUser(req, res);
  if (!user) return;
  const { cardId, rating } = req.body;

  // Fetch the card only if it belongs to this user — prevents reviewing others' cards.
  const card = db
    .prepare(
      `SELECT c.id, c.ease, c.interval
       FROM cards c JOIN decks d ON d.id = c.deck_id
       WHERE c.id = ? AND d.user_id = ?`
    )
    .get(cardId, user.id);
  if (!card) return res.status(404).json({ error: "card not found" });

  const { ease, interval } = schedule(card, rating);

  db.exec("BEGIN");
  try {
    db.prepare(
      "UPDATE cards SET ease = ?, interval = ?, next_review = date('now', '+' || ? || ' days') WHERE id = ?"
    ).run(ease, interval, interval, cardId);
    db.prepare("INSERT INTO reviews (card_id, rating) VALUES (?, ?)").run(cardId, rating);
    db.prepare("UPDATE users SET xp = xp + ? WHERE id = ?").run(rating >= 3 ? 10 : 2, user.id);

    // Streak logic: +1 if last active was yesterday, reset to 1 if older, keep if today.
    const u = db.prepare("SELECT streak, last_active FROM users WHERE id = ?").get(user.id);
    const today = db.prepare("SELECT date('now') AS d").get().d;
    const yday = db.prepare("SELECT date('now','-1 day') AS d").get().d;
    if (u.last_active !== today) {
      const streak = u.last_active === yday ? u.streak + 1 : 1;
      db.prepare("UPDATE users SET streak = ?, last_active = ? WHERE id = ?").run(streak, today, user.id);
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    return res.status(500).json({ error: String(e) });
  }

  const u = db.prepare("SELECT xp, streak FROM users WHERE id = ?").get(user.id);
  res.json({ nextInterval: interval, xp: u.xp, streak: u.streak });
}
