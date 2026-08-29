# psst — user stories

Jobs to be done, in the JTBD voice: *when …, I want to …, so that …*. Succinct on purpose — a story that needs a paragraph is describing a feature we shouldn't build.

Every story answers to the design spirit (`docs/DESIGN.md`): **every detail perfect, limit the number of details.** The three jobs that matter are **sharing**, **connection**, and **effortless onboarding**. Everything below serves one of them or got cut.

Legend: ✓ shipped · ◐ partial · ○ seed (see DESIGN.md concept seeds)

---

## 1 · Getting in (effortless onboarding)

The bar: link → dropping something on a friend's canvas in under a minute, nothing to learn.

- ✓ When a friend sends me any psst link, I want to tap it, sign in with an account I already have (Google/Apple) or a quick email form, and **land directly on their canvas** — no join buttons, no tour, no empty dashboard.
- ✓ When I sign up cold (no invite), I want a canvas that already exists and says *drop something here*, so the first thing I do is the core thing.
- ✓ When I come back days later, I want to still be signed in and land on my space — this is an ambient place, not a login wall.
- ✓ When I want the group to grow, I want one Invite button that gives me a link to paste anywhere, so bringing the next person costs one message.
- ✓ When my group is full (8), I want the door to close warmly, because tiny is the point.

## 2 · Dropping things (sharing)

The bar: anything worth whispering gets on the board in one gesture, and lands where I'm looking.

- ✓ When I find a link worth sharing, I want to paste or drop it and see it become a postcard (title, image, a VISIT button), so sharing costs less than describing it.
- ✓ When I have a thought, I want to type a few words and get a paper slip, so small things have a place without becoming "messages."
- ✓ When I have a photo, I want to drag it in, paste it, or pick it — and see it as a print in its true shape, blooming in as it loads.
- ✓ When words are too much, I want to drop a sticker from a small warm tray, so a 🐸 can be the whole contribution.
- ✓ When I want to be playful, I want to pick a pencil color and draw on the board, and have the stroke settle into place when I pause — no save button.
- ✓ When I add anything, I want it to appear where I'm looking (or exactly where I dropped it), never off-screen.

## 3 · Living on the board together (connection)

The bar: reactions and small words, arranged by hand — presence, not conversation.

- ✓ When someone's item delights me, I want to double-tap it and see a heart burst, so appreciation is instant and wordless.
- ✓ When I have something small to say about an item, I want to flip it and write on the back (280 chars), so words stay captions, not threads.
- ✓ When a card has life on it, I want to see it at a glance — the caption row under the card carries the thread count, the reactions, and the last couple of notes.
- ✓ When we're arranging the day, I want to drag anything anywhere (and resize with ⌥-drag, within taste), because composing the collage together *is* the hanging out.
- ✓ When someone else adds something while I'm looking, I want it to just appear, no refresh — the board is a shared table, not a feed.
- ✓ When I see who's here, I want small avatars (with real photos if we've added them), so the space feels inhabited, not listed.
- ✓ When I posted something I regret, I want to take back *my own* things — with one soft confirmation, and no trace after.

## 4 · Days becoming keepsakes (the scrapbook)

The bar: today is alive; yesterday is finished. Nobody manages an archive.

- ✓ When midnight passes (in our space's timezone), I want today's board to freeze exactly as we left it — automatically, nothing to save or clean up.
- ✓ When I'm nostalgic, I want to flip through past days like scrapbook pages — each with a peek of what it holds — and open one to see it frozen in place.
- ✓ When I open an archived day, I want to read everything but change nothing, because finished days are keepsakes, not backlogs.
- ○ When the scrapbook grows long, I want scrolling through time to feel delightful (the tick-rail seed), not like pagination.
- ○ When I want to find that one thing we shared, I want the space's items gathered by type (the shelf seed), without the board becoming a database.

## 5 · The quiet frame (everything else)

The bar: the product disappears; if it needs a setting, it probably needs a better default.

- ✓ When I use psst at night, I want it to follow my device's theme — no toggle, no thought.
- ✓ When a page is loading, I want one slim bar at the top edge — never a spinner-covered screen.
- ✓ When I rename our space or change its mood emoji, I want one small settings page — and nothing else to configure anywhere.
- ✓ When I add a face to my name, I want to change my photo from the account menu in two taps.
- ✓ When something goes wrong, I want a kind sentence in our voice ("psst… that page wandered off"), never a stack trace or a scolding.

## What psst refuses to do

The stories we will not write — cutting these **is** the product:

- **No chat.** No DMs, no threads, no typing indicators, no unread counts. 280-char captions on the backs of things, that's all.
- **No feed.** Nothing ranks, nothing scrolls infinitely, nothing is recommended. A day is a place, not a stream.
- **No metrics of affection.** No follower counts, no streaks, no read receipts. Hearts burst and settle quietly.
- **No big groups.** Eight people, hard cap. Growth is someone starting another space.
- **No settings sprawl.** Dark mode follows the device; days archive themselves; jobs run without knobs. A new setting needs to defeat an automatic behavior first.

---

*When a new story is proposed, it must name its job — sharing, connection, or onboarding — and survive the question: is this the simplest version of itself?*
