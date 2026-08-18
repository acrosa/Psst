# psst 🤫

*A shared canvas for people who like to share mood and meaningful things — not a chat.*

psst is a private **daily canvas** you share with someone close. Drop links, notes, photos, and emoji stickers on today's board; drag them around together; flip a card to read the little thread on its back; leave a reaction. At midnight the board archives itself and the space becomes a timeline of days.

Product spec: [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md)

## Quickstart

Requirements: Node 22+, pnpm 10, Docker (for Postgres).

```bash
docker compose up -d               # postgres + minio
pnpm install
cp apps/web/.env.example apps/web/.env   # defaults work out of the box
pnpm db:setup && pnpm db:migrate
pnpm dev                           # → http://localhost:3000
pnpm worker                        # background jobs (unfurling, image thumbs) — separate terminal
```

Sign up, name your first space, hit **Invite**, send the link — that's the whole loop.

No Docker? Set `USE_SQLITE=true` in `apps/web/.env` and skip `db:setup`/`db:migrate`/`worker` — jobs run inline and uploads go to local disk. (SQLite mode is what the test suite uses.)

## Tests

```bash
pnpm test:e2e        # Playwright end-to-end suite (self-contained: SQLite + local storage)
pnpm typecheck
pnpm lint
```

## Deploying

- **Web app** → Vercel (React Router v7 preset). Set `DATABASE_URL` (Neon works well), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, and optionally `S3_*` (Cloudflare R2), `RESEND_API_KEY`, `LOGSNAG_*`, `GOOGLE_CLIENT_ID/SECRET`.
- **Worker** → any always-on container host (Fly.io, Railway): run `pnpm worker` against the same `DATABASE_URL`. Optional — without a worker, unfurling and image processing run inline in the web request path.
- **Storage** → any S3-compatible bucket with public reads for image serving; local-disk fallback otherwise.
