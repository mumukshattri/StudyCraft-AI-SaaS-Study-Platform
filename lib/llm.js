// LLM generation via Groq (Llama). Free-tier friendly, very fast.
// Set GROQ_API_KEY in .env.local. Falls back to a mock so the app runs offline.
const MODEL = "llama-3.3-70b-versatile";

async function callGroq(prompt) {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null; // signal: use mock
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
    }),
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

// Generate flashcards -> array of {question, answer}
export async function generateCards(text) {
  const prompt = `From the study text below, generate 6 exam-style flashcards.
Return ONLY valid JSON: an array of objects with "question" and "answer" keys. No prose.
Text: """${text}"""`;

  const raw = await callGroq(prompt);
  if (raw === null) {
    return [
      { question: "What is spaced repetition?", answer: "Reviewing material at increasing intervals to fight the forgetting curve." },
      { question: "Sample card from your text", answer: text.slice(0, 80) || "Add GROQ_API_KEY for real AI generation." },
    ];
  }
  // LLMs sometimes wrap JSON in prose/backticks — extract the array defensively.
  try {
    const match = raw.match(/\[[\s\S]*\]/);
    const cards = JSON.parse(match ? match[0] : raw);
    return cards.filter((c) => c.question && c.answer).slice(0, 12);
  } catch {
    return [{ question: "Generation parse failed", answer: "The model returned malformed JSON; retry." }];
  }
}

// Generate concise study notes -> markdown-ish string
export async function generateNotes(text) {
  const prompt = `Summarize the study text below into clear, concise revision notes.
Use short bullet points with "- ". Keep it under 10 bullets. Return only the notes.
Text: """${text}"""`;

  const raw = await callGroq(prompt);
  if (raw === null) {
    return "- Add GROQ_API_KEY in .env.local for real AI notes.\n- This is a placeholder summary of your text.";
  }
  return raw.trim();
}
