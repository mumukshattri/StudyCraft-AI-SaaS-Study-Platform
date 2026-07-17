// POST /api/generate  { title, text, notes? }
// Uses the LLM to make flashcards (and optionally notes), then persists
// deck + cards in one transaction.
import db from "../../lib/db";
import { generateCards, generateNotes } from "../../lib/llm";
import { requireUser } from "../../lib/auth";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const user = requireUser(req, res);
  if (!user) return;
  const { title, text, notes: wantNotes } = req.body;
  if (!text) return res.status(400).json({ error: "text required" });

  const [cards, notes] = await Promise.all([
    generateCards(text),
    wantNotes ? generateNotes(text) : Promise.resolve(null),
  ]);

  db.exec("BEGIN");
  let deckId;
  try {
    const deck = db
      .prepare("INSERT INTO decks (user_id, title) VALUES (?, ?)")
      .run(user.id, title || "Untitled deck");
    deckId = deck.lastInsertRowid;
    const insert = db.prepare(
      "INSERT INTO cards (deck_id, question, answer) VALUES (?, ?, ?)"
    );
    for (const c of cards) insert.run(deckId, c.question, c.answer);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    return res.status(500).json({ error: String(e) });
  }

  res.json({ deckId, count: cards.length, notes });
}
