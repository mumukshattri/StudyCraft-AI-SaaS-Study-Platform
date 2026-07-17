// GET    /api/decks        -> user's decks with card count + due-today count
// DELETE /api/decks?id=N   -> delete a deck the user owns (cascades cards+reviews)
import { all, run } from "../../lib/db";
import { requireUser } from "../../lib/auth";

export default async function handler(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;

  if (req.method === "GET") {
    const decks = await all(
      `SELECT d.id, d.title,
              COUNT(c.id) AS cards,
              COALESCE(SUM(CASE WHEN c.next_review <= date('now') THEN 1 ELSE 0 END), 0) AS due
       FROM decks d LEFT JOIN cards c ON c.deck_id = d.id
       WHERE d.user_id = ?
       GROUP BY d.id
       ORDER BY d.id DESC`,
      [user.id]
    );
    return res.json({ decks });
  }

  if (req.method === "DELETE") {
    const id = Number(req.query.id);
    // Scope the delete to the owner — a non-owned id simply matches nothing.
    const info = await run("DELETE FROM decks WHERE id = ? AND user_id = ?", [id, user.id]);
    if (info.changes === 0) return res.status(404).json({ error: "Deck not found" });
    return res.json({ ok: true });
  }

  res.status(405).end();
}
