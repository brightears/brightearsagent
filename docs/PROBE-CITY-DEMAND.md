# City Probe — opportunity-volume gate (June 12, 2026)

Gate for ADR-004 Phase 10. Three parallel research agents measured **publicly visible** opportunity volume for a representative mobile-DJ / small-act profile in three metros: posted demand (fresh "need a DJ/performer" posts, last 7 days) and venue-prospecting signals (new/opening venues, last 60 days). Method: live web search + page fetch only — no logins. Counts are an explicit **floor on public visibility, not on true demand.**

## Results

| Metro | Public posted demand (7 days) | Venue signals (60 days, med-high+) | Public-scraping verdict |
|---|---|---|---|
| Austin TX | ~0–1 fitting fresh posts | 7 pitchable | NO (~90% confidence) |
| Nashville TN | ~0–1 fitting fresh posts | 6 med-high/high | NO (high confidence) |
| Manchester UK | 0 confirmed | 6 high | NO (high confidence) |

Against the ≥10 fitting-opportunities/week/metro bar: **public posted demand fails everywhere, decisively.** Craigslist was fully fetched in all three (genuine near-zero, not a visibility gap); every indexed Facebook "ISO DJ" post was a year stale or non-local; Gumtree is dead for this; Reddit/Nextdoor surfaced nothing in-window.

## What the probe actually proved

1. **Scraping public gig posts has no raw material.** This kills public-post scraping as a primary engine — in the US *and* outside it. We'd have built a harvester for an empty field.
2. **The demand is real but lives behind walls.** Nashville hosts 10–15k weddings/year + the #1 US bachelorette market; GigSalad alone logs ~4,933 wedding-DJ quotes/year platform-wide. None of it is publicly postable — it flows through (a) login-gated marketplaces, (b) private Facebook groups, (c) broker/concierge funnels, (d) DMs and referrals. A newcomer with no marketplace memberships sees none of it.
3. **Venue prospecting is the engine that survives — consistently, in every metro, in both countries.** ~1–1.5 *hot* new venues/week (openings) per metro, fully publicly visible and genuinely actionable. And openings are only the warm tip: the addressable set is every standing bar/hotel/event-space in a metro (hundreds), prioritized by signal. The agent never runs out of venues to pitch.

## Implication for the build (recommended re-scope)

- **Venue prospecting becomes the SPINE, not the differentiator.** It is the only discovery engine with abundant raw material that works for the chosen target (newcomers) on day one, globally, without requiring any pre-existing membership or inbound flow.
- **Public-post scraping is demoted/cut.** Not worth building for the volume.
- **Posted-demand survives as a SECONDARY engine that activates with the artist's own marketplace memberships** — i.e. forwarded GigSalad/Bark/Bash lead-alert emails parsed by the existing reactive pipeline. Bonus when present; never the spine.

## Honest remaining unknown (the next gate)

The probe proved there are **venues to pitch**. It did **not** prove **venues reply**. Cold venue-pitch conversion is still unmeasured and is the real risk — it stays the beta gate (instrument reply-rate per channel from day 1; ≥30% of beta artists get ≥1 real conversation within 14 days before charging). Supply is proven; conversion is the bet.
