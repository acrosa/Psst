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
   # The canonical host is www — the apex 308-redirects there, and better-auth
   # rejects sign-in POSTs whose Origin isn't trusted. Keep the apex trusted too.
   BETTER_AUTH_URL=https://www.psst.you
   APP_URL=https://www.psst.you
   EXTRA_TRUSTED_ORIGINS=https://psst.you

   # optional but recommended: lets every deploy apply pending migrations
   # itself (session pooler, port 5432) — no more code/schema drift
   DATABASE_URL_MIGRATIONS=postgres://…pooler.supabase.com:5432/postgres

   S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
   S3_REGION=auto
   S3_BUCKET=psst-uploads
   S3_ACCESS_KEY_ID=…
   S3_SECRET_ACCESS_KEY=…
   S3_PUBLIC_URL=https://<your-r2-public-host>

   # optional
   RESEND_API_KEY=…                              # invite emails (console-logged without it)
   EMAIL_FROM=psst <hello@psst.you>
   GOOGLE_CLIENT_ID=…
   GOOGLE_CLIENT_SECRET=…
   APPLE_CLIENT_ID=…
   APPLE_CLIENT_SECRET=…
   ```

   Leave `JOBS_MODE` unset — unfurls and thumbnails run inline, which is right for this scale (pg-boss needs a long-lived worker; serverless has none).

4. **Deploy**, then point your domain at the project (Vercel → Domains).

## 4 · Google sign-in

The app enables the Google button automatically when both `GOOGLE_CLIENT_ID` and
`GOOGLE_CLIENT_SECRET` are present.

1. Open [Google Cloud Console](https://console.cloud.google.com/) and create or select a project.
2. Open **Google Auth Platform → Branding** and configure:
   - App name and support email.
   - Your production home page.
   - Privacy policy and terms URLs if the app is public.
   - Your domain under authorized domains.
3. Open **Audience**:
   - Choose **External** to allow ordinary Google accounts.
   - While the app is in testing, add each person who should be able to sign in as a test user.
   - Publish the app when it is ready for general use. Basic sign-in only requests
     `openid`, `email`, and `profile`; adding other Google scopes may require additional verification.
4. Open **Clients → Create client → Web application**.
5. Add the production origin under **Authorized JavaScript origins**:

   ```text
   https://www.psst.you
   https://psst.you
   ```

6. Add this exact **Authorized redirect URI** (no trailing slash):

   ```text
   https://www.psst.you/api/auth/callback/google
   ```

7. Copy the generated credentials into Vercel Production environment variables:

   ```text
   GOOGLE_CLIENT_ID=<client-id ending in .apps.googleusercontent.com>
   GOOGLE_CLIENT_SECRET=<client-secret>
   ```

8. Redeploy the Production deployment, open `/login`, and test **Continue with Google** in a
   private browser window.

For local Google sign-in, add `http://localhost:3000` as another JavaScript origin and
`http://localhost:3000/api/auth/callback/google` as another redirect URI. A
`redirect_uri_mismatch` error means the URI Google received does not exactly match one in the
client configuration; check the scheme, domain, path, and trailing slash. See the
[Better Auth Google guide](https://better-auth.com/docs/authentication/google) and
[Google's web-server OAuth guide](https://developers.google.com/identity/protocols/oauth2/web-server).

## 5 · Apple sign-in

Apple web sign-in requires an active Apple Developer Program membership. The app enables the
Apple button automatically when both `APPLE_CLIENT_ID` and `APPLE_CLIENT_SECRET` are present.

1. Open [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list).
2. Under **Identifiers**, create an **App ID** using a reverse-domain Bundle ID such as
   `you.psst`. Enable **Sign in with Apple** and make it the primary App ID.
3. Create a **Services ID** with a different identifier, such as `you.psst.web`. The
   Services ID—not the App ID—is the web OAuth client ID.
4. Open the Services ID, enable **Sign in with Apple**, and select **Configure**:
   - **Primary App ID:** the App ID created above.
   - **Domains and Subdomains:** `www.psst.you` without `https://` or a path.
   - **Return URL:** `https://www.psst.you/api/auth/callback/apple`.
   - Save the configuration and the Services ID.
5. Under **Keys**, create a key with **Sign in with Apple** enabled and associate it with the
   primary App ID. Download the `.p8` private key immediately; Apple only allows one download.
6. Record these values:
   - **Client ID:** the Services ID, for example `you.psst.web`.
   - **Team ID:** shown in Apple Developer membership details.
   - **Key ID:** shown on the key details page.
   - **Private key:** the downloaded `.p8` file.
7. Generate an ES256 Apple client-secret JWT using those four values. The JWT must use:
   - Header: `alg=ES256` and `kid=<Key ID>`.
   - Claims: `iss=<Team ID>`, `sub=<Services ID>`, and
     `aud=https://appleid.apple.com`.
   - An expiration no more than six months in the future.

   The [Better Auth Apple guide](https://better-auth.com/docs/authentication/apple#generate-apple-client-secret-jwt)
   includes a `jose` example for generating the JWT. This app currently accepts the generated
   JWT as a static Vercel secret, so record its expiration date and replace it before it expires.
8. Add the values to Vercel Production environment variables:

   ```text
   APPLE_CLIENT_ID=you.psst.web
   APPLE_CLIENT_SECRET=<generated-client-secret-jwt>
   ```

9. Confirm the shared auth settings still use the same production origin:

   ```text
   BETTER_AUTH_URL=https://www.psst.you
   APP_URL=https://www.psst.you
   EXTRA_TRUSTED_ORIGINS=https://psst.you
   ```

10. Redeploy the Production deployment, open `/login`, and test **Continue with Apple** in a
    private browser window.

Apple does not accept `localhost`, plain HTTP, IP addresses, wildcard domains, or Vercel preview
URLs as web return URLs. Test Apple sign-in on the stable production HTTPS domain. The app already
trusts `https://appleid.apple.com`, which Apple needs because its callback uses an HTTP POST. See
Apple's guides for [web configuration](https://developer.apple.com/help/account/capabilities/configure-sign-in-with-apple-for-the-web)
and [private-key creation](https://developer.apple.com/help/account/capabilities/create-a-sign-in-with-apple-private-key).

## Checklist

- [ ] `BETTER_AUTH_SECRET` is a fresh 32+ char secret (not the dev placeholder)
- [ ] `BETTER_AUTH_URL` / `APP_URL` are the production https domain (invite links use them)
- [ ] Migrations current: either `DATABASE_URL_MIGRATIONS` is set in Vercel (deploys migrate themselves) or `pnpm db:migrate` ran with the session-pooler string
- [ ] Drop a photo — it lands in R2 and gets a thumbnail
- [ ] Invite email arrives (or you're consciously in console-log mode)
- [ ] Google OAuth client uses the exact production origin and callback URI
- [ ] Google audience is published, or every intended user is listed as a test user
- [ ] Apple Services ID uses the production domain and callback URI
- [ ] Apple client-secret expiration is recorded for rotation before six months
- [ ] Vercel was redeployed after adding OAuth environment variables
