I have a complete, decision-ready synthesis from the three research inputs. The brief is explicitly scoped to a product decision document, not codebase changes, so I'll produce the markdown directly.

# Onboarding Step 2 Redesign — "Who you are," not "What you sell"

## 1. The shift in one line

**Package catalog → artist-profile-first.** Stop asking the artist to pre-build event-typed packages (a "6-hour wedding package" tagged wedding/corporate/school-dance) and instead capture *who the artist is* — craft, style, links, media — plus 2-3 cheap pricing dials. This widens matching because the Hunt scores on *artist attributes* (genres, reach, fee fit), and a richer artist profile means more opportunities clear the bar; a wedding-typed package, by contrast, trains both the artist and the AI to think in one narrow lane. **Confirmed by the codebase:** the Hunt never reads `Package` — it matches on `Business.genres / eventTypes / serviceCities`, so dropping the package builder loses *zero* hunting signal while removing the narrowing frame.

---

## 2. The new onboarding flow

Five steps stay; **step 2 changes from "What you sell" to "Who you are."** Target: ready in ~3-4 minutes, enrich later.

**Step 1 — You & where you work** *(largely unchanged; add currency derivation)*
- Act name, your name, craft kind, **country** → silently derives fee currency (TH→฿THB, GB→£GBP). Timezone, website.

**Step 2 — Who you are** *(the redesign)* — ordered front-loaded for matching signal, ending on a low-effort confirm:

| # | Field | Label / question | Required? | Notes |
|---|---|---|---|---|
| 1 | **Craft** | "What do you do?" (DJ, band, singer, dancer, magician, MC…) | **Required** | Primary matching axis. |
| 2 | **Genres / styles** | "Your sound / style" (multi-tag) | **Required** | The widest non-narrowing signal — drives `score.ts` full-credit. |
| 3 | **Vibe one-liner** | "Describe your act in one line" | **Required** | Becomes `headline`. ≤80 chars. |
| 4 | **Paste your links** | "Drop your links — we'll build your profile" (website, Spotify, SoundCloud, Instagram, YouTube, Mixcloud, Bandcamp, Linktree) | Optional, **strongly prompted** — visual centerpiece | Auto-drafts bio + pulls media/stats (see §4). |
| 5 | **Bio** | Auto-drafted from links, artist edits | Optional | ≤3 short paragraphs + a ~50-word version. Empty is worse than short — prompt hard. |
| 6 | **Photo + video** | "One great action shot" + 1-2 videos | Photo strongly prompted; video optional | #1 booking driver. Target 5-10 photos / 2-3 videos — *cap it*, don't let uploads drown the step. |
| 7 | **Highlights** | "Notable gigs / venues / press" (2-3) | Optional | Cheapest credibility signal (`notableVenues`, `reviewQuotes`). |
| 8 | **The dials** | Work type + fee floor + travel (see §3) | **Fee floor required**; rest optional | The 2-3 structured signals. |
| 9 | **Review** | Confirm the auto-drafted profile | — | Low-effort finish. |

**Steps 3-5** (Voice samples, Calendar, Connect) unchanged.

**Where things live:** craft/style/press-kit/links/media = **all in step 2** (reusing the existing Phase-10.1 `Business` profile fields and `updateArtistProfile`). Pricing = the **dials at the end of step 2**. Event-typed *packages* move out of onboarding entirely to the existing `/dashboard/packages` manager, where they still feed reactive inbound quoting.

**Minutes-to-ready gate:** craft + genre + one-liner + fee floor (+ ideally one link or photo). Everything else is nudged later via a **profile-strength meter** framed as "more & better gigs," not chores.

---

## 3. Pricing model

The lightest input that lets the AI quote without ever underpitching — **2-3 dials, no event-type grid, all in local currency:**

1. **Work type** (multi-select, non-narrowing routing signal): `One-off gigs` / `Residencies` / `Both` + **"Open to travel"** checkbox.
2. **One-off floor** — *"Lowest you'll take a one-off gig for"* → `from ฿X`. **The only truly required number.** Every working artist carries this in their head and answers in two seconds; it's the anti-underpricing guardrail and the one price input artists actually tolerate.
3. **Residency rate** (shown only if Residency/Both) — *"Your going per-night rate for a regular slot."* Single number or range. Residencies trade per-night rate for recurrence, so the AI must never pitch one at the one-off floor or vice versa.

**Optional / progressive:** a *typical/target* one-off number (gives the AI a from→to band so quotes read "from ฿X, typically ~฿Y," never bare floor) + a free-text pricing note ("flex up a lot for corporate; weekday discounts fine") the AI reads as soft context.

**Quote behavior:** the AI computes each quote at inquiry time from `floor` + the opportunity's facts (duration, travel, date demand, budget signals). It's **hard-blocked from drafting anything below the floor.** Public/EPK shows "from ฿X" or nothing — never a hard fixed price (artists reject that).

**Currency:** derived from the step-1 country via an explicit `country → ISO-4217` table (not heuristics; Eurozone all → EUR). Store every fee as `{ amount, currencyCode }`. Format locale-aware, whole-unit rounding, show the ISO code at the input ("Your fees in ฿ THB") to defeat the `$`-collision. **Strictly walled off from USD subscription billing** — different fields, different code paths.

---

## 4. Link ingestion — "paste your links, AI builds your profile"

**Design:** in step 2, the artist pastes website + streaming/social links. We fetch the own-site + sanctioned-API sources, hand the text to an LLM extractor, and **pre-fill** headline/bio/genres/media for the artist to *approve and edit* — never silent-write. This matches the never-invent / white-label discipline and is a credible differentiator: no consumer booking platform today auto-*builds* an EPK from links — they only display pasted ones.

**Feasibility — heavy reuse, low new infra:**

