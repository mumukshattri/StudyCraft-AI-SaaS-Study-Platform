// POST /api/generate  { title, text, notes? }
// Uses the LLM to make flashcards (and optionally notes), then persists
// deck + cards in one transaction.
import { tx } from "../../lib/db";
import { generateCards, generateNotes } from "../../lib/llm";
import { requireUser } from "../../lib/auth";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const user = await requireUser(req, res);
  if (!user) return;
  const { title, text, notes: wantNotes } = req.body;
  if (!text) return res.status(400).json({ error: "text required" });

  const [cards, notes] = await Promise.all([
    generateCards(text),
    wantNotes ? generateNotes(text) : Promise.resolve(null),
  ]);

  const t = await tx();
  let deckId;
  try {
    const deck = await t.execute({
      sql: "INSERT INTO decks (user_id, title) VALUES (?, ?)",
      args: [user.id, title || "Untitled deck"],
    });
    deckId = Number(deck.lastInsertRowid);
    for (const c of cards) {
      await t.execute({
        sql: "INSERT INTO cards (deck_id, question, answer) VALUES (?, ?, ?)",
        args: [deckId, c.question, c.answer],
      });
    }
    await t.commit();
  } catch (e) {
    await t.rollback();
    return res.status(500).json({ error: String(e) });
  }

  res.json({ deckId, count: cards.length, notes });
}
