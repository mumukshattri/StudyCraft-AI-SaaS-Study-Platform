# StudyCraft — AI Study Platform

AI-powered study SaaS: paste study material, an LLM generates flashcards, and a
spaced-repetition engine (SM-2) schedules reviews. XP gamifies retention.

## Stack
- **Next.js** (React frontend + API routes as backend)
- **libSQL / Turso** — SQLite-compatible, but networked so it runs on serverless
  hosts (Vercel). Falls back to a local SQLite file in dev. Same SQL model I'd deploy on **PostgreSQL**.
- **Groq API (Llama)** for flashcard generation

## Architecture
```
Browser (React)  ->  Next.js API routes  ->  Groq LLM (generate cards)
                          |
                          v
                  libSQL/Turso: users -> decks -> cards -> reviews
```

## Core pieces (interview map)
- `lib/srs.js` — SM-2 spaced repetition (ease factor + interval growth)
- `lib/db.js` — schema, foreign keys w/ ON DELETE CASCADE, indexes, seeded demo user
- `lib/auth.js` — scrypt password hashing (timing-safe) + cookie sessions, no deps
- `lib/llm.js` — Groq call + defensive JSON parsing (mock fallback if no key)
- `pages/api/auth/[action].js` — signup / login / logout / me
- `pages/api/generate.js` — LLM -> persist deck+cards in one transaction (user-scoped)
- `pages/api/due.js` — the due-cards query (`next_review <= today`), per user, optional `?deckId`
- `pages/api/review.js` — apply SM-2, log review, award XP + streak (single transaction)
- `pages/api/decks.js` — list decks (card + due counts) / delete deck (cascades)

## Auth
Real multi-user accounts — email + password, hashed with Node's built-in `scrypt`,
sessions stored server-side keyed by an HttpOnly cookie. Each user only ever sees
their own decks, cards, XP, and streak (every query is scoped and ownership-checked).

Demo account (seeded): **demo@studycraft.app** / **demo1234**

## Run
```bash
npm install
cp .env.local.example .env.local   # optional: add GROQ_API_KEY (+ Turso vars for hosted DB)
npm run dev                         # http://localhost:3000
```
With no `TURSO_*` vars set, dev uses a local `file:studycraft.db` automatically.

## Deploy
See **[DEPLOY.md](DEPLOY.md)**. Runs on **Vercel** (or any serverless/persistent
host) because the DB is hosted **Turso**, not a local file. Set `GROQ_API_KEY`,
`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, and `NODE_ENV=production`.

## Roadmap (honest, not yet built)
- Subscription billing (schema-ready; needs a real Stripe/Razorpay account + public webhook)
- Password reset emails