| Source | Effort | Approach | Risk |
|---|---|---|---|
| Own website | **S-M** | Reuse `contacts.ts:fetchPage` + `llmObject("parse")` with a new `ArtistProfileSchema` | Low (owner's own site). React SPAs return empty HTML → partial coverage. |
| Spotify | **S** | No-auth oEmbed (name/image/embed) or authed Get-Artist (genres/followers) | Low; attribution required. |
| SoundCloud | **S-M** | oEmbed + `client_id` metadata | Key registration intermittently closed — verify. |
| YouTube | **S** | Pasted link → existing `videoEmbedUrl` | Low. |
| Instagram | **M-L** | **Accept pasted handle/bio text only — do NOT crawl** | Highest (anti-bot, ToS); repo already treats IG as a skip-aggregator. |

The LLM extractor is a near-clone of the existing `serper.ts` fetch→`llmObject`→zod-with-sentinels pattern; cost is sub-cent per extraction. **Verdict: fast-follow, not v1.** Ship the profile-first UX with *manual* fields first (the real UX win, no external dependencies), then layer ingestion (own-site + Spotify/SoundCloud/YouTube) as the magic-moment enhancement. The legal posture is clean for own-site + sanctioned APIs; the only land-mine is IG crawling, which we avoid.

---

## 5. What to DROP — and how the Hunt searches WIDER, not blind

**Drop:** the package builder from onboarding; the mandatory "≥1 package to advance" gate; the rigid `EVENT_TYPES` chip list (including the odd "school dance"); the hardcoded-USD `priceLabel`/`usd` formatter; default `types=["wedding"]`.

**How matching adapts — and why it gets wider, not blind:**
- **`serper.ts` (search queries):** queries are built from `city`/`year` **only** — they were never personalized by genre or event-type. So dropping packages changes **zero search queries.** The net cast is unchanged in width.
- **`score.ts` (fit scoring):** genres already carry **full credit (25)**; event-types carry only **half credit (12.5)**. Keep `Business.genres` as the dominant signal, keep `Business.eventTypes` as a *free-form breadth list* (weddings/corporate/club nights — not a per-event package), and **add the new dials** (`gigTypes` one-off/residency/both, `acceptsTravel`) to replace the narrow event-type credit. Result: more opportunities clear the bar because we match on broad artist attributes, not one event lane.
- **`scan.ts` (orchestration):** reads `serviceCities` + `country` only — unaffected.
- **`venue-pitch.ts` (outreach):** reads `genres`, `eventTypes`, `feeFloor`, `headline`, `bio` from `Business`, never from `Package`. The `feeFloor` guard stays. Unaffected by the drop; *improved* by a richer profile.

The brief's worry ("wedding packages make the AI hunt only weddings") isn't literally true in current code — but the half-credit event-type path and the narrow chip list *do* reward narrow tags and frame the artist's mindset narrowly. Replacing them with genres + breadth tags + dials removes the narrowing without losing a single search.

---

## 6. Data-model + code changes

| Action | Item | Where | Note |
|---|---|---|---|
| **KEEP** | All `Business` profile fields (genres, eventTypes, bio, headline, videoLinks, photoUrls, reviewQuotes, notableVenues, feeFloor, feeSweetSpot, travelPolicy, currency) | `schema.prisma:71-140` | Already the right primitives — **no migration for the profile pivot itself.** |
| **KEEP** | `updateArtistProfile` + `ProfileForm` | `app/actions/profile.ts:67`, `components/profile-form.tsx` | Reuse as the basis of new step 2; already currency-localized. |
| **KEEP** | Hunt matching on `Business.genres/eventTypes/serviceCities` | `lib/venues/score.ts`, `serper.ts` | Loses no signal. |
| **KEEP** | `Package` model + `/dashboard/packages` manager + `voice.ts` quoting | `schema.prisma:183`, `package-form.tsx`, `lib/agent/voice.ts:18` | Packages still feed **reactive inbound quotes** — move them out of onboarding, not out of the product. |
| **CHANGE** | Step 2 UI: package builder → profile form | `onboarding-wizard.tsx:332-520` (`StepPackages`), `STEPS:43` | Replace with craft/genre/links/media UI; reuse `updateArtistProfile`. |
| **CHANGE** | Resume heuristic off `packages.length` | `app/onboarding/page.tsx:25` | Key on profile completeness (genres+bio, or `profileStrength.percent`) instead. |
| **CHANGE** | Strength-meter license weighting | `lib/profile/strength.ts:83-88` | "Add a package" is `license:true` — **will block every new user if packages leave onboarding.** Demote to `license:false` or replace with the new dials. Update `tests/profile-strength.test.ts:112`. |
| **CHANGE** | Capture + derive currency at step 1 | `onboarding-wizard.tsx:270`, `app/actions/onboarding.ts:69-88`, `lib/tenant.ts:34` | On country select, write `Business.currency` via new `currencyForCountry()`. |
| **CHANGE** | Localize price formatters | `onboarding-wizard.tsx:91-96`, **`lib/agent/voice.ts:3-5`** | Use `business.currency`. The `voice.ts money()` USD hardcode is a **real latent bug** — reactive drafter quotes inbound clients in USD even for a THB business. |
| **DROP** | Mandatory package gate; `WizardPackage`/`usd`/`priceLabel`/`EVENT_TYPES` | `onboarding-wizard.tsx:64,84-102,507,513` | Remove with the step. |
| **BUILD (S)** | `currencyForCountry(code)` map | `lib/geo/countries.ts` | Pure fn, USD fallback; add to `tests/countries.test.ts`. |
| **BUILD (M)** | One-off/residency/travel dials | `schema.prisma` Business (e.g. `gigTypes` enum/array, `acceptsResidency`, `acceptsTravel`), wired into `score.ts:41` `MatchProfile` + `venue-pitch.ts:15` | Migration required. |
| **BUILD (M, fast-follow)** | Link-ingestion extractor | new `lib/profile/ingest.ts` reusing `contacts.ts:fetchPage` + `llm.ts:llmObject` + new `ArtistProfileSchema` | Own-site + Spotify/SoundCloud/YouTube oEmbed; pre-fill for approval; defer IG. |

**Pricing-page copy:** ensure marketing never re-introduces event-type framing; keep effort-axis tiers (per memory) and the "from ฿X" floor language, never a public hard fixed price.

---

## 7. Phased build plan

**Phase 1 — The UX win (ships first, S-M):**
1. Replace `StepPackages` with the profile-first step 2 (manual fields, reuse `updateArtistProfile` + `ProfileForm` sections). **S-M**
2. `currencyForCountry()` + write `Business.currency` at step 1; localize the two price formatters (kills the `voice.ts` USD bug). **S**
3. Add the one-off/residency/travel dials (migration + wire into `score.ts`/`venue-pitch.ts`). **M**
4. Re-weight `strength.ts` so packages stop being license-critical; fix resume heuristic; move package builder to `/dashboard/packages`. **S-M**

This alone delivers the founder's insight: wider matching, authentic profile, local currency, minimal-effort onboarding — **no external dependencies.**

**Phase 2 — The magic moment (fast-follow, M):**
5. Link-ingestion extractor (own-site + Spotify/SoundCloud/YouTube oEmbed) → pre-fill bio/genres/media for approval. **M**
6. Profile-strength meter framed as "more/better gigs," nudging enrichment (more photos, video, highlights). **S**

**Defer (L / later):** Instagram crawling (accept pasted text only); per-currency override for USD-priced/multi-currency edge markets.

---

## 8. Open questions for the founder

1. **Residency as a first-class dial, or just a breadth tag?** A structured `gigTypes` field (one-off/residency/both) is cleaner for matching and pricing but needs a migration; the `eventTypes` tag "residency" already gets some `KIND_AFFINITY` credit. First-class (recommended) vs. tag-only?
2. **Is the fee floor *truly* required to finish onboarding,** or can a new user advance with everything-else-but-floor and get nudged? (Floor is the anti-underpricing guardrail — recommend required, but it's the one hard gate left.)
3. **Link ingestion: pre-fill-only, always?** Confirm we never silent-write LLM-extracted bio/genres — the artist always approves. (Recommended, matches never-invent discipline.) Any appetite to auto-publish high-confidence fields?
4. **Public price display default:** "from ฿X" vs. hide-until-inquiry — which is the default, and can the artist toggle it?
5. **Keep `Business.eventTypes` as a free-form breadth list at all,** or fold breadth entirely into genres + dials? (It's half-credit secondary signal today; keeping it as free-form tags adds breadth, but one fewer field is simpler.)
6. **Currency override in v1 or deferred?** A few markets price domestically in USD (and hyperinflation markets prefer it). Derive-only for v1 with override deferred, or ship the override affordance now?
7. **Minimum media bar as an acceptance gate?** Platforms like Encore require ≥1 demo + ≥1 video to list. Do we gate hunting-license on a media minimum, or keep it a soft nudge via the strength meter? (Current `strength.ts` already weights video 14 / photos 12 as license-critical — confirm that's the intended bar post-redesign.)

---

**Relevant files (all under `/Users/norbert/Documents/Projects/Bright Ears/brightears-app/`):** `components/onboarding-wizard.tsx` (step 2 = `StepPackages`, lines 332-520; formatters 91-96), `app/onboarding/page.tsx:25` (resume heuristic), `app/actions/onboarding.ts:69-88`, `app/actions/profile.ts:67`, `components/profile-form.tsx`, `lib/profile/strength.ts:83-88`, `lib/venues/score.ts:41-180`, `lib/discovery/serper.ts:38-82`, `lib/agent/venue-pitch.ts:15-30`, `lib/agent/voice.ts:3-5` (latent USD bug), `lib/geo/countries.ts` (home for `currencyForCountry`), `prisma/schema.prisma:71-140` (Business), `:183-193` (Package).


---

# Appendix A — Profile & matching research

I have comprehensive material across all the requested platforms and themes. Here is the report.

---

# Artist Profile & Matching Research: How Booking Platforms Onboard and Profile Performers

Research date: 2026-06-17. All findings from 2024–2026 sources, cited inline. Where I reason from domain knowledge beyond a source, it's labeled.

## Ranked findings (with sources)

### 1. Media is the #1 driver of bookings — and there's a known "enough" ceiling
The strongest, most consistent signal across every platform: photos and especially **video** drive bookings more than anything else.
- The Bash: "Vendors with videos get 3X more bookings." Top bookers average **46 photos**; the platform allows up to 100. ([The Bash – Building Your Profile](https://itg.thebash.com/building-your-profile), [The Bash – 10 Ways to Get Booked](https://itg.thebash.com/10-ways-to-get-more-bookings))
- Chartlex (2026): artists with "current streaming stats and professional photos receive **3x more responses**." ([Chartlex – EPK 2026](https://www.chartlex.com/blog/career/how-to-build-a-music-press-kit-epk-2026))
- GigSalad explicitly caps the *useful* amount: "**5–10 really great photos and 2–3 quality videos**" plus "10–15 sound clips," a mix of "posed promo shots and live performances." More is not better past that. ([GigSalad – 6 Profile Tips](https://www.gigsalad.com/blog/6-profile-tips-to-get-more-leads/))

Takeaway for matching vs. impression: media is almost entirely about winning the **booker's yes**, not the algorithm. It's the highest-leverage thing an artist uploads.

### 2. The profile photo is the single highest-impact field
Every platform treats the main photo as the make-or-break first impression, and gives concrete rules:
- "Your main photo is the first thing planners see... choose a shot that shows you **in action**." (GigSalad)
- The Bash: dress the part, include the prop/instrument that signals your craft ("if you're a guitarist, use a picture of yourself with a guitar"), high resolution, shows in search results. ([The Bash – 5 Tips for Profile Picture](https://itg.thebash.com/5-tips-for-choosing-your-profile-picture))

### 3. Bio = short, scannable, differentiated — NOT a wall of text
Universal guidance is "tight":
- GigSalad: "Keep it fairly short, but be detailed. Highlight your main services, **what you do that's different than your competition**, and what types of events you normally do." Short paragraphs, line breaks, no ALL CAPS / excessive exclamation marks. ([GigSalad – 6 Profile Tips](https://www.gigsalad.com/blog/6-profile-tips-to-get-more-leads/), [GigSalad – Real Examples](https://www.gigsalad.com/blog/how-to-create-a-great-profile-on-gigsalad-with-real-examples/))
- Bandzoogle EPK standard: keep **multiple bio versions** (elevator pitch / short / medium / long); lead with it. ([Bandzoogle – 8 Things in an EPK](https://bandzoogle.com/blog/the-8-things-that-should-be-in-every-band-s-digital-press-kit))
- Chartlex (2026): "The bio is the **most common EPK failure point**. Keep it tight." Max three paragraphs + a compressed ~50-word one-liner. ([Chartlex](https://www.chartlex.com/blog/career/how-to-build-a-music-press-kit-epk-2026))

### 4. The canonical EPK = 8 elements, and it's the de-facto "rich profile" schema
The industry-standard EPK (what artists already maintain) is remarkably stable. In order: **(1) Bio, (2) Promo photos, (3) Music, (4) Video, (5) Press & reviews, (6) Highlights/achievements, (7) Social & streaming links, (8) Contact.** ([Bandzoogle](https://bandzoogle.com/blog/the-8-things-that-should-be-in-every-band-s-digital-press-kit); corroborated by [DIY Musician/CD Baby](https://diymusician.cdbaby.com/music-marketing/epk-checklist/) and [Digital Music News](https://www.digitalmusicnews.com/2024/01/12/electronic-press-kit-epk/))

Notable nuances:
- **Music: lead with your strongest track** — "bookers may only listen to the first track or two." (Bandzoogle)
- **Highlights = a "musical resume"**: awards, radio, festival appearances, notable tour support, streaming success. This is the field that most cheaply signals credibility. (Bandzoogle)

### 5. "One link" web-EPK is now the norm; static PDFs are dead
- Chartlex (2026): a static PDF attachment is "considered outdated... gatekeepers are buried under thousands of emails." The win is a **web-based EPK** so "you can paste **one URL** instead of uploading files to every portal separately." ([Chartlex](https://www.chartlex.com/blog/career/how-to-build-a-music-press-kit-epk-2026))
- This is the same logic behind Linktree / Bandzoogle / one-link bios artists already keep. ([artist.tools EPK guide](https://www.artist.tools/post/your-guide-to-a-standout-musician-electronic-press-kit))

### 6. Honest, *current* metrics beat impressive-but-stale ones — and an empty field is worst of all
A strong 2026 finding worth weighing for what we ask:
- "A booker who sees '2,500 monthly listeners' knows where you are. A booker who sees **no numbers at all assumes you are hiding something**." "Outdated stats undermine trust faster than low numbers." ([Chartlex](https://www.chartlex.com/blog/career/how-to-build-a-music-press-kit-epk-2026))
- Implication for us: if we ingest streaming/social links, we get *current* numbers for free and avoid the artist self-reporting stale vanity figures.

### 7. The "I do many kinds of gigs" reality is handled by CATEGORIES + KEYWORDS, not event-type packages — but categories cut both ways
This directly addresses the founder's core insight:
- GigSalad lets a performer select **up to 20 categories** (Featured) / 15 (Pro) / 2 (free) — but warns: "**only add _relevant_ categories. Do not add services you don't actually provide.**" Categories *expand* reach, they aren't a per-event-type package. ([GigSalad – 6 Profile Tips](https://www.gigsalad.com/blog/6-profile-tips-to-get-more-leads/))
- The Bash: "Your **category selections** determine how clients find you and directly affect the type of leads you receive." Categories are the matching axis, not packages. ([The Bash – Building Your Profile](https://itg.thebash.com/building-your-profile))
- GigSalad's actual profile structure (real examples) has **no event-type package builder** — it uses Overview, a broad "Services & Pricing" fee range, media, bio, calendar, reviews. For different offerings they use "saved quotes," not rigid pre-built event packages. ([GigSalad – Real Examples](https://www.gigsalad.com/blog/how-to-create-a-great-profile-on-gigsalad-with-real-examples/))
- Encore's matching axes are **instrument, genre, location, availability** + a fee — *attributes about the artist*, not event types. The booker describes the event; the artist describes themselves. ([TechCrunch – Encore](https://techcrunch.com/2016/10/31/encore/), [Encore – Musician's Guide](https://help.encoremusicians.com/hc/en-us/articles/360000256773-A-Musician-s-Guide-to-Encore-Bookings))

**This validates the founder's thesis precisely:** the best platforms profile *who the artist is* (craft, genre, style, media, reach) and let breadth come from a few non-narrowing tags — not from a package keyed to one event type. Where they do use event-type tags, those tags *widen* eligibility; they never replace the artist-identity profile.

### 8. Matching axes that recur (the structured signals worth keeping)
Encore is the closest analog to our matching model (it pushes alerts to artists, like our Hunt). Its required structured signals:
- **Instrument / musicianship** (craft), **genre**, **location**, **availability**, and **accurate pricing** — set as "job alert settings... so Encore knows what kind of jobs to send." A **25-song setlist** is required as proof-of-repertoire. Profile must hit "100% strength" via media, reviews, accurate pricing. ([Encore – Musician's Guide](https://help.encoremusicians.com/hc/en-us/articles/360000256773-A-Musician-s-Guide-to-Encore-Bookings), [Mixcloud – How to Get Gigs with Encore](https://www.mixcloud.com/blog/2024/12/18/how-to-get-live-gigs-and-dj-sets-with-encore/))
- Enterprise talent marketplaces (Gloat, Eightfold) confirm the modern pattern: a small set of structured fields (skills, location, availability, preferences) **plus inferred signals from links/portfolio**, with the profile getting "increasingly refined" as the system learns. ([Gloat](https://gloat.com/use-cases-agents/talent-marketplace-agent/), [iMocha 2026](https://blog.imocha.io/talent-matching-platforms))

This supports "profile-rich + 2–3 dials," not "a package per event type" and not "zero structure."

### 9. Onboarding is staged and low-friction; "ready in minutes," finish later
- GigSalad: musicians can be "ready to book gigs in **minutes**" with "just a few details," then complete in stages. ([lowcode.agency – Build a Musician Booking Marketplace](https://www.lowcode.agency/blog/how-to-build-a-musician-booking-marketplace), [The Crafty Musician](https://www.thecraftymusician.com/15-online-platforms-musicians-can-use-to-book-paid-gigs/))
- Profile **completion meters** ("100% strength") are the standard nudge to come back and enrich. (Encore; common pattern)
- Minimum media bars exist (e.g., "at least one audio demo and one live video") as a listing-acceptance gate. ([lowcode.agency](https://www.lowcode.agency/blog/how-to-build-a-musician-booking-marketplace))

### 10. Auto-ingesting links to build a profile is an emerging-but-not-universal pattern
- Bandsintown/Spotify integration: artist pastes their **Spotify artist URL**, and data syncs across Spotify/Google/Apple/Shazam within 24h — a real "paste one link, populate everywhere" pattern. ([PRNewswire – Spotify x Bandsintown](https://www.prnewswire.com/apac/news-releases/spotify-partners-with-bandsintown-to-boost-live-music-discovery-302060040.html), [Bandsintown – Spotify integration](https://www.artist.bandsintown.com/integrations/spotify))
- Spotify/Apple profiles auto-create on release; distributors offer "instant access to edit your Spotify profile, images and bio + daily stats." ([Record Union](https://www.recordunion.com/), [RouteNote](https://routenote.com/blog/how-to-customize-your-artist-profile-on-all-music-services/))
- **Honest gap:** I found no consumer booking platform that fully auto-*builds* an EPK by scraping SoundCloud/IG/YouTube. The norm is "paste your links, we display/sync them" — not "we read them and write your bio." So **link-ingestion to auto-draft a profile is a credible differentiator for us, not a solved commodity.** (This is partly reasoning from the absence of sources; flagged as such.)

---

## 6–8 takeaways for OUR artist-profile onboarding

These translate the research into a concrete spec for replacing the "What you sell / package builder" step. Order is deliberate — front-load the cheap, high-signal, identity stuff; defer or auto-derive the rest.

**1. Make step 2 about WHO, not WHAT-you-sell — anchored on craft + genre/style.** Ask craft (DJ, band, singer, magician, MC…), then genres/styles, then a one-line "vibe" descriptor. These are Encore's core matching axes (instrument, genre) and they *widen* the Hunt instead of narrowing it. Drop event-type package tags entirely; if you ever want event signals, they should be optional widen-tags, never the primary primitive.

**2. Lead with "paste your links," and use them to auto-draft the profile.** Offer fields for website, Spotify, SoundCloud, Instagram, YouTube, Mixcloud, Bandcamp, Linktree. This is what artists already maintain (the one-link/EPK norm), it's the lowest-friction way to get rich data, and ingesting it to draft bio + pull *current* stats + grab media is a pattern competitors don't fully do yet. Current metrics also beat stale self-reported vanity numbers (Chartlex). Make this the visual centerpiece of the step.

**3. Capture the canonical EPK 8, but mostly by reference, not by typing.** Bio (auto-drafted from links, artist edits — keep it ≤3 short paragraphs + a 50-word version), promo photos, audio, video, press/reviews quotes, **highlights/notable gigs** ("musical resume"), social/streaming links, contact. Highlights and notable gigs are the cheapest credibility signal — ask for 2–3, optional.

**4. Media is the conversion engine — ask for a strong profile photo + a little video, and cap it.** Require/strongly prompt one great action photo (instrument/prop visible, high-res) and 1–2 videos; suggest 5–10 photos and 2–3 videos as the *target*, not 100. This is the #1 booking driver across every platform; don't let artists drown the step in uploads.

**5. Keep exactly 2–3 structured "dials," in local currency:** (a) a **fee FLOOR / range** so the AI never under-pitches — in the artist's local currency derived from step-1 country (TH→THB, GB→GBP); (b) **what they want** — one-offs / residencies / both; (c) **travel willingness** (radius or yes/no). These map to Encore's "job alert settings" and are non-narrowing. Resist adding a fourth.

**6. Model the two real primitives (one-off gig, residency), each with its own rate — not a package per event type.** This matches how artists actually price (different rate for a single night vs. a recurring residency) and how matching platforms treat fee as an artist attribute, not an event-type SKU. Make the residency primitive optional.

**7. Stage it and show a completion/strength meter.** Get them "ready in minutes" with craft + genre + one link + photo, then nudge enrichment via a "profile strength" indicator (Encore's "100% strength" pattern). Richer profile = wider + better Hunt matching, so frame the meter as "more/better gigs," not chores.

**8. Sequence the step: craft → genre/style → vibe one-liner → paste links (auto-draft) → photo/video → the 2–3 dials (fee floor, one-off/residency/both, travel) → review auto-drafted bio.** This front-loads matching signal and authenticity, derives the heavy content from links, and ends on a low-effort confirm — keeping the artist's "get a job with minimal effort" goal intact.

---

### Primary sources
- GigSalad: [6 Profile Tips](https://www.gigsalad.com/blog/6-profile-tips-to-get-more-leads/), [Real Examples](https://www.gigsalad.com/blog/how-to-create-a-great-profile-on-gigsalad-with-real-examples/), [Musician Tips](https://www.gigsalad.com/blog/create-a-great-profile-expert-tips-for-musicians/)
- The Bash: [Building Your Profile](https://itg.thebash.com/building-your-profile), [10 Ways to Get Booked](https://itg.thebash.com/10-ways-to-get-more-bookings), [Profile Picture Tips](https://itg.thebash.com/5-tips-for-choosing-your-profile-picture)
- Encore Musicians: [A Musician's Guide to Bookings](https://help.encoremusicians.com/hc/en-us/articles/360000256773-A-Musician-s-Guide-to-Encore-Bookings), [TechCrunch profile](https://techcrunch.com/2016/10/31/encore/), [Mixcloud – Get Gigs with Encore](https://www.mixcloud.com/blog/2024/12/18/how-to-get-live-gigs-and-dj-sets-with-encore/)
- Bandsintown/Spotify: [PRNewswire](https://www.prnewswire.com/apac/news-releases/spotify-partners-with-bandsintown-to-boost-live-music-discovery-302060040.html), [Integration page](https://www.artist.bandsintown.com/integrations/spotify)
- EPK norms: [Bandzoogle – 8 Things](https://bandzoogle.com/blog/the-8-things-that-should-be-in-every-band-s-digital-press-kit), [Chartlex – EPK 2026](https://www.chartlex.com/blog/career/how-to-build-a-music-press-kit-epk-2026), [DIY Musician/CD Baby](https://diymusician.cdbaby.com/music-marketing/epk-checklist/)
- Poptop: [Building/Creating a listing](https://supportcenter.poptop.uk.com/article/345-creating-a-listing), [Getting Booked](https://www.poptop.uk.com/blog-suppliers/getting-booked-on-poptop/)
- Matching patterns: [Gloat Talent Marketplace Agent](https://gloat.com/use-cases-agents/talent-marketplace-agent/), [iMocha – Talent Matching 2026](https://blog.imocha.io/talent-matching-platforms), [lowcode.agency – Build a Musician Booking Marketplace](https://www.lowcode.agency/blog/how-to-build-a-musician-booking-marketplace)

Note: I could not find any consumer booking platform that fully auto-*builds* an EPK by reading an artist's SoundCloud/IG/YouTube content (vs. just displaying pasted links). Takeaway #2's "ingest links to auto-draft" is therefore positioned as a likely differentiator, reasoned partly from the absence of evidence — flagged as such.


---

# Appendix B — Pricing & currency research

I now have enough converging evidence across both research questions. Compiling the findings.

---

# Pricing-Model + Currency Research — Bright Ears Onboarding

Research date: 2026-06-17. Web sources cited inline. Where the web was thin on a specific claim, I label it as domain inference.

## Part A — How performers price, and the lightest capture that lets an AI quote without underpricing

### Finding 1: Performers do NOT have one price — fees flex by gig type, duration, day, venue budget, and travel
This is the single most consistent finding and it directly validates the founder's thesis. Working musicians describe their rate as a moving target, not a fixed number:

- A solo acoustic performer: *"Depending on where it is, how long for, who it's for, what it's for it can be anything from £50 to £300"* — and a standard covers gig is *"£80–£120,"* but corporate/weddings command more because of *"higher budget and more precise requirements."* ([lastminutemusicians.com](https://www.lastminutemusicians.com/blog/i-charge-real-world-advice-performing-musician/))
- A pianist's rate evolved with experience (£50 → £100–250 → £300–400) and he'd *deliberately drop* to £150–200 if he wanted to maximize booking frequency rather than premium per-gig. ([lastminutemusicians.com](https://www.lastminutemusicians.com/blog/i-charge-real-world-advice-performing-musician/))
- Marketplaces confirm performers set their own rates "based on experience, type of service, duration of the gig, and location" — the platform does not impose a price model. ([sidehusl.com/gigsalad](https://sidehusl.com/gigsalad/))

Implication for us: a single stored price is wrong, and a price-per-event-type is even worse (it bakes in the event-type narrowing the founder wants to kill). The fee is a function the AI computes at quote time from a few inputs — not a value the artist types once.

### Finding 2: One-off vs residency genuinely price differently — residencies trade per-night rate for recurrence
The two-primitive model (one-off + residency) the founder proposed maps to a real pricing distinction:

- Club/bar/residency nights run ~$100–500/night, while one-off private parties run ~$300–800 — residencies command a **lower per-occurrence rate in exchange for recurring volume**. ([thumbtack.com](https://www.thumbtack.com/p/local-dj-prices), [serato.com forum](https://serato.com/forum/discussion/726777))
- This is the recurring-discount logic seen across booking ("10% off for 5+ consecutive days"; weekday/off-season discounts vs Saturday/peak premiums). ([thumbtack](https://www.thumbtack.com/p/local-dj-prices))

Implication: capturing **two floors** (one-off floor, residency per-night floor) is meaningfully better than one, because the AI should never pitch a residency at the one-off floor or vice versa. This is one cheap, non-narrowing dial.

### Finding 3: Artists actively dislike publishing a fixed public price — they prefer "quote on inquiry," but will give a floor/range
- *"In any negotiation, the one who first gives a number is the loser"* — the explicit pro guidance is to gather event details (type, day, season, travel, client budget) **before** quoting. ([backonstageapp.com](https://backonstageapp.com/blogs/band-management-blog/artist-booking-prices-set-the-right-rate-for-your-band))
- Musicians "avoid publishing fixed rates publicly" and prefer to negotiate per inquiry, often by email for documentation. ([lastminutemusicians.com](https://www.lastminutemusicians.com/blog/i-charge-real-world-advice-performing-musician/))
- But the industry DOES anchor on a **"starting price"**: *"the lowest price musicians can expect for a professional performance of at least one 45-minute set; prices below this indicate amateur or student musicians."* ([encoremusicians.com](https://encoremusicians.com/blog/how-much-does-it-cost-to-hire-musicians/))

Implication: the tolerated, meaningful input is a **floor ("from $X" / "won't get out of bed for less than")**, not a ceiling and not a per-event grid. A floor is something every working artist already knows in their head, can answer in two seconds, and protects them from the thing they fear most (the AI under-pitching). A from/to *range* is acceptable as an optional second number, but the floor is the load-bearing one.

### Finding 4: The lightest defensible quote needs only a handful of signals
The "defensible minimum before negotiation" requires: base rate + duration + travel distance + date/demand. ([backonstageapp.com](https://backonstageapp.com/blogs/band-management-blog/artist-booking-prices-set-the-right-rate-for-your-band)) Crucially, most of those (duration, travel, date) come from the **inquiry/opportunity**, not the artist's profile. The only thing the artist must pre-commit is the **floor(s)** and a rough **typical/target** number. Everything else the AI derives at quote time.

### Recommendation A — our one-off / residency pricing capture

Capture **2–3 numbers, no event-type grid, all optional-but-encouraged**, framed as "so the AI never under-pitches you":

1. **Work type toggle** (multi-select, non-narrowing): One-off gigs / Residencies / Both / + "Open to travel" checkbox. This is a routing signal, not a filter on event types.
2. **One-off floor** — "Lowest you'll take a one-off gig for" → `from {local currency} X`. Single number. This is the anti-underpricing guardrail and the only truly required field.
3. **Residency rate** (only shown if Residency/Both selected) — "Your going per-night rate for a regular slot." Single number, can be a range.

Optional, progressive (don't gate onboarding on these):
- **Typical / target one-off fee** (a second number → gives the AI a from/to band so quotes land at "from $floor, typically ~$target," never just the floor).
- Let the artist leave a free-text note ("I flex up a lot for corporate / weekday discounts fine") that the AI reads as soft pricing context — this matches how they actually think and costs them nothing.

Quote behavior: AI computes each quote from `floor` + inquiry facts (duration, travel, date demand, event budget signals). Public profile shows **"from {symbol}{floor}"** or nothing (hide-until-inquiry), per artist preference — never a hard fixed price, because that's exactly what artists reject. The floor is enforced as a hard guardrail: the AI is forbidden from drafting any outreach/quote below it.

Net: this is "profile-rich + 2–3 dials" — the floors are the cheap structured signals that prevent under-pricing without re-introducing the package/event-type narrowing.

---

## Part B — Currency localization

### Finding 5: Localize the displayed/entered currency to the user's country — forcing USD costs conversions
- Showing prices in local currency removes mental-conversion friction; cosmetic currency localization (display in the visitor's regional currency) is table stakes, and failing to localize is associated with materially lower international conversion (Paddle: ~30% lower; "up to 50%" friction cited). ([fastspring.com](https://fastspring.com/blog/how-localization-for-saas-pricing-can-boost-your-revenue/), [getmonetizely.com](https://www.getmonetizely.com/articles/localization-vs-currency-conversion-in-global-saas-pricing-strategies-for-international-success))
- For our case this is even clearer than the cited articles: the prices the artist enters are **fees they charge their own clients**, denominated in *their* market's money. A Thai DJ thinks in THB; a UK band thinks in GBP. Forcing those numbers into USD would be actively wrong, not just suboptimal. So: derive currency from the **country picked in step 1** (TH→THB, GB→GBP, US→USD) and use it for all fee fields. This is correct and confirmed best practice.

### Finding 6: Keep "the currency the artist prices in" strictly separate from "the currency we bill the subscription in"
- Best practice explicitly separates **display currency** (what the user sees/enters) from **billing currency** (what the platform charges). ([getmonetizely.com](https://www.getmonetizely.com/articles/localization-vs-currency-conversion-in-global-saas-pricing-strategies-for-international-success), [dodopayments.com](https://dodopayments.com/blogs/multi-currency-pricing-global-saas))
- Our subscription is USD (per memory). That stays USD. The artist's fee fields are a *content/display* concern in their local currency. These two should never be coerced into one currency. Store each money value as an explicit **{amount, ISO-4217 code}** pair so the two domains can't leak into each other. (Storage-vs-display separation: [ink.carta.com](https://ink.carta.com/internationalization/currency-i18n/))

### Finding 7: Display rules — symbol when unambiguous, ISO code to disambiguate; locale-aware formatting; per-currency decimals
Concrete, implementable rules from a production design system:
- **Symbol vs code:** show the localized symbol when there's a single, unambiguous currency on screen ($ for USD, R$ for BRL, € for EUR); switch to the **three-letter ISO-4217 code** when currencies mix or the currency is ambiguous (e.g. "CAD 12,345.00"). Default preference is ISO codes for clarity. ([ink.carta.com](https://ink.carta.com/internationalization/currency-i18n/))
- **Symbol collision is real:** `$` is used by USD, CAD, AUD, etc.; "dollar / franc / peso / pound" name many different-valued currencies. This is why you show the ISO code wherever the bare symbol could be misread. ([ink.carta.com](https://ink.carta.com/internationalization/currency-i18n/), [en.wikipedia.org/wiki/ISO_4217](https://en.wikipedia.org/wiki/ISO_4217))
- **Formatting:** use locale-aware formatting (`Intl.NumberFormat` with the currency code) so symbol, decimal, and thousands separators follow the user's locale. Don't hand-roll separators. ([ink.carta.com](https://ink.carta.com/internationalization/currency-i18n/))
- **Decimal precision per currency:** 0 decimals for JPY, 2 for USD/GBP — and notably **THB is 2 decimals but Thai pricing is conventionally whole-baht**, so round fee fields to whole units regardless. ([ink.carta.com](https://ink.carta.com/internationalization/currency-i18n/))
- **Round localized values:** show ฿2,000 not ฿1,987.34 — clean numbers read as professional and reduce friction. ([2checkout.com](https://blog.2checkout.com/localized-pricing-for-software-best-practices/))

### Finding 8: Country→currency mapping gotchas to handle
- **Multi-currency / supranational currencies:** some countries don't map 1:1. The Euro (many countries), CFA franc (XOF West Africa / XAF Central Africa), East Caribbean dollar (XCD, 8 territories) all break a naive country→currency lookup. ([en.wikipedia.org/wiki/ISO_4217](https://en.wikipedia.org/wiki/ISO_4217)) For these, the country still resolves to a single ISO code (e.g. any Eurozone country → EUR), so a country→code table works as long as it's a real table, not "first two letters of the country."
- **Symbol collisions** (Finding 7) → always carry the ISO code in data even if you render the symbol.
- **Currency codes change** (SSP added 2011; Venezuela VEB→VEF→VES) — store the ISO code as data and keep the mapping table maintainable rather than hardcoding symbols. ([en.wikipedia.org/wiki/ISO_4217](https://en.wikipedia.org/wiki/ISO_4217))
- **A few countries price domestically in USD** anyway (and hyperinflation markets like Argentina sometimes prefer USD). Edge case for later: let the user override the derived currency. ([getmonetizely.com](https://www.getmonetizely.com/articles/localization-vs-currency-conversion-in-global-saas-pricing-strategies-for-international-success))

### Recommendation B — currency localization for our onboarding

1. **Derive fee currency from the step-1 country** via an explicit `country → ISO-4217` table (not heuristics). TH→THB (฿), GB→GBP (£), US→USD ($). Eurozone countries all → EUR.
2. **Store every fee as `{ amount: number, currency: "THB" }`** — an explicit ISO code per value. Never store a bare number whose currency is implied by context.
3. **Format with `Intl.NumberFormat(locale, { style: 'currency', currency })`**: symbol when unambiguous on the page, ISO code when ambiguous; locale separators; whole-unit rounding for fee fields (no decimals shown for THB/JPY-style whole-number pricing).
4. **Hard-wall the two currency domains:** artist fee currency (local, derived) vs Bright Ears subscription billing (USD, fixed). Different code paths, different stored fields; the subscription page never reads the fee currency and vice versa.
5. **Allow override** of the derived currency (small "change currency" affordance) for the USD-priced and multi-currency edge cases — derive as the default, don't lock it.
6. **Label the field** so the separation is obvious to the artist, e.g. "Your fees (in ฿ THB)" — showing both symbol and ISO code at the input kills the $-collision ambiguity at the exact moment they type a number.

---

## One-paragraph synthesis for the redesign
Replace the event-type package builder with a profile-centric step plus **2–3 non-narrowing pricing dials**: a work-type toggle (one-off / residency / both / travel), a **one-off floor** (the only required number — it's the anti-underpricing guardrail artists already carry in their heads and the only price input they tolerate), and a **residency per-night rate** when relevant; optionally a "typical" number to give the AI a from/to band and a free-text pricing note. The AI computes each quote at inquiry time from the floor + the opportunity's facts, never publishes a hard fixed price (artists reject that), and is hard-blocked from quoting below the floor. All fee fields are in the artist's **local currency derived from their step-1 country** via an explicit ISO-4217 table, stored as `{amount, currencyCode}`, formatted locale-aware with whole-unit rounding and the ISO code shown to defeat the `$`-collision — kept on a completely separate code path from our USD subscription billing.

Note: I did not open the codebase for this task since the brief was scoped to web research; the onboarding step-2 file lives under `/Users/norbert/Documents/Projects/Bright Ears/brightears-app` if you want me to map these recommendations onto the actual fields next.


---

# Appendix C — Codebase impact & feasibility

I have everything I need. Here is the impact map.

---

# Onboarding Step 2 Redesign — Codebase Impact & Feasibility Map

**Redesign:** "What you sell" (package builder, event-type-tagged) → **artist-profile-first** (one-off/residency pricing, no event-type gating, local currency, optional link-ingestion).

All paths below are under `/Users/norbert/Documents/Projects/Bright Ears/brightears-app/`.

---

## 1. The current Step 2 and the whole step flow

**`components/onboarding-wizard.tsx`** — the entire 5-step wizard is one client file.
- `STEPS` array — line 40-46. Step 2 label "What you sell" at line 43.
- `WizardPackage` type — line 84-89 (`name`, `priceMinDollars`, `priceMaxDollars`, `eventTypes`).
- `usd` formatter hardcoded **USD / en-US** — line 91-96; `priceLabel()` line 98-102.
- `EVENT_TYPES` const = `["wedding", "corporate", "birthday", "private party", "school dance"]` — **line 64** (the "school dance" the brief flags).
- `StepPackages` component — **line 332-520**: package name + `priceMin`/`priceMax` in `$` (lines 432, 445), the event-type toggle chips (line 459-485), default `types=["wedding"]` (line 346), calls `createPackage` via FormData (line 357-388). Gate: "Next" disabled until `packages.length > 0` (line 507) — **one package is mandatory to advance**.
- Wizard shell wiring — `OnboardingWizard` line 951; `existingPackages` prop line 957; `<StepPackages>` rendered at `step === 1` (line 1085-1092); resume logic depends on packages existing.
- Other steps for context: `StepBusiness` (line 151, step 1, country picker line 270, no currency capture), `StepVoice` (line 526), `StepCalendar` (line 620), `StepConnect` (line 765).

**`app/onboarding/page.tsx`** — server loader.
- Queries `db.package.findMany` (line 16-20) and passes `existingPackages` (line 40-45).
- **Resume heuristic keys on `packages.length`** — line 25: `initialStep = packages.length === 0 ? 0 : hasVoice ? 3 : 2`. If packages stop being the step-2 artifact, this heuristic must change to key on profile completeness instead.

**`app/actions/onboarding.ts`** — step actions. `saveBusinessBasics` (line 69-88, step 1) writes name/owner/kind/country/timezone/website — **does not write `currency`**. `saveVoiceSamples` (line 109), `addBookedDates` (line 150). No package action here — step 2 reuses `createPackage`.

**`app/actions/packages.ts`** — `createPackage` (line 39-61), `updatePackage` (line 63), `deletePackage` (soft-delete, line 98). `dollarsToCents` (line 13), `parseEventTypes` (line 20). Prices stored in **cents**, no currency awareness.

**`prisma/schema.prisma`** — `model Package` line **183-193**: `name`, `description`, `priceMin Int` (cents), `priceMax Int?`, `eventTypes String[]`, `active Boolean`. No `kind`/type discriminator (one-off vs residency does not exist).

---

## 2. Artist-profile fields already on Business + the editor + the gate

**`prisma/schema.prisma` — `model Business` line 71-140.** The profile fields the brief wants to lead with **already exist** (added Phase 10.1, line 106-125):
- Matching: `genres String[]` (110), `eventTypes String[]` (111), `serviceCities String[]` (112), `travelPolicy` (113), `feeFloor Int?` cents (114), `feeSweetSpot Int?` (115), `pitchLanguages String[]` (116), `insured` (117).
- Ammunition: `headline` (119), `bio` (120), `videoLinks String[]` (121), `photoUrls String[]` (122), `reviewQuotes String[]` (123), `notableVenues String[]` (124), `epkEnabled` (125).
- **`currency String @default("USD")`** — **line 82** (already exists; see §4 — it is never written).
- `bookingLinkUrl` (84), `voiceSamples` (86), `websiteUrl` (83).

**`components/profile-form.tsx`** — the existing Phase-10.1 profile editor (lives in Control Room `/dashboard/settings#profile`). This is essentially the form the brief wants onboarding step 2 to *become*. Sections: "The basics" (headline/bio, line 45-78), "Your act" (genres/eventTypes/pitchLanguages, line 80-124), "Proof" (videoLinks/photoUrls/reviewQuotes/notableVenues/insured, line 126-200), "Rate & reach" (travelPolicy/feeFloor/feeSweetSpot, line 202-269). **Currency label already localized** via `profile.currency` (lines 228, 238, 242). Notably **does NOT carry `serviceCities`** (owned by the `#hunt` section — comment line 110-111 in `app/actions/profile.ts`).

**`app/actions/profile.ts`** — `updateArtistProfile` (line 67-116). Already handles the rich-profile write with the same tenant-scoped, touch-only-my-fields discipline. `toCents` (line 38), `splitList`/`splitUrls`/`splitLines` (line 20-35). Deliberately omits `serviceCities` (line 96-99). This is the action onboarding step 2 should reuse/share.

**`lib/profile/strength.ts`** — the hunting-license gate. `CHECKS` array line 51-149; `profileStrength()` line 151. **This is where event-types and packages are currently weighted:**
- "Add at least one package" — weight 8, **`license: true`** (line 83-88). **If step 2 stops forcing a package, this license-critical check blocks every new user from pitching.** Must be re-weighted or dropped.
- "List the event types you play" — weight 4, `license: false` (line 114-118). Non-blocking; safe to keep or fold into genres.
- License-critical checks that the new flow should drive instead: video (14), photos≥3 (12), bio (10), headline (8), genres (8), serviceCities (8), feeFloor (8). `MIN_PITCH_PHOTOS = 3` (line 45).

---

## 3. How the Hunt matches today — what dropping event-type packages costs

The Hunt **does not read `Package` at all.** It reads `Business.genres` / `Business.eventTypes` / `Business.serviceCities` only. Confirmed across:

**`lib/venues/score.ts`** — fit scoring. `MatchProfile` = `{genres, eventTypes, serviceCities}` (line 41-45). Weights (line 113-118): geo 30, kind 25, heat 25, volume 10, pitchable 10.
- **Geo (line 156-164):** `serviceCities` is the gate — exact city-name match. Drives 30 points + the only hard "outside your service cities" caution.
- **Kind match (line 166-180):** `genres` overlap with `KIND_AFFINITY` (line 62-101) = full 25; **`eventTypes` overlap = half credit (12.5)** (line 173-175). So event-types already contribute *secondary* signal — genres dominate. The `KIND_AFFINITY` matrix is broad ("bar/club night/residency/live music"); matching is case-insensitive substring both ways (`tagsOverlap`, line 124-128).

**`lib/venues/timing.ts`** — pure timing score; reads **no profile fields** (temperature + signal freshness only). Unaffected by this redesign.

**`lib/discovery/scan.ts`** — orchestration. Reads `serviceCities` + `country` only (select line 60-83); builds home metros from `serviceCities` (line 160-165). **Does not use `genres`/`eventTypes`/packages.** Refuses to scan with no service cities (line 111). Unaffected except indirectly via §2's strength gate.

**`lib/discovery/serper.ts`** — query batteries (`buildQueryBattery` line 38, `buildWarmQueryBattery` line 67). **Queries are built from `city`/`year` ONLY — they are NOT personalized by genre or event-type at all.** The artist's craft never enters the search terms; it only enters scoring after results return. So **dropping event-type packages changes zero search queries.**

**`lib/agent/venue-pitch.ts`** — pitch generation. `PitchBusinessProfile` (line 15-30) reads `genres`, `eventTypes`, `feeFloor`, `feeSweetSpot`, `reviewQuotes`, `notableVenues`, `headline`, `bio` — **all from Business, none from Package.** `eventTypes` feeds the "Plays:" line (line 157). `feeFloor` is the floor guard (rule: never quote below; line 191 forbids prices in first email anyway). **Packages are never read in a pitch.**

**Net for matching:** Event-typed *packages* feed the Hunt **nothing today** — the Hunt reads `Business.eventTypes` (the profile array), not `Package.eventTypes`. Dropping the package-builder from onboarding loses **no hunting signal**. The brief's worry ("wedding packages make the AI hunt only weddings") is *not* literally true in current code — but the half-credit event-type path in `score.ts` (line 173) and the `KIND_AFFINITY` event-type lists do reward narrow tags. **What to replace it with:** keep `Business.genres` as the primary match signal (already weight 25 full-credit), keep `Business.eventTypes` as a free-form *breadth* list (weddings/corporate/club nights/private — not a per-event package), and add the two cheap non-narrowing dials the brief wants — **fee floor** (already exists, `feeFloor`) and **one-off/residency/both/travel appetite** (new — see §5/table). Residency intent is *partially* representable today via the `eventTypes` tag "residency" which `KIND_AFFINITY` already rewards for BAR/ROOFTOP/HOTEL/CLUB, but there is no structured field.

**Where `Package` IS read (the reactive product, not the Hunt):** `lib/agent/voice.ts` line 18-21 — the inbound-reply drafter quotes from active packages (`PACKAGES & PRICING — the ONLY prices you may ever state`, line 28). So packages still matter for **reactive quoting**; they just shouldn't be the onboarding step-2 *primitive*. The package manager already exists at `app/dashboard/packages/page.tsx` + `components/package-form.tsx` — packages can move there entirely and onboarding step 2 becomes profile-first.

---

## 4. Currency — the gap and every touch point

**`Business.currency` exists (schema line 82, default "USD") but is NEVER written.** Confirmed: the only writes are in display formatters; `createBusinessForUser` (`lib/tenant.ts` line 34-46) sets no currency, and `saveBusinessBasics` (which captures country) does not derive it. So **every tenant is silently USD** regardless of country.

**`lib/geo/countries.ts`** — has `COUNTRIES` (line 290), `isAllowedCountry` (line 299), `EXCLUDED_COUNTRY_CODES` (line 18-25). **No country→currency map exists.** This is the natural home for one (e.g. `currencyForCountry(code): string` — TH→THB, GB→GBP, US→USD). ~249 ISO-2 codes; a partial map with USD fallback covers the realistic markets cheaply.

**Currency formatting/display touch points (must localize):**
- `components/onboarding-wizard.tsx` line 91-96 — hardcoded `currency: "USD"`, `en-US`. **The brief's main currency target.**
- `lib/agent/voice.ts` line 3-5 — `money()` hardcodes `$` and `en-US`; **the reactive drafter quotes in USD even for a THB business.** This is a real latent bug surfaced by the redesign.
- `components/lead-roi-calculator.tsx` line 28 — marketing calculator, hardcoded USD (arguably fine — separate from artist pricing).
- Already correctly localized via `business.currency`: `app/epk/[slug]/page.tsx` (line 107-109), `app/dashboard/packages/page.tsx` (line 17-19), `app/dashboard/settings/page.tsx` (line 408 → `profile-form.tsx` labels line 228/238/242).
- Subscription billing stays USD: `scripts/stripe-setup.ts` line 37 (`currency: "usd"`) — correct, leave alone (CLAUDE.md: USD subscription is separate from artist's local pricing).

---

## 5. Link-ingestion feasibility ("paste SoundCloud/IG/website → AI reads it → auto-builds profile")

**Reusable infra already in the repo:**
- **Page fetch:** `lib/discovery/contacts.ts` `makeLiveDeps().fetchPage` (line 193-208) — plain `fetch`, 5s timeout, text/html only, 200KB cap, no-retry, follows redirects. Directly reusable to fetch an artist's own website.
- **Email/text extraction from HTML:** `extractEmails` (line 27-39) — pattern for pulling structured bits out of raw HTML.
- **LLM extraction:** `lib/discovery/serper.ts` already does **exactly this shape** — fetch → batch → one `llmObject` call with a zod schema + `.catch()` sentinels for cheap-model robustness (line 113-142, 406-412), chunking to stay inside the flash output budget (line 397-433). The artist-profile extractor would be a near-clone: fetch the artist's site/EPK/social, hand the text to `llmObject({purpose: "parse", schema: ArtistProfileSchema})`.
- **LLM wrapper:** `lib/llm/index.ts` — `llmObject` (line 59-75), `modelFor("parse")` = `deepseek-v4-flash` (line 16), metered to `LlmUsage`. No new infra needed; cost is sub-cent per extraction.
- **Video URL normalization:** `lib/profile/video.ts` `videoEmbedUrl` (line 5-32) — YouTube/Vimeo → embed; reuse to validate pasted video links.

**Effort by source (research-cited):**

| Source | Effort | Approach | Risk |
|---|---|---|---|
| **Own website** | **S–M** | Reuse `fetchPage` + `llmObject` "parse" extractor → headline/bio/genres/photos. | Owner's own site = lowest ToS risk. JS-rendered (Squarespace/Wix/Webflow) often SSR enough for text; React SPAs return empty HTML — partial coverage. |
| **Spotify** | **S** | **No-auth [oEmbed](https://developer.spotify.com/documentation/embeds/reference/oembed)** returns artist name + image + embed; or authed [Web API "Get Artist"](https://developer.spotify.com/documentation/web-api/reference/get-an-artist) for genres/followers. | Sanctioned API. Must show Spotify logo + link back (attribution required per Spotify dev terms). |
| **SoundCloud** | **S–M** | [oEmbed](https://developers.soundcloud.com/docs/api/guide) (no auth) for embeds; `client_id` for public metadata, [now exposes artist-name field](https://developers.soundcloud.com/blog/api-artist-metadata/). | New SoundCloud API key registration has been intermittently closed — verify availability; [API ToS](https://developers.soundcloud.com/docs/api/terms-of-use) applies. |
| **Instagram** | **M–L** | No clean free API for arbitrary public profiles; logged-out scrape is **legally defensible** ([Meta v. Bright Data, N.D. Cal. Jan 2024](https://www.zyte.com/blog/california-court-meta-ruling/), per [hiQ v. LinkedIn](https://use-apify.com/docs/what-is-apify/is-apify-legal)) for public data, **but** Instagram aggressively rate-limits/blocks logged-out scraping and its ToS bars it for logged-in users. | Highest risk: anti-bot blocking, JS-rendered, rate limits. The codebase already treats `instagram.com` as an **aggregator to skip** (`contacts.ts` line 71) and only ever uses logged-out public IG data with a 1-query cap (ADR-004, `serper.ts` line 78-79). Recommend: ingest the IG *handle/bio text the owner pastes*, don't crawl IG. |
| **YouTube** | **S** | Pasted link → `videoEmbedUrl` (already built); optional oEmbed for title. | Low. |

**Recommended scope:** ship **S/M** first — "paste your website + Spotify/SoundCloud/YouTube links, AI drafts headline/bio/genres, you edit." Treat the LLM output as *pre-fill the owner approves*, never silent-write (matches the white-label + never-invent discipline). Defer Instagram crawling; accept pasted IG text only. Legal posture for the own-website + sanctioned-API path is clean; the ToS land-mine is only IG/aggregator crawling, which the repo already avoids.

---

## 6. Keep / Change / Drop / Build

| Action | Item | File:line | Notes |
|---|---|---|---|
| **KEEP** | All `Business` profile fields | `schema.prisma:106-125` | Already the right primitives — no migration needed for the profile pivot. |
| **KEEP** | `updateArtistProfile` + `ProfileForm` | `app/actions/profile.ts:67`, `components/profile-form.tsx` | Reuse as the basis of new step 2 (already currency-localized). |
| **KEEP** | Hunt matching on `Business.genres/eventTypes/serviceCities` | `lib/venues/score.ts:41-180`, `serper.ts:38-82` | Hunt never reads `Package` — profile pivot loses no hunting signal. Queries aren't genre-personalized today. |
| **KEEP** | `Package` model + manager for reactive quoting | `schema.prisma:183`, `app/dashboard/packages/page.tsx`, `package-form.tsx`, `lib/agent/voice.ts:18` | Packages still feed inbound reply quotes — move them out of onboarding, not out of the product. |
| **CHANGE** | Onboarding step 2: package builder → profile form | `onboarding-wizard.tsx:332-520` (`StepPackages`), `STEPS:43` | Replace with headline/bio/genres/links UI; reuse `updateArtistProfile`. |
| **CHANGE** | Resume heuristic off `packages.length` | `app/onboarding/page.tsx:25` | Key on profile completeness (e.g. `profileStrength.percent` or genres+bio present) instead. |
| **CHANGE** | Profile-strength license weighting | `lib/profile/strength.ts:83-88` | "Add a package" is `license:true` — will block new users if packages leave onboarding. Demote to `license:false` or replace with the new dials. Update `tests/profile-strength.test.ts:112`. |
| **CHANGE** | Capture + derive currency in step 1 | `onboarding-wizard.tsx:270`, `app/actions/onboarding.ts:69-88`, `lib/tenant.ts:34` | On country select, set `Business.currency` via new `currencyForCountry()`. |
| **CHANGE** | Localize price formatters | `onboarding-wizard.tsx:91-96`, `lib/agent/voice.ts:3-5` | Use `business.currency` (the voice.ts USD hardcode is a real latent bug for non-US tenants). |
| **CHANGE** | Drop "school dance" / rigid event-type chips | `onboarding-wizard.tsx:64` | If any event-type UI survives, use free-form breadth tags, not fixed list. |
| **DROP** | Mandatory "≥1 package to advance" gate | `onboarding-wizard.tsx:507,513` | No longer the step-2 artifact; package add becomes optional/later. |
| **DROP** | `WizardPackage`/`usd`/`priceLabel`/`EVENT_TYPES` | `onboarding-wizard.tsx:64,84-102` | Remove with the package step (or relocate to packages page). |
| **BUILD** | `currencyForCountry(code)` map | `lib/geo/countries.ts` | New pure fn, USD fallback; pairs with existing `isAllowedCountry`. Add to `tests/countries.test.ts`. |
| **BUILD** | One-off vs residency + travel dials | `schema.prisma` Business (e.g. `gigTypes`/`acceptsResidency`/`acceptsTravel` bool/enum), surfaced in step 2, read by `score.ts` to replace narrow event-type credit | The brief's "profile-rich + 2-3 dials." Migration required. Wire into `MatchProfile` (`score.ts:41`) and the pitch profile (`venue-pitch.ts:15`). |
| **BUILD** (optional, S/M) | Link-ingestion extractor | New `lib/profile/ingest.ts` reusing `contacts.ts:fetchPage` + `llm.ts:llmObject` ("parse" + new `ArtistProfileSchema`) | Own-site + Spotify/SoundCloud/YouTube oEmbed first; pre-fill for owner approval; defer IG crawl. |

**One latent bug worth flagging independent of this work:** `lib/agent/voice.ts` `money()` (line 3-5) hardcodes `$`/`en-US`, so the **reactive drafter quotes inbound clients in USD even when `Business.currency` is set otherwise** — a white-label correctness issue once any non-US tenant exists.

**Sources:** [Meta v. Bright Data ruling — Zyte](https://www.zyte.com/blog/california-court-meta-ruling/) · [Is web scraping legal in 2026 (hiQ/Bright Data/GDPR) — Apify](https://use-apify.com/docs/what-is-apify/is-apify-legal) · [Spotify oEmbed API](https://developer.spotify.com/documentation/embeds/reference/oembed) · [Spotify Web API Get Artist](https://developer.spotify.com/documentation/web-api/reference/get-an-artist) · [SoundCloud API guide](https://developers.soundcloud.com/docs/api/guide) · [SoundCloud API Terms of Use](https://developers.soundcloud.com/docs/api/terms-of-use) · [SoundCloud artist-metadata field](https://developers.soundcloud.com/blog/api-artist-metadata/)