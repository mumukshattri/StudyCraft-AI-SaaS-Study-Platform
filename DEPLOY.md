# Deploying StudyCraft

StudyCraft stores data in a **SQLite file** (`node:sqlite`). It must run on a host
with a **persistent disk** — NOT a serverless platform (Vercel/Netlify wipe the
filesystem between requests, which would lose every user, deck, and session).

Good hosts: **Railway**, **Render**, **Fly.io** — all give you a mountable volume.

## Required environment variables
| Var | Value | Why |
|-----|-------|-----|
| `GROQ_API_KEY` | your Groq key | real AI generation (mock fallback if unset) |
| `DB_PATH` | `/data/studycraft.db` | points the SQLite file at the persistent volume |
| `NODE_ENV` | `production` | enables the `Secure` session cookie |

> The host sets `PORT` automatically — `next start` reads it. Don't hardcode it.
> Requires **Node 22.5+** (for the built-in `node:sqlite`); pinned in `package.json` `engines`.

---

## Railway (recommended — easiest)
1. Push this folder to a GitHub repo.
2. On [railway.app](https://railway.app): **New Project → Deploy from GitHub repo**.
3. **Add a Volume** to the service, mount path `/data`.
4. **Variables** tab → add `GROQ_API_KEY`, `DB_PATH=/data/studycraft.db`, `NODE_ENV=production`.
5. Railway auto-detects Next.js (`npm run build` then `npm start`). Deploy.
6. Open the generated URL → log in with `demo@studycraft.app` / `demo1234`.

`railway.json` in this repo already sets the build/start commands.

## Render
1. **New → Web Service** from your GitHub repo.
2. Build command: `npm install && npm run build` · Start command: `npm start`.
3. **Disks** → add a disk mounted at `/data` (1 GB is plenty).
4. **Environment** → add the three vars above.
5. Deploy.

## Fly.io
1. `fly launch` (Node builder, don't deploy yet).
2. `fly volumes create sc_data --size 1`, mount it at `/data` in `fly.toml`.
3. `fly secrets set GROQ_API_KEY=... DB_PATH=/data/studycraft.db NODE_ENV=production`.
4. `fly deploy`.

---

## After deploying
- **Change or remove the seeded demo account** before sharing publicly — the
  password is in the README. See `lib/db.js`.
- The DB and schema are created automatically on first boot; no migration step.
