# psst — Product Spec

*A shared canvas for people who like to share mood and meaningful things — not a chat.*

**Status:** v3 · **Platform:** Web first (iOS app + widget as a future direction)

---

## 1. The idea

psst is a private shared space where a small group of people (usually 2, sometimes a handful) send each other things: links, notes, images, emoji. Like whispering something to someone — *psst, look at this.*

The core abstraction is a **daily shared canvas**. You open the app, a few **spaces** appear — one per person or group you share with. Open a space and you're on **today's canvas**: a playful pinboard where things can be dropped, moved freely, flipped over, reacted to. At the end of the day the canvas archives itself, and the space becomes a **timeline of days**: scroll back through yesterday's board, last Tuesday's, the day you both got obsessed with that song.

This is explicitly **not a chat**. No typing indicators, no read receipts, no reply pressure. Things get dropped on the board; you wander over when you feel like it. The only words allowed are small: a short caption thread on the back of a card, an emoji reaction. That's it.

### Who it's for

Sensitive, intentional people who share mood and taste with someone close — partners, best friends, siblings. People who dislike the transactional feel of messaging apps but want a low-pressure channel for "I saw this and thought of you."

### The core loop (the product bar)

The whole product stands on one loop feeling **delightful and seamless**:

1. **Sign up** — one screen, no ceremony. Your first space is created for you and you land straight on its canvas.
2. **Invite someone** — one button on the canvas, one link to send. They tap it, see who's inviting them and to what, sign up in seconds, and land **on the same canvas**.
3. **Share the canvas** — drop a link, a note, a photo, an emoji. They see it appear. They drag it somewhere better, flip it over, leave a 🫶.

If that loop sings, everything else is decoration.

---

## 2. Vibe & design language

Playful and warm, with a postal soul. The app should feel like a small illustrated world you share, not a feed.

- **Postal metaphor.** Items render as physical keepsakes: links as **postcards** (unfurled image front, stamp-edge detail), notes as **paper slips** with typographic treatment, photos as **prints**, emoji as oversized **stickers**. Authors and dates appear as **postmarks**.
- **Flip to read.** Tapping an item flips it over. The back of the card carries a small thread — short handwritten-style captions from members — and the reaction row.
- **Playful physics.** Cards land with a slight scatter and rotation; the board pans and zooms like a table you lean over. Soft motion — things settle and bloom, nothing bouncy.
- **Uniform sizes per type.** Every item of a given type is the same fixed size (design tokens). The constraint *is* the aesthetic — collage, not chaos.
- **Quiet chrome.** UI recedes; color comes from content and the pastel backdrop.
- **Never a bare URL.** Every item is fully visual; unfurling is not optional polish, it's the product.

---

## 3. Core concepts

| Concept | Description |
|---|---|
| **Space** | A shared board between 2+ members. Invite-only. A user can belong to multiple spaces. |
| **Canvas (day)** | One canvas per space per day. Today's canvas is live: items can be dropped and moved freely (x/y). At day's end it archives (frozen). |
| **Item** | A piece of content on a canvas: link, note, image, emoji sticker. Fixed size per type. |
| **Thread (back of card)** | Small comment thread on any item (each entry ≤ 280 chars). A caption, not a conversation. |
| **Reaction** | Emoji reactions on an item — tap to toggle. |
| **Timeline** | Reverse-chronological archive of past canvases, one board per day, preserved as it was left. |

### Item types (v1)

1. **Link** — URL unfurled into a postcard (title, image, favicon, site name). Music links (Spotify, YouTube, …) get album-art treatment via oEmbed when available.
2. **Note** — freeform short text on a paper slip, typography-first.
3. **Image** — uploaded photo as a print (thumbnail + blurhash bloom).
4. **Emoji** — a single emoji as an oversized sticker.

### Non-goals (v1)

