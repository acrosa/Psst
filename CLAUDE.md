# psst

A private shared **daily canvas** for tiny groups (2–8): members drop links, notes, photos, and emoji stickers onto today's board, drag them around, flip them to read small caption threads, and react. Days archive into a timeline. Explicitly **not a chat**. Full product spec: `docs/PRODUCT_SPEC.md`. Design system: `docs/DESIGN.md`. User stories: `docs/USER_STORIES.md`.

## Design spirit

> "You have to make every single detail perfect, and you have to limit the number of details." — Jack Dorsey

This is the bar for every change to psst. Two halves, both binding:

- **Every detail perfect.** The few things on screen get full attention: copy, spacing, motion, empty states, error states. A detail not worth perfecting is a detail to cut.
- **Limit the number of details.** Simple and seamless — no complex UI, no settings where an automatic behavior works, no features orbiting the core. Everything should flow.

What's important (perfect these, cut around them): **sharing**, **connection**, and **effortless onboarding** — a person should get from a link to dropping something on a friend's canvas with nearly zero friction. When a change is debatable, ask: does it serve one of these three, and is it the simplest version of itself?

`docs/DESIGN.md` translates this spirit into binding definitions — color, type, layout modes, materials, motion, voice — distilled from the reference images in `docs/design/inspiration/`. Consult it before any UI work.

## Structure

```
apps/web/                 # the entire web app (React Router v7 framework mode)
  app/routes.ts           # explicit route config (no file-convention routing)
  app/routes/             # route modules (pages + resource routes)
  app/components/         # ui/ (shadcn-style primitives) + canvas/ (React Flow board)
  app/lib/
    db/                   # client.server.ts (dual dialect), schema.ts (pg), schema.sqlite.ts
    services/             # all domain logic; routes stay thin
    jobs/handlers/        # plain-function job handlers (unfurl, image-process)
    env.server.ts         # zod-validated env
  workers/index.ts        # pg-boss worker entrypoint (pnpm worker)
  drizzle/ + drizzle/sqlite/   # committed generated migrations (both dialects)
  e2e/                    # Playwright suite + harness
docker-compose.yml        # postgres + minio (app runs on host); --profile full for containers
docs/PRODUCT_SPEC.md
```

## Commands (root, proxied to apps/web)

```bash
pnpm install
pnpm dev              # web on :3000 (Postgres via DATABASE_URL, or USE_SQLITE=true)
pnpm worker           # background jobs (requires Postgres)
pnpm typecheck        # react-router typegen && tsc
pnpm lint             # biome check .
pnpm test:e2e         # Playwright on SQLite (no Postgres needed)
pnpm db:setup         # create the Postgres database
pnpm db:migrate       # apply drizzle migrations
pnpm -C apps/web db:generate          # regen pg migrations after schema changes
pnpm -C apps/web db:generate:sqlite   # regen sqlite migrations (keep BOTH in sync)
```

## Key patterns

- **Dual-dialect DB**: `app/lib/db/client.server.ts` picks Postgres (`pg`) or SQLite (`better-sqlite3`, when `USE_SQLITE=true` — used by E2E). Every schema change must be mirrored in `schema.ts` AND `schema.sqlite.ts`, then regenerate BOTH migration sets. E2E builds its DB from the committed `drizzle/sqlite/*.sql`.
- **Services own the logic** (`app/lib/services/*.server.ts`): membership guards (`requireMember`), frozen-canvas checks, pagination. Route loaders/actions stay thin so a JSON API can wrap the same services later (iOS).
- **Jobs with inline fallback**: enqueue via `app/lib/jobs.server.ts`. With Postgres + worker running, jobs go through pg-boss; otherwise the handler (a plain function in `app/lib/jobs/handlers/`) runs inline fire-and-forget. Never put logic in the job class — only in the handler.
- **Daily rollover is lazy**: today's canvas row is created on first touch using the space's IANA timezone (`app/lib/dates.ts`, `Intl`-based, no date library). A canvas with `date < today(tz)` is archived; mutations against it are rejected in the services layer.
- **Canvas** = React Flow (`@xyflow/react`), no edges, custom node types: `postcard` (link), `slip` (note), `print` (image), `sticker` (emoji). Fixed sizes per type in `app/lib/design.ts`. Interactive elements inside nodes need the `nodrag` class. Positions PATCH on drag stop; ~10s polling revalidation (paused while dragging/editing), last-write-wins.
- **Auth**: Better Auth, cookie sessions, handler mounted at `api/auth/*`. Use `requireUser(request)` / `getUser(request)` from `app/lib/auth.server.ts` in loaders/actions.

## Environment

See `apps/web/.env.example`. Nothing beyond `BETTER_AUTH_SECRET` + `DATABASE_URL` is required in dev: email logs to console, storage falls back to local disk (`data/uploads`), metrics/Google OAuth are no-ops without keys.

## Guidelines

- Biome formatting: tabs, single quotes, 100 columns. Run `pnpm lint` before committing.
- Keep the not-a-chat line: item threads cap at 280 chars; no feature creep toward messaging.
- Every schema change ships with both dialects' migrations and a passing `pnpm test:e2e`.
- Playful, warm copy in UI ("psst — drop something here"), quiet chrome, content provides the color.
