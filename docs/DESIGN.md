# psst — design definitions

> "You have to make every single detail perfect, and you have to limit the number of details." — Jack Dorsey

This document is the design authority for psst. Every screen, component, and copy change is measured against it. The inspiration behind it lives in `docs/design/inspiration/` — study those images before designing anything new.

## The thesis, applied

psst is **a quiet paper surface where the things friends share provide all the color**. The aesthetic of subtraction: one strong gesture per surface, everything else whispers. What's important — sharing, connection, effortless onboarding — gets full craft; everything orbiting it gets cut.

Ten rules that fall out of the inspiration set:

1. **Paper ground, quiet chrome.** Near-white warm ground everywhere. Controls are small, monochrome, corner-anchored. The UI should read as an empty table, not an app frame.
2. **One gesture of color per surface.** Like the Casey MIT posters and the rainbow pencil stroke: a single bold accent moment (the terracotta CTA, a colorful collage of items) against calm paper. Never two competing accents on one screen.
3. **Content is physical.** Items are keepsakes with material identity: photo prints (polaroid chin), paper slips, postcards with stamps, die-cut stickers with a thick white border and soft shadow, slightly rotated. Nothing floats as a naked rectangle.
4. **Massive negative space.** Swiss-poster discipline: content occupies a strict, generous grid; emptiness is a feature. Don't fill space — protect it.
5. **One primary action per screen.** A single pill CTA (welcome screen pattern). Secondary paths are quiet text links. If a screen needs two primary buttons, the screen is wrong.
6. **Micro-delight is functional.** One crafted micro-interaction per surface, always in service of a real function (the tick-rail scrollbar, the blurhash bloom, the card flip). Decoration that does nothing gets cut.
7. **Chrome uses icons, content uses emoji.** Lucide stroke icons for interface (never emoji-as-UI); emoji remain content — stickers and reactions.
8. **Type has three voices, each with one job** (see Type).
9. **Detail budget.** Adding a detail means it will be perfected: hover state, empty state, dark mode, motion. A detail we won't perfect is a detail we don't add.
10. **Everything flows.** No settings where an automatic behavior works. No confirmation where undo would do. Zero-friction onboarding: link → canvas in seconds.

## Color

Tokens live in `apps/web/app/app.css` (`@theme`); dark mode derives automatically from `prefers-color-scheme` (no toggle).

| Token | Light | Role |
|---|---|---|
| `paper` | `#faf6ef` | The ground. Warm near-white, never pure white. |
| `paper-deep` | `#f1eadb` | Hover washes, shimmer placeholders. |
| `ink` | `#40382f` | Primary text. Warm dark brown, never black. |
| `ink-soft` / `ink-faint` | `#8d8375` / `#c9bfae` | Secondary text / hints & hairline moments. |
| `card` | `#fffdf8` | Item and sheet surfaces. |
| `line` | `#e7dfcf` | Borders, dividers. Hairline only. |
| `accent` | `#e2725b` | Terracotta. THE accent — CTAs, the stamp, focus. One gesture per surface. |
| `accent-deep` / `accent-soft` | `#c95a44` / `#fae3dc` | Hover / tinted wash (errors, pressed). |
| `blush · sky · meadow · butter · lavender` | pastels | Content-only paper tones (slip backs, seeded per item). Never chrome. |

Rules:
- Chrome is monochrome (`ink-*` on `paper`/`card`). Accent appears once per surface.
- Saturated color enters only through member content — photos, stickers, link unfurls.
- Dark mode is "paper after sundown": same relationships, tokens re-inked (`:root.dark` in `app.css`). Every new color must be defined for both.

## Type

Three voices, one job each. Faces load from Google Fonts with real fallbacks (see `root.tsx`). **No handwritten or script faces** — warmth comes from the serif, the paper palette, and the copy, never from scribbles.

