# Bright Ears design and user-flow audit — 2026-07-31

## Verdict

Bright Ears did not have a weak visual identity. The ink, cream, cyan and
magenta/orange "Neon Collage" system was memorable. The weakness was hierarchy:
the homepage repeated the same mechanism across too many sections, while
onboarding exposed internal product plumbing before the artist reached the
simple promise they came for.

The redesign keeps the expressive music-scene identity and makes the experience
feel like one sentence:

> Build one artist profile. Bright Ears finds fitting venues and prepares the
> communication. You approve.

## What changed

### Homepage

- Replaced the long manual-like page with one narrative: outcome, three-step
  setup, the two product jobs, an interactive demo, proof, pricing and one final
  call to action.
- Changed the hero to "More gigs. Less chasing." and replaced abstract feature
  language with visible outcomes.
- Added an interactive booking-signal installation that turns scattered venue
  opportunities into three good matches and one approval-ready pitch. It adds
  depth on pointer devices, stays clear on touch screens and resolves into the
  complete product story without motion when the visitor prefers reduced
  motion.
- Changed the primary call to action from generic "Get started" to "Build my
  profile".
- Added plain-language confidence cues: no video required, saves as you go and
  month-to-month.

### Onboarding

- Renamed the five steps around the artist's mental model: basics, profile,
  voice, availability and go live.
- Made the essential path obvious and moved links, detailed rates, rider notes,
  travel preferences and residency bulk entry behind optional disclosures.
- Reduced the visual-proof gate from three photos to one clear photo. Three
  photos remain a profile-strength recommendation; video remains optional.
- Made one booked date the default calendar task instead of showing three rows
  and a residency builder at once.
- Made a single voice example sufficient and added a safe professional default
  for artists who want to continue.
- Reframed the final step around activating venue matching. Incoming-inquiry
  forwarding is a separate, optional capability that can be connected now or
  later.
- Removed the internal "hunting license" metaphor from artist-facing screens in
  favor of "pitch-ready profile" and "venue pitching ready".

## Product reasoning

- Artists need to understand the value before they are asked to understand the
  implementation. Internal terms such as signals, forwarding addresses and
  OAuth are support concepts, not first-run concepts.
- A requirement should exist only when the product cannot represent the artist
  responsibly without it. One strong image is sufficient for an initial venue
  pitch; a fuller gallery improves the EPK but does not justify blocking value.
- Optional fields should look optional and remain out of the main path.
- Motion earns its place when it makes invisible work legible.

This follows established form guidance: ask only what is needed, put the common
path first, explain why a question is asked, and use branching/progressive
disclosure for less common cases. See [GOV.UK form
structure](https://www.gov.uk/service-manual/design/form-structure) and
[question pages](https://design-system.service.gov.uk/patterns/question-pages/).
Required and optional labels should be consistent, as summarized in
[Baymard's form-field research](https://baymard.com/guidelines/686-indicating-required-and-optional-fields).
Motion behavior follows the W3C technique for
[`prefers-reduced-motion`](https://www.w3.org/WAI/WCAG22/Techniques/css/C39).

## What did not change

- The approval-before-send control on Starter.
- The data required for safe matching: act/style, home city and fee floor.
- The short bio and one booked date required for credible, availability-aware
  venue pitching.
- The detailed settings available to artists who want more control.
- The calm, data-first design of daily dashboard screens.

## Follow-up after launch

Watch setup completion by step, time to first activated scan, photo-upload
drop-off, calendar-step skipping and the percentage of artists who later connect
incoming-inquiry forwarding. Those numbers should decide whether the flow needs
further reduction; preference should not be guessed from aesthetics alone.
