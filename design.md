# Design — Masterpiece Timer

A locked design system for this app. Every page redesign reads this file before
emitting code. Do not regenerate per page — extend or amend this file when the
system needs to grow.

/* Hallmark · pre-emit critique: P5 H5 E4 S5 R4 V4 */

## Genre
editorial (atelier / museum) with Apple Liquid Glass on the **functional layer only**.

## Macrostructure family
- App pages: Workbench — identity, one primary action, grouped paper lists
- Immersive pages (focus / setup): stage + chrome, no tab bar
- Content pages (gallery): hero artwork, paper lists beneath

## Theme
Liquid Glass is chrome. The painting and the canvas are content.
Do not put glass on lists, full-page backgrounds, or stacked on other glass.

- `--color-paper`   oklch(96% 0.012 85)
- `--color-paper-2` oklch(99% 0.008 85)
- `--color-ink`     oklch(22% 0.02 70)
- `--color-ink-2`   oklch(22% 0.02 70 / 0.62)
- `--color-rule`    oklch(22% 0.02 70 / 0.10)
- `--color-accent`  from artwork (`--tint`), fallback oklch(48% 0.06 75)
- `--color-focus`   var(--tint)

Dark paper: oklch(18% 0.015 70). Dark ink: oklch(94% 0.01 85).

## Typography
- Display / body: system-ui stack (SF Pro Text, PingFang SC). Roman headings.
- Mono: SF Mono / ui-monospace
- Display tracking: −0.03em on the timer only
- Type scale: tokens in `src/styles/tokens.css`

## Spacing
4-point named scale (`--space-1` = 4px … `--space-10` = 40px). Pages must use named tokens.

## Motion
- `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`
- `--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1)`
- Press 100–160ms scale(0.97). Sheets 200–400ms.
- Never `scale(0)`, never `transition: all`, never animate keyboard-frequent actions.
- Reduced motion: opacity ≤ 150ms. Reduced transparency: no blur, higher fill.

## Microinteractions stance
- silent success
- press feedback on pointer-down
- hover only under `(hover: hover) and (pointer: fine)`

## CTA voice
- Primary: tinted glass pill, 52px min height
- Secondary: quieter glass / fill pill

## What pages MUST share
- System font stack
- Canvas as page ground (never a flat void)
- Glass only on tab bar, sheets, chips, icon buttons, floating chrome
- Paper cards for lists
- Artwork-derived `--tint*`

## What pages MAY differ on
- Immersive focus has no tab bar
- Gallery may use a full-bleed hero of the completed work

## Canvas
Default user canvas lives in settings. During focus, the artwork’s historical support wins.
