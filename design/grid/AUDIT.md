# Grid audit — Phase 0

The web app measured against `psst.json` at iPhone width (393 × 852, the
viewport the native board will match), 2026-09-29. Method: Playwright read
the boxes of every screen's chrome and text; GridKit's overlay confirmed them
by eye (`pnpm dev`, then ⌥⇧G). Numbers are CSS px = iOS pt.

## What already sits on the grid

| Where | Measured | Grid |
|---|---|---|
| Header height (every app page) | 60 | ✓ 4 pt (15 × 4). The **Header** key line. |
| Header side insets | 16 | ✓ the **Chrome inset** key lines |
| Account corner (avatar button) | 40 × 40 at y 10 | ✓ |
| Shelf pages' content margin (spaces, timeline, settings) | 24 | ✓ the column margins |
| Page titles (h1) top | 84 (60 + 24) | ✓ |
| Inputs and buttons | 40 tall; 36 icon buttons | ✓ |
| Composer pill | 54 tall, top at 784 (68 from the bottom), 32 side insets | ✓ top edge = the **Composer** key line; 54 is off-beat (see below) |
| Item sizes (`ITEM_SIZES`) | 300 × 220, 260 × 200, 264, 96, 300 × 112 | ✓ all on 4 |

## Off the grid

| Where | Measured | Why | Call |
|---|---|---|---|
| **Line heights, everywhere** | 15 / 21.4, 17 / 25.5, 34 / 45.3, 44 / 52.8 | Tailwind's default line heights are ratios of the font size, so text boxes land on fractions | **Fix in Phase 1** with explicit line-height tokens on the 4 pt grid, each the nearest multiple of 4 to today's: xs 13/16 · sm 15/20 · base 17/24 · lg 20/28 · xl 26/36 · 2xl 34/44 · 3xl 44/52. It nudges the web's type by at most 1.5 px a line, so it lands with the native type and the side-by-side review — one change, both platforms. |
| Sheet column (login, register, onboarding) | content at x 28.5 | a centered `max-w-sm` (384) inside 393 leaves 4.5 each side, plus `p-6` | Deliberate: centering a readable column wins over the margin on phones between 384 and 432 wide. iOS draws the same 384 column centered. Documented exception. |
| Composer pill height | 54 | 36 input + 2 × 9 padding | Move to 56 (padding 10) in Phase 3 when the native composer is built against it. |
| Letter sheet | 300 × 375 | 120 × 150 mm at 2.5 px/mm | Deliberate: the sheet's proportions are paper, not layout. Exception. |
| Board dot grid | was 30 | predates the grid | **Fixed in Phase 0:** 32 (`BOARD.dotGap`), on the 8 pt beat. |

## The grid, in short

4 pt base, 16 pt beat. Four columns inside 24 pt margins with 16 pt
gutters for shelves and sheets; chrome insets at 16. Key lines at the
header's bottom (60) and the composer's top (68 from the bottom). The collage
stays free: items keep their dropped positions; the grid governs the chrome
around them. Binding definitions: `docs/DESIGN.md` § Grid.