- No chat: no long-form threads, no DMs, no typing indicators, no read receipts.
- No public spaces, discovery, or social graph.
- No algorithmic anything — a day is a day.
- No live cursors/presence (positions sync ambiently; this isn't multiplayer Figma).

---

## 4. Product experience

### 4.1 Signup & onboarding

- Single-screen signup (name, email, password). Google sign-in optional when configured.
- **Signing up creates your first space automatically** — named after you ("Sam's corner" 🌷, timezone detected), renameable any time in settings — and drops you straight onto its canvas with a friendly empty state. Zero steps between signup and the board.
- Arriving via an invite skips the starter space: you land on the canvas you were invited to.

### 4.2 Invites

- **Invite** button lives on the canvas header. It produces a copyable link (and can optionally email it).
- The invite page shows the space emoji, name, and who's inviting. New users sign up inline (email prefilled when known) and land directly on the shared canvas. Signed-in users join in one tap.
- Expired or already-used invites get a graceful explanation, never a dead end.

### 4.3 Today's canvas

- Items drop in near the last placement with a gentle scatter, then can be dragged freely. Positions sync to all members — last-write-wins, ambient rather than realtime-critical (~10s polling).
- Anyone in the space can move anything — arranging the board together is part of the intimacy.
- Tap flips the card: back face shows the postmark (author, date), the caption thread, and reactions.
- Composer: paste a URL → postcard; type → paper slip; pick an emoji → sticker; add a photo → print.

### 4.4 Timeline

- Scroll from today into past days. Each archived day renders as the board was left — a page in a scrapbook. Archived canvases are frozen (server-enforced).

### 4.5 The Sunday letter

- Once a week, psst reads a space's board (Monday–Sunday in the space's timezone) and writes the group a short letter in its own generated hand. It arrives on the next week's board as an ordinary item — draggable, flippable, a back to write on — is emailed to members, and archives with its day.
- Written lazily on the first open of a new week (no cron), silent when the week had fewer than three things on it. Always on and transparent: the letter says psst read the week; the space's owner can take it down.

### 4.6 Future direction (explicitly out of scope for v1)

- iOS app with the widget as hero: today's canvas on the home screen, share-sheet capture, push-refreshed.
- Live presence / SSE sync.

---

## 5. Architecture

| Layer | Choice |
|---|---|
| Web app | React 19 + React Router v7 (framework mode, loaders/actions), Vite, Tailwind v4 |
| Canvas | React Flow (`@xyflow/react`) — custom node types per item type, no edges |
| DB | Drizzle ORM — PostgreSQL (prod/dev), SQLite (tests) via a dual-dialect client |
| Auth | Better Auth — email/password (+ Google OAuth, env-gated), cookie sessions |
| Jobs | pg-boss worker (unfurl, image processing) with **inline fallback** when no worker/Postgres is available |
| Storage | Local disk (dev/test) or any S3-compatible bucket (Cloudflare R2, MinIO) via a storage driver |
| Email | Console (dev) or Resend — invite emails |
| Analytics | LogSnag (no-op without token) |
| Lint/format | Biome · **Tests**: Playwright E2E (SQLite mode) |
| Hosting | Vercel for the web app; worker as a small always-on container (Fly.io/Railway) — or skip the worker and rely on inline job fallback |

### 5.1 Data model

```
users, sessions, accounts, verifications   (Better Auth)
spaces           id, name, emoji, timezone, created_by, created_at
space_members    space_id, user_id, role(owner|member), joined_at
invites          id, space_id, token, email?, created_by, expires_at, accepted_by?, accepted_at?
canvases         id, space_id, date (unique per space), created_at
items            id, canvas_id, space_id, author_id, type(link|note|image|emoji),
                 url?, text?, x, y, z, rotation, created_at, deleted_at?
item_unfurls     item_id, title, description, image_url, favicon_url, site_name,
                 status(pending|ok|failed), fetched_at
item_comments    id, item_id, author_id, text(≤280), created_at
item_reactions   id, item_id, user_id, emoji, created_at  (unique per item+user+emoji)
item_assets      id, item_id, kind(original|thumb), storage_key, width, height, blurhash
```

No width/height on items — sizes are fixed per type in design tokens.

### 5.2 Daily rollover

- Canvases are **created lazily**: touching a space today materializes the `(space_id, date)` row for today in the space's timezone.
- A canvas is archived *by definition* once its date is in the past — no cron required. Mutations against non-today canvases are rejected server-side.

### 5.3 Position sync

- Drag = optimistic local + PATCH position on drop; other clients pick changes up via ~10s polling while the canvas is open (paused while dragging/editing). Last-write-wins is fine — this is ambient, not collaborative editing.

### 5.4 Background jobs

- `unfurl.fetch` — fetch the URL (timeout + size cap), extract OpenGraph/oEmbed metadata, upsert `item_unfurls`.
- `image.process` — cap original size, generate thumbnail + blurhash into `item_assets`.
- Both run through pg-boss when a worker + Postgres are present, and **inline** (fire-and-forget) otherwise, so the product works on serverless alone.

---

## 6. Analytics (LogSnag)

Events: `signup`, `space_created`, `invite_created`, `invite_accepted`, `item_posted` (type), `item_moved`, `comment_added`, `reaction_added`.

North-star: **weekly active spaces where ≥2 members posted** (mutual boards, not broadcast).

---

## 7. Decisions log

- Members can move (not just add) each other's items — shared arranging is the point.
- Archived canvases are frozen at rollover.
- Space size cap: 8, to preserve intimacy.
- Sync transport v1: polling (serverless-friendly); SSE/live presence deferred.
- iOS: deferred; the API-ready services layer keeps a JSON surface cheap to add.
