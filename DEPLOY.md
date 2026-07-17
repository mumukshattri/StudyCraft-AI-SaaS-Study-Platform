# Deploying StudyCraft

StudyCraft stores data in **Turso** (libSQL — SQLite-compatible, but reachable
over the network). Because the database is hosted rather than a local file, the
app runs fine on **serverless** platforms like **Vercel** as well as on
persistent-disk hosts (Railway / Render / Fly.io).

## Required environment variables
| Var | Value | Why |
|-----|-------|-----|
| `GROQ_API_KEY` | your Groq key | real AI generation (mock fallback if unset) |
| `TURSO_DATABASE_URL` | `libsql://<db>-<org>.turso.io` | the hosted DB |
| `TURSO_AUTH_TOKEN` | Turso token | authenticates to the DB |
| `NODE_ENV` | `production` | enables the `Secure` session cookie |

> In local dev, if the `TURSO_*` vars are unset the app falls back to a local
> `file:studycraft.db` — no setup needed to run `npm run dev`.

---

## 1. Create the database (Turso)
```bash
# one-time: install + sign up (free tier is plenty)
curl -sSfL https://get.tur.so/install.sh | bash
turso auth signup

turso db create studycraft
turso db show studycraft --url        # -> TURSO_DATABASE_URL
turso db tokens create studycraft     # -> TURSO_AUTH_TOKEN
```
The schema and demo user are created automatically on first request — no
migration step.

## 2. Deploy on Vercel (recommended)
1. Push this folder to a GitHub repo (already done).
2. On [vercel.com](https://vercel.com): **Add New… → Project → Import** the repo.
3. Framework preset: **Next.js** (auto-detected). Leave build/output defaults.
4. **Environment Variables** → add `GROQ_API_KEY`, `TURSO_DATABASE_URL`,
   `TURSO_AUTH_TOKEN`, `NODE_ENV=production`.
5. **Deploy** → open the generated URL → log in with
   `demo@studycraft.app` / `demo1234`.

Or from the CLI:
```bash
npm i -g vercel
vercel            # link + first deploy (follow prompts)
vercel env add GROQ_API_KEY
vercel env add TURSO_DATABASE_URL
vercel env add TURSO_AUTH_TOKEN
vercel env add NODE_ENV          # value: production
vercel --prod     # promote to production
```

## Other hosts (Railway / Render / Fly.io)
Same three env vars work everywhere — set them in the service's variables and
deploy. Build: `npm install && npm run build` · Start: `npm start`. No volume is
needed anymore since the DB is hosted on Turso.

---

## After deploying
- **Change or remove the seeded demo account** before sharing publicly — the
  password is in the README. See `lib/db.js`.
