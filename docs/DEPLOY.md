# Deploying psst

One stack: **Vercel** (app) + **Supabase** (Postgres) + **Cloudflare R2** (photos). All three have free tiers that comfortably fit tiny-group scale.

## 1 · Supabase — the database

1. Create a project at [supabase.com](https://supabase.com) (free tier).
2. From **Connect** in the dashboard, copy two connection strings:
   - **Transaction pooler** (port `6543`) — this is the app's `DATABASE_URL` (right for serverless).
   - **Session pooler** (port `5432`) — used once per schema change to run migrations.
3. Run the migrations from your machine:

   ```bash
   DATABASE_URL="<session-pooler-string>" pnpm db:migrate
   ```

## 2 · Cloudflare R2 — photo storage

1. In the Cloudflare dashboard → **R2**, create a bucket named `psst-uploads`.
2. Enable public access for the bucket (Settings → Public access → allow, or attach a custom domain). Note the public base URL.
3. Create an API token (**Manage R2 API Tokens** → Object Read & Write, scoped to the bucket). Note the Access Key ID and Secret.

R2 is required on Vercel — serverless functions have no persistent disk — and its zero egress fees are why it beats S3 here.

## 3 · Vercel — the app

1. **Import the repo** at [vercel.com/new](https://vercel.com/new).
2. Settings that matter for this monorepo:
   - **Root Directory**: `apps/web`, with *“Include source files outside of the Root Directory”* enabled (pnpm workspace).
   - Framework: React Router (auto-detected). Default build (`pnpm build`) and install commands are fine. Node ≥ 20 (default); `sharp` works out of the box.
3. **Environment variables** (Settings → Environment Variables, Production):

   ```bash
   DATABASE_URL=postgres://…pooler.supabase.com:6543/postgres   # transaction pooler
   BETTER_AUTH_SECRET=<openssl rand -base64 32>
   BETTER_AUTH_URL=https://your-domain.com
   APP_URL=https://your-domain.com

   S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
   S3_REGION=auto
   S3_BUCKET=psst-uploads
   S3_ACCESS_KEY_ID=…
   S3_SECRET_ACCESS_KEY=…
   S3_PUBLIC_URL=https://<your-r2-public-host>

   # optional
   RESEND_API_KEY=…                              # invite emails (console-logged without it)
   EMAIL_FROM=psst <hello@your-domain.com>
   GOOGLE_CLIENT_ID=…
   GOOGLE_CLIENT_SECRET=…
   APPLE_CLIENT_ID=…
   APPLE_CLIENT_SECRET=…
   ```

   Leave `JOBS_MODE` unset — unfurls and thumbnails run inline, which is right for this scale (pg-boss needs a long-lived worker; serverless has none).

4. **Deploy**, then point your domain at the project (Vercel → Domains).

## 4 · OAuth callbacks (if using social sign-in)

- Google Cloud Console → your OAuth client → authorized redirect URI:
  `https://your-domain.com/api/auth/callback/google`
- Apple Developer → Services ID → return URL:
  `https://your-domain.com/api/auth/callback/apple`

## Checklist

- [ ] `BETTER_AUTH_SECRET` is a fresh 32+ char secret (not the dev placeholder)
- [ ] `BETTER_AUTH_URL` / `APP_URL` are the production https domain (invite links use them)
- [ ] Migrations ran against Supabase (`pnpm db:migrate` with the session-pooler string)
- [ ] Drop a photo — it lands in R2 and gets a thumbnail
- [ ] Invite email arrives (or you're consciously in console-log mode)
- [ ] OAuth redirect URIs registered for the prod domain
