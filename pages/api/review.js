// POST /api/review  { cardId, rating }
// Applies SM-2 to reschedule the card, logs the review, awards XP, and updates
// the daily streak — all in ONE transaction so nothing drifts apart.
// The card must belong to the signed-in user (verified via join through decks).
import { get, tx } from "../../lib/db";
import { schedule } from "../../lib/srs";
import { requireUser } from "../../lib/auth";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const user = await requireUser(req, res);
  if (!user) return;
  const { cardId, rating } = req.body;

  // Fetch the card only if it belongs to this user — prevents reviewing others' cards.
  const card = await get(
    `SELECT c.id, c.ease, c.interval
     FROM cards c JOIN decks d ON d.id = c.deck_id
     WHERE c.id = ? AND d.user_id = ?`,
    [cardId, user.id]
  );
  if (!card) return res.status(404).json({ error: "card not found" });

  const { ease, interval } = schedule(card, rating);

  const t = await tx();
  try {
    await t.execute({
      sql: "UPDATE cards SET ease = ?, interval = ?, next_review = date('now', '+' || ? || ' days') WHERE id = ?",
      args: [ease, interval, interval, cardId],
    });
    await t.execute({ sql: "INSERT INTO reviews (card_id, rating) VALUES (?, ?)", args: [cardId, rating] });
    await t.execute({ sql: "UPDATE users SET xp = xp + ? WHERE id = ?", args: [rating >= 3 ? 10 : 2, user.id] });

    // Streak logic: +1 if last active was yesterday, reset to 1 if older, keep if today.
    const u = (await t.execute({ sql: "SELECT streak, last_active FROM users WHERE id = ?", args: [user.id] })).rows[0];
    const today = (await t.execute("SELECT date('now') AS d")).rows[0].d;
    const yday = (await t.execute("SELECT date('now','-1 day') AS d")).rows[0].d;
    if (u.last_active !== today) {
      const streak = u.last_active === yday ? u.streak + 1 : 1;
      await t.execute({ sql: "UPDATE users SET streak = ?, last_active = ? WHERE id = ?", args: [streak, today, user.id] });
    }
    await t.commit();
  } catch (e) {
    await t.rollback();
    return res.status(500).json({ error: String(e) });
  }

  const u = await get("SELECT xp, streak FROM users WHERE id = ?", [user.id]);
  res.json({ nextInterval: interval, xp: u.xp, streak: u.streak });
}
