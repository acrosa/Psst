# psst — the native iOS board

A plan for replacing the iOS app's web view with a fully native board, behind a switch that can put the web view back at any time. And for bringing GridKit into both the web and iOS apps, so the two stay on one grid.

Status: **plan** · Owner: Alejandro · Last updated: 2026-09-29

---

## 1 · Why, and what "done" means

The iOS app today is a native shell around the web board. Sign-in, push, the widget, the share extension and the Mac menu-bar app are native. Everything after sign-in is `WKWebView` loading `/spaces/:id` (`apps/ios/Psst/Shared/WebCanvas.swift`). That kept iOS and web identical for free, but it limits the board where it matters most. Pan and zoom are React Flow's physics, not UIKit's. Touch targets are sized for a cursor. Pinch-to-resize fights the page. There are no haptics or real context menus, no system share sheet, and the app starts cold because every launch waits on a page load.

### ★ The heart of this work: smoother on iPhone

> This is why we're going native. Every phase is measured against this list, and a change that doesn't make the board feel better in the hand can wait.

- **iOS's own scroll physics.** Pan and zoom run on `UIScrollView`: momentum, rubber-banding, bounce-zoom, 120 Hz on ProMotion. Items are drawn in SwiftUI.
- **Larger tap areas, same visuals.** Every chip, pill and button gets a 44 pt hit area. Nothing changes size on screen.
- **Haptics.** Lift, drop, like, and hitting the resize limits. Each one explains something, and there are no others.
- **Long-press menus.** A native context menu on your own items.
- **The system share sheet** for invites and shared days.
- **The photo picker and the camera**, straight onto the board.
- **Drag and drop** from other apps, plus paste.
- **Instant launch.** The last board paints from cache, then refreshes quietly.

§7 has the details, interaction by interaction.

**Goal:** a native SwiftUI/UIKit board that:

1. **Looks the same as the web.** Same tokens, geometry, materials, copy and motion. Put an iPhone next to mobile Safari on the same day and it should look like one product.
2. **Does everything the web board does.** The parity checklist in §8 is the contract.
3. **Feels native.** Apple-grade pan/zoom, touch-sized hit areas, haptics, context menus, the share sheet, PhotosPicker and camera, drag and drop, instant launch from cache.
4. **Can be switched off.** The web view stays intact, one `if` away (§2), until we decide to delete it.

**Non-goals (for this plan):** the Mac menu-bar app keeps its web panel. The core board is built so it can reach macOS later, but not now. No new product features: anything the web doesn't do, the native board doesn't do either, except where the platform demands it (touch hit areas, haptics). Realtime transport stays polling, same as the web. No schema changes.

---

## 2 · The switch

One enum and one `if`, in the app root. The web path is not touched.

```swift
// Shared/Config.swift
enum BoardExperience: String { case web, native }

extension Config {
	/// Which board the app shows after sign-in. The web view stays the
	/// fallback until the native board has earned its place.
	static var boardExperience: BoardExperience { … }
}
```

```swift
// Psst/PsstApp.swift
if appState.isSignedIn {
	switch Config.boardExperience {
	case .native: NativeRoot()   // new
	case .web: CanvasView()      // today's WKWebView, unchanged
	}
} else {
	LoginView()                  // already native, shared by both
}
```

How `boardExperience` resolves, first match wins:

| Source | Purpose |
|---|---|
| Remote kill switch: `flags.nativeBoard: "off"` in `GET /api/v1/me`, driven by the server env var `IOS_NATIVE_BOARD` | Lets us pull every install back to the web board without shipping a build. Cached, so it holds offline. |
| Launch argument `-psst.board native\|web` | Simulator and UI tests. |
| iOS Settings app toggle: **Native board** (`Settings.bundle`, App Group defaults) | Testers switch it themselves, with no settings UI inside psst. |
| Build default | TestFlight: `native`. App Store: `web` until Phase 6. |

Rules:

