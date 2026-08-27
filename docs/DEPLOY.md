# Deploying psst

The short answers:

- **Do we need a database?** In production, yes — Postgres. But it doesn't need to be a *managed* database with a monthly bill: on a DigitalOcean droplet it's just a container on the same box, effectively free. (SQLite is for dev/tests only.)
- **DigitalOcean or Vercel?** Both work. Since you already have a DO account, **one $6/mo droplet is the recommended path** — the app, Postgres, storage, and the job worker all live on one box, one bill, nothing metered. Vercel + free-tier services is the serverless alternative (~$0 to start) if you'd rather not touch a server.

What the app needs at runtime:

| Need | Dev default | On a droplet | On Vercel |
|---|---|---|---|
| Web server | `react-router dev` | `pnpm build` + `pnpm start` (systemd) | Vercel runtime (auto) |
| Database | SQLite or local Postgres | Postgres container (compose) | Neon/Supabase free tier — **not** Vercel Postgres (that's the expensive part) |
| File storage | local disk `data/uploads` | local disk works fine (persistent!) | Cloudflare R2 (serverless has no disk) |
| Jobs (unfurls, thumbnails) | inline | inline, or `pnpm worker` with `JOBS_MODE=queue` | inline only |
| Email (invites) | console log | Resend (free 100/day) | Resend |

## Path A — DigitalOcean droplet (recommended, $6/mo)

One Basic droplet runs everything. 1GB RAM works; the $12 2GB is comfier while `sharp` processes photos.

1. **Create the droplet.** Marketplace → "Docker on Ubuntu" image (or plain Ubuntu 24.04 + install Docker), Basic plan, add your SSH key. Point your domain's A record at its IP.

2. **Infra via the repo's compose file** (Postgres + MinIO):

   ```bash
   ssh root@your-droplet
   git clone git@github.com:acrosa/Psst.git psst && cd psst
   # change the default postgres/minio passwords in docker-compose.yml first
   docker compose up -d        # postgres :5432 + minio :9000 (infra only — the 'full' profile is dev-mode, don't use it in prod)
   ```

   MinIO is optional: on a droplet, skipping the `S3_*` vars entirely stores uploads on local disk (`apps/web/data/uploads`) — persistent and perfectly fine at this scale. Choose one and back it up either way.

3. **The app** (Node 22 + pnpm on the host):

   ```bash
   curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt-get install -y nodejs
   corepack enable && pnpm install
   cp apps/web/.env.example apps/web/.env    # then edit:
   ```

   ```bash
   NODE_ENV=production
   DATABASE_URL=postgresql://postgres:<password>@localhost:5432/psst
   BETTER_AUTH_SECRET=<openssl rand -base64 32>
   BETTER_AUTH_URL=https://your-domain.com
   APP_URL=https://your-domain.com
   JOBS_MODE=queue                            # droplet can run the real worker; or omit for inline
   RESEND_API_KEY=…                           # optional; console-logged without it
   # S3_* only if using MinIO/Spaces — omit for local-disk uploads
   ```

   ```bash
   pnpm db:setup && pnpm db:migrate
   pnpm build
   ```

4. **Keep it running** — two systemd units (or pm2 if you prefer):

   ```ini
   # /etc/systemd/system/psst.service
   [Unit]
   Description=psst web
   After=network.target docker.service
   [Service]
   WorkingDirectory=/root/psst/apps/web
   ExecStart=/usr/bin/pnpm start
   Restart=always
   EnvironmentFile=/root/psst/apps/web/.env
   [Install]
   WantedBy=multi-user.target
   ```

   Duplicate as `psst-worker.service` with `ExecStart=/usr/bin/pnpm worker` (only if `JOBS_MODE=queue`). Then `systemctl enable --now psst psst-worker`.

5. **TLS with Caddy** (automatic Let's Encrypt):

   ```bash
   apt-get install -y caddy
   # /etc/caddy/Caddyfile
   your-domain.com {
       reverse_proxy localhost:3000
   }
   systemctl reload caddy
   ```

6. **Backups.** DO droplet backups ($1.20/mo on a $6 droplet) cover everything at once — Postgres volume and uploads included. That's the whole disaster plan at this scale.

Total: **$6–13/mo**, flat, no per-service pricing, and the pg-boss worker actually runs (serverless can't do that).

## Path B — Vercel + free tiers (~$0/mo, serverless)

If you'd rather never SSH anywhere:

1. **Database — Neon** (neon.tech free tier, 0.5GB) or Supabase free. Copy the pooled connection string as `DATABASE_URL`. Avoid Vercel's own Postgres — same Neon underneath, steeper pricing.
2. **Storage — Cloudflare R2** (free 10GB, zero egress fees). Bucket + API token → the `S3_*` vars. Required on Vercel: functions have no persistent disk.
3. **Vercel project**: import the repo, Root Directory `apps/web` (enable "Include source files outside of the Root Directory" for the pnpm workspace). React Router v7 is auto-detected; defaults build fine; `sharp` works on the Node runtime.
4. **Env vars**: same as the droplet list, minus `JOBS_MODE` (leave unset — jobs run inline; pg-boss needs a long-lived process serverless doesn't have) and with the `S3_*` block required.
5. **Migrate** from your machine: `DATABASE_URL=<neon-url> pnpm db:migrate`.

DigitalOcean's own PaaS (App Platform + managed Postgres at ~$15/mo for the DB alone) costs more than the droplet for less control — skip it.

## Either path

- **OAuth callbacks** (social sign-in): register `https://your-domain.com/api/auth/callback/google` and `…/callback/apple` for the prod domain.
- **Checklist before first real users**:
  - [ ] `BETTER_AUTH_SECRET` is a fresh 32+ char secret (not the dev placeholder)
  - [ ] `BETTER_AUTH_URL` / `APP_URL` are the production https domain (invite links use these)
  - [ ] `pnpm db:migrate` ran against prod
  - [ ] Drop a photo — it lands in the bucket/disk and gets a thumbnail
  - [ ] Invite email arrives (or you're consciously in console-log mode)
  - [ ] Default infra passwords changed (droplet path)