| Voice | Face | Job | Never |
|---|---|---|---|
| **Serif** | Newsreader (`font-serif`) | The editorial voice, two registers. Roman: page/sheet/dialog titles, member content (card-back threads, comment input, note chips). Note slips speak typewriter instead — the one material-specific voice. *Italic*: system whispers — empty states, loading lines, overlay prompts — and the `psst` wordmark. The Wanderly/NOOK look. | Buttons, forms, functional labels |
| **UI** | Geist | Everything interactive: buttons, labels, body, forms. Sizes from the `--text-*` scale. (Vercel's open-source Geist Sans, SIL OFL — the font is open even though their icons are not.) | Display headlines, member content |
| **Meta** | mono (system stack) | Tiny technical labels: dates, counts, timestamps — uppercase, letterspaced, `text-xs`, `ink-soft`. The EXIF-chip feel. | Anything longer than a few words |

- The register rule: **roman = words that carry content (titles, what members wrote); italic = the app whispering** ("psst — drop something here", "setting the table…", "tucking it in…").
- Type scale is fixed in `app.css` (`--text-xs` … `--text-3xl`). No ad-hoc sizes.
- Letterspaced uppercase (`tracking-wider uppercase text-[11px] font-semibold`) marks small functional labels (VISIT pill pattern).

## Layout

Three layout modes; every screen is one of them:

1. **Canvas (the table).** Free collage. Items at fixed base sizes (`ITEM_SIZES` in `design.ts`) × member scale (0.6–1.75), rotation jitter ±3°, drop-where-it-lands. Chrome floats at the edges: header bar, bottom composer pill, corner indicators. Nothing overlays the middle.
2. **Shelf (organized views).** Timeline, spaces list, future space-items view. Swiss grid: generous fixed gutters, rounded-rect cards (`radius-lg`) on `paper`, one heading per section, huge margins. Collections may render as physical objects (fanned prints, a shelf) when we can perfect it — otherwise a calm grid.
3. **Sheet (focused moments).** Auth, onboarding, dialogs, settings. One column, max-w-sm/md, one serif/hand headline, one primary pill CTA, quiet secondary link. The welcome-screen pattern: content breathes, a single card slides over a full-bleed moment.

Shared:
- Radii: `radius-sm/md/lg/xl` tokens only. Cards are `rounded-lg`+.
- Shadows: `shadow-card` (resting) and `shadow-lift` (floating). Nothing else.
- Spacing: Tailwind steps, favoring 2/3/4/6/8. When unsure, add space, not chrome.
- Indicators: the caption row beneath the card (left-aligned) carries the chat chip + reactions and IS the flip control — no edge tabs. Actions overlay bottom-right on the card face (VISIT).

## Materials

The physical identity of each item type — keep them distinct and true:

| Item | Material | Signature details |
|---|---|---|
| Link | Postcard | Unfurl image, scallop-perforated stamp (`accent`, SVG mask), VISIT pill, favicon + site in meta voice |
| Note | Torn paper scrap | Seeded deckled edges, a washi-tape strip, typewriter voice (American Typewriter/Courier stack) — type scales down and top-aligns as the note grows |
| Image | Photo print | White polaroid frame + deeper chin, sized to the photo's aspect ratio (never clipped; extreme ratios gently clamped), blurhash bloom on load |
| Emoji | Die-cut sticker | The glyph on a white hand-cut circular pad — edge gently irregular, seeded per item — with a soft shadow; silent — no back, no thread, no reactions |
| Drawing | Pencil stroke | Free strokes in one palette color, floating directly on the paper; silent like stickers |
| Voice note | Speaking slip | Paper pill: round play button, static waveform (played bars in ink), mono duration; under a minute. *(Seed: auto-transcript, expandable for when listening isn't possible.)* |

Card backs are the postmark side: author, time (meta voice), the small thread (hand voice), reactions.

## Motion

- Entries pop (`animate-pop-in`), placeholders shimmer (`animate-shimmer`), cards flip in 500ms 3D. That's the vocabulary; reuse it.
- Motion always explains something (arrival, loading, two-sidedness). Max one new motion idea per feature, perfected.

## Voice

Lowercase whispers, warm and brief: "psst — drop something here", "tucking it in…", "that page wandered off". Copy is a detail too — every string gets the same care as every pixel. No exclamation points, no jargon, no apologies.

## Inspiration index (`docs/design/inspiration/`)

- `canvas layout` — viewer chrome: corner controls, meta chips, content dominates
- `colors and layout` — stamps, pastel washes, editorial headline + eyebrow label
- `grid layout 1–3` — Casey posters: one bold motif, strict grid, negative space
- `draw freely (pencil)` — subtraction: one vibrant stroke on white *(shipped: the composer pencil)*
- `canvas resize items` — corner-handle selection, sticker collage *(shipped: option-drag resize)*
- `ios app` / `ios signup welcome` — quiet mobile canvas; one-CTA sheet *(shipped: social-first auth; the pastel-backdrop sheet was tried and cut — decoration lost to minimalism)*
- `organize shared items 1–2` — collections as shelves/folders *(concept seed: space items view)*
- `scroll timeline 1–2` — tick-rail scrollbar *(shipped: the scrapbook rail)*
- `stickers idea (border)` — die-cut white borders *(shipped: seeded hand-cut pads)*
- `type font` — display type as a single confident gesture

Concept seeds are directions the inspiration points at — not commitments. Each ships only when it can be perfect.
