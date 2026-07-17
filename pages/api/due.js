// GET /api/due[?deckId=N]  -> the signed-in user's due cards + their XP/streak.
// The core SRS query: fetch cards whose next_review date has arrived.
// Joins through decks so a user only ever sees their own cards.
import { all, get } from "../../lib/db";
import { requireUser } from "../../lib/auth";

export default async function handler(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;

  const deckId = req.query.deckId ? Number(req.query.deckId) : null;
  const cards = await all(
    `SELECT c.id, c.question, c.answer, c.ease, c.interval, d.title
     FROM cards c JOIN decks d ON d.id = c.deck_id
     WHERE d.user_id = ?
       AND c.next_review <= date('now')
       AND (? IS NULL OR d.id = ?)
     ORDER BY c.next_review LIMIT 50`,
    [user.id, deckId, deckId]
  );

  const { xp, streak } = await get("SELECT xp, streak FROM users WHERE id = ?", [user.id]);
  res.json({ cards, xp, streak });
}
