# Bright Ears — Design Language v2: "Neon Collage" (founder-picked June 11, 2026)

Chosen from three coded directions (`/design/b` is the canonical preview). Reference: royalstreaming.com's true language — dark, electric, playful, music-scene. Founder's addition: weave in the Bright Ears brand colour, **ceylon blue/cyan #00bbe4**.

## The three-voice palette (tokens in app/globals.css)
- **Ink canvas** `--color-ink-stage: #17161f` — the page background everywhere (marketing AND app). Faint concentric thin-line rings (low-opacity radial pattern) allowed once per page, in heroes/bands.
- **Cream posters** `--color-cream: #e8e4dc` — content lives on cream (marketing) or white (`#fff`, app data cards) rounded-3xl panels floating on the ink, with collage compositions and sticker chips. Slight tilts (±1-2°) on marketing panels only — never tilt app data cards.
- **Ceylon cyan** `#00bbe4` (existing `--color-brand-cyan`) = **the PRODUCT voice**: primary interactive elements in the app (buttons, active nav pills, focus rings, links, toggles, selected states), the wordmark dot, trust badges. Cyan is what you click.
- **Magenta→orange** `--color-neon-magenta: #ff2dae` → `--color-neon-orange: #ff8a00` = **the SHOW voice**: gradient display headlines, gradient-painted pull quotes (word-by-word spectrum), celebration moments (Booked 🎉), sticker chips, marketing CTAs ("Start free" = solid magenta pill), stat heroes. Magenta/orange is what makes noise.
- Warm white text on ink: `#f5f2ec`-ish (use cream at 90%+ opacity); secondary text on ink = cream/55%. On cream panels: ink text.

## Typography
Geist (existing), pushed hard: display = text-6xl–8xl, font-extrabold/black, tracking-tight; headlines on ink are warm white with ONE word gradient-painted (B's signature), full-gradient headlines reserved for the biggest hero moments. Mono (Geist Mono) for sticker chips and small labels, uppercase, tracked wide.

## Signature elements (use these, don't invent new ones)
- **Collage art**: pure CSS/SVG compositions — orange vinyl (radial-gradient grooves + magenta center label), ink studio speaker, white halo ellipse ring, gradient blur blob — arranged on cream panels. Components live in `components/collage.tsx` (build once, reuse).
- **Sticker chips**: small rotated mono-font pills ("REPLIED IN 4:51", "NOW PLAYING — YOUR REPLY", "APPROVED ✓") — magenta or cream, used as playful annotations on panels and (sparingly) real UI states.
- **Gradient pull quotes**: whole quote colored word-by-word along the magenta→orange spectrum, on cream or ink.
- **Buttons**: marketing primary = solid magenta pill, white text, subtle glow; app primary = solid cyan pill (the daily-click color); ghost = cream/ink outline pill. All pill-shaped (rounded-full).
- **Status colors (app)** keep meaning but restage: NEW cyan · DRAFTED magenta-soft · REPLIED cyan-soft · IN_SEQUENCE orange-soft · ENGAGED magenta-soft · BOOKED gradient (the celebration) · DEAD cream/40.

## App-specific rules (daily-use ≠ poster)
Ink canvas, white data cards (no tilt, no grain), cyan primary actions, generous spacing; magenta/orange only for: status accents, the Booked celebration, empty-state art, and the weekly-report highlights. Charts/dense data stay calm. Forms: cream-tinted inputs on white cards, cyan focus ring.

## Voice in UI copy
Unchanged: warm, brief, second person ("Reply ready", "Gone quiet", "You'll hear the ping"). Mono sticker-speak allowed for chips ("REPLIED IN 4:51").

## Don'ts
No pastel gradients-on-white (the failed v1). No pure-black (#000) — ink is #17161f. No more than one ring-pattern per page. No tilted/collaged DATA cards in the app. Never use magenta for destructive actions (quiet red outline stays). The cyan/magenta split is law: interface = cyan, show = magenta.