- **Everything outside the board is shared.** `LoginView`, `AppState`, `SessionStore`, `PushManager`, the widget and the share extension work the same under both experiences.
- **Push and widget deep links go through `AppState.pendingSpaceId`.** Both roots read it, so tapping a notification lands correctly in either mode.
- **`Config.lastSpaceId` is shared.** Switching modes reopens the same space.
- **The native code lives in its own folder (`Psst/Native/`).** Deleting the folder and the `case` removes it cleanly if we walk away.

---

## 3 · Architecture

```
┌──────────────────────── iOS app ─────────────────────────┐
│ PsstApp ─ if boardExperience                              │
│   ├─ .web    → CanvasView → WKWebView  (unchanged)        │
│   └─ .native → NativeRoot                                 │
│        ├─ SpacesScreen · TimelineScreen · sheets (SwiftUI)│
│        └─ BoardScreen                                     │
│             ├─ BoardStore  (@Observable: items, pending   │
│             │               moves/scales, poll, cache)    │
│             ├─ BoardCanvas (UIScrollView: pan/zoom)       │
│             │    └─ ItemView × n (SwiftUI in UIHosting)   │
│             └─ Composer (SwiftUI, glass pill)             │
│ Shared/  Models · APIClient(v1) · DesignTokens.generated  │
│          PaperCuts · PathParser · Blurhash                │
└───────────────────────────┬──────────────────────────────┘
                            │ bearer token (already issued at native sign-in)
┌───────────────────────────▼──────────────────────────────┐
│ web: app/routes/api.v1.*.ts  (thin: parse → service → JSON)│
│      app/lib/services/*.server.ts  (unchanged, shared)    │
└──────────────────────────────────────────────────────────┘
```

### The board canvas: UIKit physics, SwiftUI pixels

- **`BoardCanvas` is a `UIViewRepresentable` around a `UIScrollView`.** Zoom runs from `0.35` to `1.75`, the same limits as React Flow in `board.tsx`, with native deceleration, rubber-banding and bounce-zoom. Pure SwiftUI gestures can't match UIScrollView's feel. This is the main reason to go native.
- **World coordinates are the web's flow coordinates.** 1 flow px = 1 pt. Items are placed at `(x, y)` with `rotation` and `scale` exactly as the server stores them. The content view spans the items' bounding box plus one viewport of margin on every side, with a world→content offset, because flow coordinates can go negative. It grows as items move.
- **Each item is SwiftUI hosted in a `UIView`** (`UIHostingConfiguration`/`UIHostingController`). Pixels are written once, declaratively. Gestures that must beat the scroll view's (item drag, item pinch) are UIKit recognizers on the item view, arbitrated through `UIGestureRecognizerDelegate`.
- **Initial viewport matches `fitView({ padding: 0.4, maxZoom: 1 })`.** The dot background is drawn as a tiled layer that keeps a constant screen density, the way React Flow's does: gap 32 (D3), dot 1.5, `line` color.

### State and sync: the `board.tsx` algorithm, in Swift

