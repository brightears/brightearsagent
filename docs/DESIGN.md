# Bright Ears — App Design Language

The dashboard must feel like the marketing site's sibling: **light, colorful, generous, fun** — royalstreaming.com energy with our palette. Never dark, never dense, never gray-on-gray "admin panel."

## Palette usage (tokens in app/globals.css)
- **Page background:** `bg-background` (#fdfcfb). Section accents: very soft tints (`bg-brand-cyan-soft/30`, `bg-soft-lavender/20`, `bg-warm-peach/20`) — color as air, not paint.
- **Cards:** white, `rounded-2xl`, `border border-off-white`, `shadow-sm`; on hover (when clickable) lift to `shadow-md` + `border-brand-cyan/40`.
- **Primary action:** `bg-brand-cyan` white text. One per view. Secondary: deep-teal outline. Destructive: quiet red outline.
- **Headings:** `text-deep-teal` bold. Body: `text-ink` / 60-70% opacity for secondary.
- **Status colors** (single source: `LEAD_STATUS_META` in components/ui.tsx): NEW cyan · DRAFTED lavender · REPLIED cyan-soft · IN_SEQUENCE peach · ENGAGED lavender · BOOKED deep-teal · DEAD off-white.

## Patterns (use the primitives — never re-invent)
- **PageHeader** (`components/ui.tsx`): title + subtitle + optional action button, sitting on a soft gradient band (`from-brand-cyan-soft/40 via-soft-lavender/20 to-warm-peach/30`), rounded-3xl. Every dashboard page starts with one.
- **EmptyState**: big emoji, warm one-liner, optional CTA. Never a bare "—". Empty pipeline column: tiny friendly dash-line illustration feel via emoji + muted copy.
- **StatPill**: small rounded stat chips for header metrics (e.g. "24 active", "9 spam filtered").
- **BrightEarsLogo**: the only way the logo is rendered (deep-teal rounded tile, sized variants). No raw `<Image src="/brand/logo.svg">` anywhere else.
- **Forms:** labels `text-xs font-semibold text-ink/60 uppercase tracking-wide`; inputs `rounded-xl border-off-white focus:border-brand-cyan` with visible focus ring `ring-brand-cyan/30`.
- **Spacing:** sections `space-y-6`; card padding `p-6`; page gutters `px-6 py-8`; max-width per page kind (pipeline 7xl, detail 4xl, settings 4xl).

## Voice in UI copy
Warm, brief, second person, zero jargon: "Reply ready", "Gone quiet", "You'll hear the ping", "No leads yet — your forwarding test will land here." Emojis allowed, sparingly, where celebratory (🎉 on Booked).

## Don'ts
No dark backgrounds. No gray admin-table aesthetics. No more than one gradient band per screen. No new colors outside the palette. No dense borders-everywhere layouts — whitespace is the layout.
