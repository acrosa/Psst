# Running psst locally

## Prerequisites

- **Node 22+** (`node -v`)
- **pnpm 10** — easiest via corepack: `corepack enable`
- **Docker** (for Postgres) — or skip it entirely with the SQLite option below
- Access to the repo: `git clone git@github.com:acrosa/Psst.git && cd Psst`

## 1. Install dependencies

```bash
pnpm install
```

## 2. Create the env file

Create **`apps/web/.env`** with:

```bash
NODE_ENV=development

# Postgres from docker-compose
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/psst

BETTER_AUTH_SECRET=dev-secret-must-be-32-characters-long!
BETTER_AUTH_URL=http://localhost:3000
APP_URL=http://localhost:3000
```

That's everything required. Anything not set degrades gracefully: invite emails print to the console, image uploads go to local disk (`data/uploads`), background jobs run inline, and Google/Apple sign-in is simply off. (`apps/web/.env.example` documents all the optional knobs.)

## 3. Start Postgres and migrate

```bash
docker compose up -d          # postgres on :5432 (+ minio, unused unless S3 vars are set)
pnpm db:setup                 # create the database
pnpm db:migrate               # apply drizzle migrations
```

## 4. Run it

```bash
pnpm dev
```

Open **http://localhost:3000** — sign up with any email/password (the verification email is printed in the terminal).

---

## No Docker? Run on SQLite

Swap the `DATABASE_URL` line in `apps/web/.env` for:

```bash
USE_SQLITE=true
```

Then just `pnpm dev` — no containers, no `db:setup`/`db:migrate` (this is how the E2E suite runs).

## Handy commands (from repo root)

```bash
pnpm typecheck        # react-router typegen + tsc
pnpm lint             # biome
pnpm test:e2e         # Playwright suite (runs on SQLite, no Postgres needed)
pnpm worker           # background jobs via pg-boss (optional; needs Postgres + JOBS_MODE=queue)
```

## Troubleshooting

- **Port 5432 already in use** — you have another Postgres running; stop it or change the port mapping in `docker-compose.yml` and `DATABASE_URL`.
- **"Invalid environment configuration" on startup** — `BETTER_AUTH_SECRET` must be at least 32 characters.
- **Native module errors on install** (`better-sqlite3`, `sharp`) — make sure you're on Node 22+, then `pnpm install` again.