- **`BoardStore` merges server items into local ones the same way `Board` does.** Local positions and scales survive until the server echoes them back (rounded equality clears the pending entry). The item being dragged never snaps. The server wins after that: last write wins.
- **Polling:** every 10 s while in the foreground, plus immediately on `scenePhase == .active` and when a push arrives in the foreground. Paused while dragging, resizing or typing on a card back. Polls send `If-None-Match` and the server answers `304` when nothing changed (§4).
- **Optimistic writes:** move, resize, react, like and delete apply locally first. Created items show up at once as a pending ghost (the web's shimmer) and swap in when the create returns. A failure rolls the change back and shows a quiet error line.
- **Cache:** the last board JSON for each space goes to the App Group container. Launch paints from cache, then refreshes, so "setting the table…" only shows on the very first open. The widget can read the same file later.

---

## 4 · Server: `/api/v1`

The board's reads and writes are React Router loaders and actions. Loaders speak turbo-stream (`.data`), not JSON. Actions do accept bearer form posts (the share extension relies on this), but they answer with redirects on auth failure. The native app needs a small JSON surface. `CLAUDE.md` already anticipates this: services own the logic, and routes stay thin "so a JSON API can wrap the same services later (iOS)". Each v1 route is parse → service call → JSON.

| Method & path | Wraps | Notes |
|---|---|---|
| `GET /api/v1/me` | session + `listSpacesForUser` | user, spaces, `flags`, waitlist state |
| `POST /api/v1/spaces` | onboarding / `create-space` | first canvas |
| `GET /api/v1/spaces/:id/board` | `space.tsx` loader | space, members, role, today's `BoardItem[]`, shareToken, pollMs. Adds `ETag`. |
| `POST /api/v1/spaces/:id/items` | `createItem` | JSON `{kind, content, x?, y?}` for link, note, emoji and drawing |
| `POST /api/v1/spaces/:id/items/image` | `createImageItem` | multipart |
| `POST /api/v1/spaces/:id/items/audio` | `createAudioItem` | multipart, `audio/mp4` (m4a) |
| `PATCH /api/v1/items/:id` | `moveItem` / `resizeItem` | `{x, y}` or `{scale}` |
| `DELETE /api/v1/items/:id` | `deleteItem` | |
| `POST /api/v1/items/:id/comments` | `addComment` | 280-char cap enforced by the service |
| `POST /api/v1/items/:id/reactions` | `toggleReaction` | `{emoji}` toggles |
| `GET /api/v1/spaces/:id/days` | `space.days.tsx` loader | timeline with peeks |
| `GET /api/v1/spaces/:id/days/:date` | `space.day.tsx` loader | frozen board |
| `POST·DELETE /api/v1/spaces/:id/share` | `shareCanvas` / `unshareCanvas` | returns the `/b/:token` URL |
| `POST /api/v1/spaces/:id/invites` | `createInvite` | `{email?}` links or emails an invite |
| `PATCH /api/v1/spaces/:id` · `DELETE …/members/me` · `DELETE …/invites/:id` | settings intents | rename or emoji, leave, revoke |
| `POST /api/v1/invites/:token/accept` | `invite.tsx` action | for universal links |

Plus:

- **`requireApiUser(request)`.** Same checks as `requireUser`, but answers `401 {error}` or `403 {waitlisted: true}` instead of redirecting to `/login` or `/waitlist`.
- **Service `Response` errors map to `{error}`.** Services throw 4xx `Response`s with friendly copy ("Notes stay small — under 1000 characters."), and the app shows that text verbatim. 5xx bodies never leak, same as `API.swift` today.
- **Absolute asset URLs**, as `/api/board` already does.
- **`letterPath` on letter items.** The Sunday letter's hand is 1,000+ lines of glyph geometry (`app/lib/hand/`). Rather than port it, the v1 payload carries the `d` string from `letterPathData(composeLetterPage(...))`, the same string the web renders. One source of truth, and the native side only draws a path.
- **Leave `/api/board` and `/api/spaces` as they are.** The widget and share extension keep using them.
- **Tests:** `e2e/api-v1.spec.ts` uses Playwright's `request` fixture on SQLite and covers auth, each endpoint's happy path, membership guards and frozen-canvas rejection. It also writes the JSON fixtures that the Swift decoding tests read (§7).

No schema changes, so no migrations.

---

## 5 · Design parity: one set of numbers

"Not different looking" is enforced by generating the native numbers from the web's, not by transcribing them by hand.

### Tokens: generated, never hand-copied

`apps/web/scripts/tokens.ts` (run with `pnpm tokens`) reads:

- `app/app.css` `@theme` + `:root.dark`: colors (light and dark), type scale, radii, shadows, animation curves
- `app/lib/design.ts`: `ITEM_SIZES`, `SCALE_MIN/MAX`, `REACTION_EMOJIS`, `STICKER_EMOJIS`, `SLIP_TONES`
- `components/canvas/composer.tsx` `PENCIL_COLORS` (moved into `design.ts` so there's one home)

It writes **`apps/ios/Psst/Shared/DesignTokens.generated.swift`**. The existing `Theme.swift` `PsstColor` becomes a thin alias over it. `pnpm lint` fails if the generated file is stale, so the web stays the source of truth and iOS can't drift.

Mapping rules:

| Web | Native |
|---|---|
| `--text-xs … 3xl` (rem × 16) | 13 · 15 · 17 · 20 · 26 · 34 · 44 pt. The same numbers, and 17 is already iOS body. |
| `--radius-sm/md/lg/xl` | 8 · 14 · 20 · 28 pt, `RoundedRectangle(style: .continuous)` |
| `shadow-card` / `shadow-lift` (two layers each, light and dark) | two stacked `.shadow` modifiers each, per scheme |
| `pop-in` 0.35 s `cubic-bezier(.2,.9,.3,1.2)`, `scale .92, y+8` | `.timingCurve(0.2, 0.9, 0.3, 1.2, duration: 0.35)` |
| card flip 500 ms `ease`, `perspective: 1200px` | `rotation3DEffect` with `.timingCurve(0.25, 0.1, 0.25, 1, duration: 0.5)`, perspective tuned side by side |
| `shimmer` 1.6 s opacity .45↔.9 | repeating `.easeInOut(duration: 0.8)` |
| `like-burst` 0.7 s keyframes | `KeyframeAnimator` with the same stops |
| blurhash bloom 700 ms crossfade | the same |

### Type: bundle the real faces

- **Geist** (UI) and **Newsreader** (serif, roman + italic, variable with an `opsz` axis) are both SIL OFL. Bundle the variable TTFs, the same families `root.tsx` loads from Google Fonts. Confirm CoreText applies Newsreader's optical sizing automatically, and set the axis explicitly if it doesn't.
- **Typewriter** (note slips): American Typewriter ships with iOS, first in the web's stack.
- **Meta** (dates, counts): `.monospaced` system font, uppercase, tracking to match `tracking-wider`.
- **Chrome follows Dynamic Type; board items don't.** Chrome text scales with `relativeTo:` matched to the web size. Board items are physical objects at fixed sizes and scale with zoom, as on the web.

### Materials: port the seeded geometry, prove it with goldens

Every seeded shape has to come out identical on both platforms, or a sticker's cut would differ between a friend's phone and laptop:

- **The ports:** `paper.ts` (`tornEdge`, `stickerCut`), `seededTone`, `slipSize`, `printSize`, the postage stamp perforations, and the audio `Waveform` bar layout become `Shared/PaperCuts.swift`.
- **Hash on UTF-16 code units.** The JS hash iterates `charCodeAt`, so Swift must iterate `.utf16`, not `Character`s. The PRNG is integer arithmetic, so results can match bit for bit.
- **Golden fixtures:** `scripts/paper-goldens.ts` writes `{seed, w, h} → d` for ~50 seeds. A Swift unit test asserts string equality on each.
- **One small path parser:** `Shared/PathParser.swift` handles `M L Q Z`. That covers torn edges, sticker cuts, drawings (`M/L`) and the letter hand (`M/L/Z`). No SVG library.

### Items: one component per material, measured against the web

The native item views read their exact constants from `nodes.tsx`, `flip-card.tsx` and `card-back.tsx`:

- **Postcard:** 300×220. The pending shimmer, ok and failed states. Stamp at 28 pt, `top-1.5 right-1.5 rotate-6`. The VISIT pill.
- **Slip:** 260 wide, 120/164/200 tall at ≤60/≤160/longer characters. The torn outline. A 96×24 washi strip at −2°. The three type steps: 16 / 13.5 / 12 pt with 4 / 6 / 7-line clamps.
- **Print:** fitted to the photo's aspect ratio, clamped to 0.6–1.8, 240 pt max. Frame 10 pt on top and sides, 32 pt chin. The blurhash bloom.
- **Sticker:** 96. The glyph at 62 pt on a hand-cut pad.
- **Drawing:** the stored path, 4 pt round-cap stroke.
- **Audio:** 300×112. A 48 pt play button, 40 bars, the mono duration.
- **Letter:** 300×375. The sheet with fold creases.
- **Card back:** the postmark row, the thread, the "write on the back…" input, and the reaction row with the author's trash.
- **Caption row under each card:** the chat chip, reactions, and the last two notes.

Each view gets a SwiftUI preview fed by the fixture JSON, next to the web's `/design` route for side-by-side review.

---

## 6 · GridKit, on web and iOS

GridKit (`acrosa/GridKit`) is a development-time overlay: columns, baseline rhythm, modules, key lines. It has a SwiftUI library and a React port (`web/`, `gridkit-react`), and both read the same JSON configuration. Both compile out of release builds.

### One grid file for both platforms

**`design/grid/psst.json`** (repo root, in GridKit's format) defines psst's grid for each layout mode in `DESIGN.md`:

| Mode | Grid (starting proposal — confirm by audit, below) |
|---|---|
| **Sheet** (auth, onboarding, dialogs) | single column, `max-w-sm` 384 / `max-w-md` 448 centered. 24 pt margins (the web's `p-6`). 4 pt baseline, emphasis every 4 (the 16 pt beat). |
| **Shelf** (spaces, timeline) | compact: 4 columns, 16 gutter, 24 margins. Regular: 12 columns inside `max-w-2xl`/`3xl`. Same baseline. |
| **Canvas chrome** (header, composer, corner indicators) | key lines for the header bottom (the web's `py-2.5` row), the composer's top edge, and the safe areas. The collage itself stays free. Items keep their free positions. The grid governs the chrome around them. |

Why a 4 pt base: the web's spacing already runs on Tailwind's 4 px steps (`DESIGN.md` favors 2/3/4/6/8 → 8/12/16/24/32). The native type scale (13–44) sits on it with line heights rounded to 4.

### Wiring

- **iOS:**
  - Add the Swift package (`https://github.com/acrosa/GridKit`, from `0.1.0`) to the **Psst** target only. The widget and share extension don't get it.
  - At the root: `.gridKit(.enabled(activation: .threeFingerLongPress))`. Shake would conflict with undo in text fields.
  - Bundle `psst.json` and load it on launch in DEBUG (`GridKit.shared.load(contentsOf:)`). Internal TestFlight builds can pass `force: true`.
- **Web:**
  - `gridkit-react` isn't on npm yet (the registry returns 404). **Recommended:** publish it from `GridKit/web` (its `prepublishOnly` already runs typecheck, tests and build), then add it as a `devDependency` of `apps/web`. Fallback: a pnpm git dependency on the `web/` subdirectory, which needs a `prepare: tsup` script in GridKit.
  - Mount `<GridKitOverlay safeArea={{ top: headerHeight }} />` in `root.tsx` when `import.meta.env.DEV`. It renders nothing in production.
  - Serve the same `design/grid/psst.json` at `/grid.json` in dev only, and load it with `GridKit.shared.load('/grid.json')`.
- **Both.** The overlay's JSON export writes back into `design/grid/psst.json`, so tuning on either platform updates the shared file.

### Using it

1. **Audit first (Phase 0).** Put the overlay on today's web screens at phone and desktop widths and record the off-grid spots. For example, the dot background's gap of 30 isn't on the 8 pt beat (it moves to 32, per D3), and the letter's 375 height isn't on the 4 pt grid. Fix what serves the design and document deliberate exceptions in `DESIGN.md`. The goal is a grid that describes psst, not one that repaints it.
2. **Build native against the grid.** Every native screen gets checked with the overlay before its phase closes.
3. **Review side by side.** GridKit snapshots (app + overlay) from iOS and the web at the same viewport go into the phase's review notes. Aligned key lines are the fastest visual proof that both platforms match.
4. **Add a `DESIGN.md` § Grid** covering the 4 pt base, the modes and the exceptions. That section becomes binding like the rest of the file.

---

## 7 · ★ Smoother on iPhone: touch, interaction by interaction

The goals from §1, in full. The web is the spec for *what* happens. These are the places the native board does it better, without changing how it looks:

| Interaction | Web today | Native |
|---|---|---|
| Pan / zoom the table | React Flow pointer physics | UIScrollView: momentum, rubber-band, bounce-zoom, 120 Hz on ProMotion |
| Move an item | drag after 4 px | drag after 4 pt. On lift: scale 1.03, `shadow-lift`, light haptic. On drop: soft haptic, then PATCH. |
| Resize | ⌥-drag handle / pinch on card | pinch on card (parity), clamped 0.6–1.75, a selection haptic at the clamps |
| Like | double-tap → 🫶 burst | same, plus a success haptic |
| Flip | tap (250 ms double-tap window) | tap with `onTapGesture(count: 2)` precedence. With Reduce Motion, a crossfade instead of the 3D turn. |
| Delete own item | trash on back / long-press × on stickers & drawings | the same, plus a `.contextMenu` on every own item (Delete, with the web's confirm copy). Long-press → native menu. |
| Small targets | chips ~28 px tall | same pixels, hit area expanded to 44 pt with `contentShape`. Visuals unchanged. |
| Open a link | new tab | system browser, same as the web view today. `SFSafariViewController` is an open decision (§11). |
| Photos | file input / paste / drop | `PhotosPicker`, camera, paste (`PasteButton`), and drag and drop from other apps on iPad |
| Voice note | MediaRecorder (webm or mp4) | `AVAudioRecorder` AAC m4a (`audio/mp4` is accepted server-side). Peaks computed natively into the same `{duration, peaks[40]}` meta. 60 s cap. |
| Pencil | pointer strokes, 1.4 s settle commits | the same stroke capture and settle timer, and the same `{color, d, w, h}` payload. Apple Pencil works for free. |
| Invite / share day | copy-link dialog | `ShareLink` (the system share sheet) with the same link, plus the email field in the sheet |
| Keyboard | — | composer and card-back inputs avoid the keyboard, and the board doesn't jump |

Haptics are a detail to perfect or cut (DESIGN.md rule 9). The ones listed above are the budget.

---

## 8 · Screens: web route → native

| Web | Native | Layout mode |
|---|---|---|
| `/login`, `/register`, social | `LoginView` (exists, shared) | Sheet |
| `/waitlist` | `WaitlistView`, driven by `403 {waitlisted}` | Sheet |
| `/onboarding` | `OnboardingSheet`: name the first space, then onto the board | Sheet |
| `/spaces` | `SpacesScreen` | Shelf |
| `/spaces/:id` | `BoardScreen`: header (`SpaceMenu` door, avatars, Invite), board, composer | Canvas |
| `SpaceMenu` (timeline, share day, settings, other spaces) | a native `Menu` on the space name | — |
| `/spaces/:id/days` | `TimelineScreen` with peeks | Shelf |
| `/spaces/:id/days/:date` | `BoardScreen(frozen:)`: the same board, read-only, "archived · left as it was" | Canvas |
| `/spaces/:id/settings` | `SpaceSettingsSheet`: rename or emoji, invites, leave | Sheet |
| `ProfileDialog` / `UserMenu` | `ProfileSheet`: name, photo, mention emails, password, delete account, sign out | Sheet |
| `InviteDialog` / `ShareDialog` | `InviteSheet` / `ShareDaySheet` with `ShareLink` | Sheet |
| `/invite/:token` | universal link → accept → board. Needs `applinks` in `aasa.ts` and the Associated Domains entitlement. | — |
| `/b/:token` (public day) | stays web: it's for strangers | — |
| `Lightbox` (photo, letter) | full-screen zoomable viewer, swipe down to dismiss | — |

**Parity checklist:** the Phase 5 exit gate. Every ✓ story in `USER_STORIES.md` §1–5 is walked on the native board, and each gets a line in the phase's review notes: works identically, or differs deliberately and why.

---

## 9 · Performance budget

- **Launch:** cold launch to a painted board in under 400 ms from cache on an iPhone 13-class device. Fresh data follows in the background.
- **Scrolling:** 120 fps pan and zoom with 60 items on the board (Instruments, Animation Hitches: under 5 ms/s).
- **Images:** decode off the main thread, cache in memory and on disk, request `thumb` on the board and `original` in the lightbox, same as the web.
- **Polling:** a `304` poll costs less than 1 KB, and nothing re-renders when the ETag hasn't changed.
- **Memory:** under 150 MB with 60 items including 20 photos.

---

## 10 · Testing and verification

| Layer | How |
|---|---|
| v1 API | Playwright `request` specs on SQLite (`pnpm test:e2e`), in CI as today |
| JSON contract | the e2e run writes `board.json`, `days.json` and `me.json` fixtures, which Swift `XCTest` decodes. A server shape change breaks the iOS test, not the app. |
| Seeded geometry | JS-generated goldens, compared by Swift string equality (§5) |
| Visual parity | Playwright screenshots of the fixture board at 393×852@3x (reusing the `store-screenshots.spec.ts` seeding) beside native snapshot tests of the same fixture, reviewed side by side on one page per phase. Exact pixel diffs aren't the goal because font rasterization differs. Aligned GridKit key lines are. |
| Flows | XCUITest: sign in → drop a note → flip → comment → react → drag → resize → delete, with `-psst.board native` |
| Both modes | the XCUITest smoke run also runs with `-psst.board web`, so the fallback can't rot |

**CI note:** Swift can't build in the Linux dev container. The iOS jobs need a macOS GitHub Actions runner (`xcodebuild test` on an iOS 26 simulator) or local runs in Xcode. Server and token/golden generation run anywhere.

---

## 11 · Phases

Every phase ships behind the switch, with `native` on in TestFlight and `web` in the App Store, so the App Store app is never worse than today.

**Phase 0 — Foundations**
- The switch (§2): `BoardExperience`, `Settings.bundle`, launch argument, `NativeRoot` placeholder, remote flag
- `/api/v1` (§4) with `requireApiUser`, ETag, `letterPath`, and `e2e/api-v1.spec.ts`
- `pnpm tokens` → `DesignTokens.generated.swift`, with a lint check for staleness
- Geist + Newsreader bundled in iOS
- GridKit wired on both platforms, `design/grid/psst.json`, and the grid audit of the web (§6)
- *Exit:* flag flips between an empty native root and the web board. v1 specs pass. The audit is written up.

**Phase 1 — Read the board**
- `BoardCanvas` pan and zoom, fitView, dot background
- All seven materials, pixel-matched, with previews and goldens
- Caption rows, flip to read backs, the lightbox and the letter reader
- Audio playback and VISIT
- Polling with ETag, and the cache
- *Exit:* the side-by-side visual review passes for every item type in light and dark.

**Phase 2 — Touch the board**
- Drag to move, pinch to resize, double-tap to like
- Reactions, comments with @mentions, delete (context menu, confirm)
- Optimistic updates with rollback
- Haptics
- *Exit:* two devices, one web and one native, rearranging the same board converge within one poll.

**Phase 3 — Drop things**
- Composer pill: URL → postcard, text → slip
- Sticker tray, PhotosPicker and camera, pencil, voice note
- In-view placement (the web's `inViewPlacement` math on the scroll view's visible rect)
- Paste and drag-and-drop
- *Exit:* every §2 story in `USER_STORIES.md` works natively.

**Phase 4 — Around the board**
- Spaces, space menu, timeline, frozen days
- Invite and share-day with `ShareLink`, settings, profile, onboarding, waitlist
- Universal links for `/invite/:token`
- Push and widget deep links into native navigation
- *Exit:* a new person goes from an invite link to dropping a sticker without meeting the web view.

**Phase 5 — Polish and parity**
- The parity checklist (§8) walked end to end
- The performance budget (§9) met
- Accessibility: VoiceOver labels per item ("Note from Sam: …", "Photo from Ana, 3 notes"), Reduce Motion, Dynamic Type in chrome
- Grid review of every screen
- *Exit:* checklist green, budget green.

**Phase 6 — Rollout**
- App Store build defaults to `native`, with the remote switch as the safety net
- After a quiet stretch, decide whether to retire the web board on iOS. Until that decision, `CanvasView` stays.

---

## 12 · Risks and open decisions

| | Risk / decision | Recommendation |
|---|---|---|
| R1 | **Drift:** web ships a change and iOS lags | Tokens generated from the web, a stale file fails lint, goldens and the JSON contract fail CI. Add a `CLAUDE.md` rule: board UI changes land on both, or behind the switch with a note. |
| R2 | Gesture arbitration (item drag vs. pan vs. pinch) | UIKit recognizers with explicit delegate rules, built and tuned first in Phase 1 on a stub board before any material work |
| R3 | Font rendering differences (Geist/Newsreader via CoreText vs. browsers) | Accept sub-pixel differences. Judge by line breaks and key lines, not pixels. |
| R4 | Two clients = double QA | The UI-test smoke run in both modes, and the parity checklist as the only gate |
| D1 | **Floating chrome material:** Liquid Glass (iOS 26 idiom, already on `LoginView`'s CTA) vs. the web's `bg-card/90 backdrop-blur` | **Decided:** glass for floating chrome only (composer pill, header controls). It's the platform's version of the same gesture. Content and sheets stay paper. |
| D2 | Links: system browser vs. `SFSafariViewController` | Keep the system browser (parity with today). Revisit after Phase 5. |
| D3 | Dot grid gap 30 → 32 to sit on the 8 pt beat | **Decided:** 32, on both platforms. The web change lands in Phase 0. |
| D4 | `gridkit-react` distribution | **Decided:** publish to npm (§6) |
| D5 | Mac menu-bar panel on the native board later | Out of scope. Keep the board core free of UIKit outside `BoardCanvas` so it's possible. |

---

## 13 · File map (new or changed)

```
apps/ios/Psst/
  Psst/PsstApp.swift                  # the `switch Config.boardExperience`
  Psst/Settings.bundle/               # "Native board" toggle
  Psst/Native/
    NativeRoot.swift                  # navigation root for .native
    Board/  BoardScreen · BoardCanvas · BoardStore · Composer · DrawLayer
    Items/  Postcard · Slip · Print · Sticker · Drawing · Audio · Letter
            FlipCard · CardBack · CaptionRow · Lightbox
    Screens/ Spaces · Timeline · Onboarding · Waitlist
    Sheets/  Invite · ShareDay · SpaceSettings · Profile
  Shared/
    Config.swift                      # + BoardExperience
    Models.swift                      # full BoardItem & friends (Codable)
    APIClient.swift                   # /api/v1, bearer, error mapping
    DesignTokens.generated.swift      # from pnpm tokens — do not edit
    PaperCuts.swift · PathParser.swift · Blurhash.swift
  Fonts/  Geist[wght].ttf · Newsreader[opsz,wght].ttf · Newsreader-Italic[opsz,wght].ttf
  PsstTests/  Decoding · PaperCutsGolden · BoardStoreMerge
  PsstUITests/ Smoke (both experiences)

apps/web/
  app/routes/api.v1.*.ts              # thin JSON routes
  app/lib/api.server.ts               # requireApiUser, error → JSON, ETag
  app/lib/design.ts                   # + PENCIL_COLORS
  app/root.tsx                        # + <GridKitOverlay/> in dev
  scripts/tokens.ts · scripts/paper-goldens.ts
  e2e/api-v1.spec.ts

design/grid/psst.json                 # the shared GridKit configuration
docs/DESIGN.md                        # + § Grid
docs/NATIVE_IOS.md                    # this plan
```
