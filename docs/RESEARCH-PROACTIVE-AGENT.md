<!-- Generated June 12, 2026 by a 15-agent research workflow (7 streams x live web search,
     adversarial fact-check per stream, synthesis). Caveat: the pricing stream's external
     numbers (Bark credits, Thumbtack fees, competitor prices) missed their fact-check pass
     (verifier hit an API error) — re-confirm before publishing any of them. -->

# Proactive Booking Agent — Research Report (June 2026)

## The verdict in one page

**Build it — in two phases, priced into the existing ladder, with the agent's first job being "work the channels you already pay for," not "scrape the whole internet."**

**The field is empty.** No funded or established product offers a proactive AI booking agent for wedding/private-event performers. Everything proactive that exists — Gig App, Music Mogul AI ($300/mo), Booking-Agent.io ($50–100/mo, and it's a contact database, not an agent), Indie on the Move QuickPitch ($6.99/mo) — targets touring musicians pitching venues ([Music Ally](https://musically.com/2026/02/17/music-mogul-ai-brings-automation-to-the-tour-booking-process/)). Wedding-vertical AI (HoneyBook, The Knot's vendor tools, Mikla.ai — the closest competitor to watch) is reactive-only.

**The finding that makes v1 cheap:** the six big request marketplaces — GigSalad, The Bash, Bark, Add to Event, Encore, Eventective — all push client gig requests to vendors as real-time email alerts ([GigSalad help](https://help.gigsalad.com/article/81-email-notifications)). Bright Ears already parses lead emails. So the discovery agent's core is alert-subscription + parse + rank + draft — mostly existing machinery — plus two sanctioned feeds: Bark's official Zapier integration (Zapier = a no-code connector platform; Bark's app exposes new-lead triggers and quote/purchase actions — [zapier.com/apps/bark/integrations](https://zapier.com/apps/bark/integrations)) and Thumbtack's free lead webhook (a URL their system pushes new leads to). Scraping is reserved for the long tail and rented per-result.

**Build order.** Phase 1 (~8 weeks, our estimate for a solo founder running AI agents): richer profile + hosted one-page EPK (electronic press kit) with a pitch quality gate; one opportunity feed with fit scores; five channels (Bark, The Bash, GigSalad, Craigslist saved-search alerts, Eventective); outreach sent from the artist's own Gmail/Microsoft mailbox; Telegram + WhatsApp approve-from-chat; pricing Structure A below. Phase 2: Thumbtack Partner API (apply now — it's approval-gated), open-web search discovery, Facebook groups via handoff cards, UK bundle, Always-On tier. Never: LinkedIn automation, Reddit's commercial API, server-side logins with artist credentials, auto-posting to social.

**What it costs.** Discovery infrastructure ~$4–6 per artist/month at daily cadence (light footprint) up to $25–32 hourly (estimates with assumptions in section 6); ~$130–170/month of fixed platform subscriptions amortizing below $2/artist past ~75 customers; chat control plane $0 (Telegram) to ~$1.70/user/month (WhatsApp UK).

**What it earns.** Agent included in Pro ($79, ~87% gross margin — gross margin = revenue minus direct serving costs), hourly cadence in Studio ($149, 73–76%), +$19 Starter add-on, +$99 Always-On, prepaid Hunt Boost packs. The 70% guardrail holds everywhere except true 24/7 all-channel polling (~$280/month cost) — which we simply don't sell. Roughly 60–65 Pro subscribers ≈ ฿150k/month in gross profit (our estimate at ฿36/$ and 87% margin).

**The bar, set by others' wreckage:** first visible win inside 14 days; no success fees; human approval as default; low-volume outreach from the artist's own identity; a weekly report line that reads "your agent found 4 of your last 7 bookings."

**Two unknowns gate everything:** fitting opportunities per metro per week, and reply rates to cold pitches (no published benchmark exists). Run a 2-week seeded-account test in 3–4 metros before locking the roadmap.

## Where the gigs are: channel rankings

Speed is why an agent wins here, per the platforms themselves: Thumbtack says 75% of hires go to pros responding within 3 hours (official, but a decade old); Bark says first responders are 48% more likely to be hired; GigSalad says first-hour repliers book 1.5x vs half-day (webinar-stated; their blog says "25% better chance") ([Hypebot](https://www.hypebot.com/hypebot/2025/10/how-to-book-more-paid-gigs-5-takeaways-from-gigsalads-webinar-with-fai.html)).

| Channel (geo) | How demand reaches us | Volume | Quality | Cost to respond | Automation stance | Build |
|---|---|---|---|---|---|---|
| **Bark** (US/UK/CA/AU) | Email/SMS/push alerts + official Zapier feed (read + quote/purchase) | High; only 4-country channel | Mixed; chronic "dead lead" complaints | $2.35/credit; typical lead 6–12 credits ≈ $14–28 (outer $7–50 our estimate); credits expire in 3 months | Sanctioned via Zapier; approval tap before any credit spend | Low |
| **The Bash** (US/CA) | Email alerts with details | ~23 leads/mo avg (self-reported) | Performer-native, good | ~$129–219/yr membership (single-source figure — confirm at signup) + 5% fee, $20 min, on wins only | Email-clean; quote submits on-platform → tap-to-send | Low |
| **GigSalad** (US/CA) | Alert email is a content-free ping + link; Gig Soup board (4–8 responses/day cap) | Featured claims "20–28x more leads" than free; absolutes unpublished | Performer-native, good | Pro $359/yr or Featured $479/yr, unlimited quotes, 2.5% fee on wins | Assisted: ping → one authenticated click; no API; no server-side login | Low-mid |
| **Thumbtack** (US) | Free official webhook (inbound); Partner API incl. a send-message endpoint (approval-gated); the proactive Opportunities board has NO feed | Largest US local-services pool | Strong intent | Direct leads $15–80 charged on contact; Opportunities: pay only if the customer replies | Officially tolerates API responders (LeadTruffle precedent) | Mid |
| **Craigslist gigs** (US/CA) | Craigslist's own saved-search email alerts | Real in large metros | Mixed; low budgets, scams | Free | Alerts sanctioned; never scrape-and-email | Low |
| **UK: Add to Event / Encore / Poptop** | Email alerts; Encore also has a public jobs feed | Solid UK flow | Good | AtE ~£5–14/quote (supplier reports); Encore free to apply, 20% commission; Poptop 12% | Email-clean | Low-mid |
| **Eventective** (US/CA) | Per-lead email or twice-weekly digest | Modest for performers | Mid | $2.50–5/lead or subscription | Email-clean | Low |
| **Facebook Groups** | Public groups: logged-out rented scraper ($2.60/1k posts); private groups: artist's own FB notification emails forwarded in | Likely biggest social pool (unmeasured) | High intent, hyper-local | Free | Human-handoff ONLY — Groups API removed April 2024; logged-in automation = ban risk | Mid |
| **Open web** (venue/planner pages, public threads) | Search APIs ($0.30–1/1k queries) + page monitoring | Unknown — instrument | Variable | Pennies | Read public, link out; replies assisted | Mid |
| **The Knot / WeddingWire** | No open request feed exists; couples message chosen storefronts | n/a proactive | — | Listings $125–1,200/mo | Stays in the reactive product | None |
| **Airtasker** (AU) | Public task pages | Thin for performers | Mid | 11.9–20% fee on wins | Phase 2 | Mid |

Skip: Nextdoor (gated, no usable API), Reddit's official API (commercial tier reported ~$12,000 per MONTH — find threads via search instead, [Techloy](https://www.techloy.com/reddit-api-pricing-in-2026-complete-guide-for-developers-and-businesses/)), LinkedIn (2025–26 ban wave).

Key sources: [GigSalad pricing/fees](https://help.gigsalad.com/article/148-membership-pricing), [Bash fees](https://itg.thebash.com/booking-gigs), [Bark credits](https://help.bark.com/hc/en-us/articles/13346288068892-What-is-a-credit-and-how-much-does-it-cost), [Thumbtack lead charges](https://help.thumbtack.com/article/pay-for-leads), [Craigslist alerts](https://www.craigslist.org/about/help/account/features/alerts), [Groups API removal](https://developers.facebook.com/blog/post/2024/01/23/introducing-facebook-graph-and-marketing-api-v19/), [TKWW](https://www.theknotww.com/press-releases/the-knot-worldwide-announces-new-platform-features-to-drive-wedding-vendor-success/).

**The five v1 picks:**
1. **Bark** — only 4-country channel, only sanctioned read-and-write feed. The agent polls matching requests, ranks, and quotes after your tap. Mediocre lead quality is exactly what the existing follow-up engine is for. Risk: a Zapier app isn't a contract — keep email alerts as fallback.
2. **The Bash** — its Auto-Add program (system broadcasts requests to extra vendors) drives "almost 50% of all bookings," "1 in 3 gigs goes to the first responder," and unanswered Auto-Adds auto-decline after 48 hours ([Auto-Add](https://itg.thebash.com/auto-add-gigs); self-reported marketing stats, no audit). A speed agent is purpose-built for this.
3. **GigSalad** — performer-native, flat membership, zero marginal cost per quote. Alerts are deliberately content-free, so the flow is ping → one click → draft ready, plus a daily assisted pass over Gig Soup.
4. **Craigslist via its own alerts** — free, zero scraping, lands in the existing parser. One stream proposed renting scrapers instead ($1.49/1k listings, [Apify](https://apify.com/fatihtahta/craigslist-scraper)); we resolve to alerts-first given Craigslist's litigation record, with the scraper as optional backstop.
5. **Thumbtack** — biggest US pool with an official partner path. Day 1: webhook (turbo-reactive) + assisted Opportunities (pay-per-response there). Apply for partner access immediately; it positions Bright Ears as a CRM, which it is.

UK bundle ships with UK launch; Eventective is a cheap sixth.

## Who tried this before, and the bar we must clear

**Sonicbids is the grave marker.** 400k+ bands and 30k promoters at its $15M sale to Backstage in 2013; ~$12.99/mo plus $5–15 per application for mostly unpaid opportunities; trust collapsed ("99% never saw a return"), the asset decayed a decade, and was resold in July 2024 to be rebuilt from scratch ([TechCrunch](https://techcrunch.com/2013/01/30/backstage-acquires-music-promotion-startup-sonicbids-for-15m-to-build-a-linkedin-for-creatives/), [Hypebot](https://www.hypebot.com/hypebot/2024/07/musician-epk-platform-sonicbids-sold-to-advance-music-technologies.html)). Lesson: never monetize hope — no per-application fees, no success fees.

**The AI-SDR wave is the second grave.** (SDR = outbound sales-prospecting rep, here replaced by software.) 11x, the flagship "AI employee," lost 70–80% of early customers and displayed customer logos it didn't have ([TechCrunch, Mar 24 2025](https://techcrunch.com/2025/03/24/a16z-and-benchmark-backed-11x-has-been-claiming-customers-it-doesnt-have/)); secondary analyses put category cancellations at ~50–70% within 90 days (directional, no primary dataset). B2B cold-email replies slid from 6.8% (2023) to ~5% (2025) as inbox providers pattern-flag AI-templated mass sends ([Belkins, 16.5M emails](https://belkins.io/blog/cold-email-response-rates)). Survivors sell human-gated leverage: Artisan defaults to Copilot (review every email); Clay ($3.1B valuation) sells metered enrichment, not autonomous sending. Gig App — the closest architectural cousin — sends low volume from the artist's own Gmail and claims 20% response (vendor-claimed; treat as ceiling, not baseline).

**Adjacent proof it works commercially:** home-service pros pay LeadTruffle $229–629/mo plus $299 onboarding for AI lead-response built on Thumbtack's official API ([pricing](https://www.leadtruffle.co/pricing)) — platforms tolerate API-based automation, and small operators pay 3–10x our prices for it. Performers' demonstrated willingness to pay for gig-finding clusters at $7–100/mo (IOTM $6.99 + $0.25/venue; Gigwell Artist Essentials $49 + $99 setup; Booking-Agent.io $49.99–99.99; gigmit PRO €79 monthly). $300/mo remains unproven.

**The bar:** (1) sell time saved and proven responsiveness, never guaranteed gigs; (2) human gate by default, low-volume sends from the artist's own identity; (3) month-to-month, visible caps, prepaid boosts, no expiring opaque credits — Bark's credit mechanic is this niche's trauma; (4) first visible win inside 14 days, because the category's kill curve is 90 days; (5) respect platform gates loudly, as a trust feature; (6) price the increment at $30–100/mo.

## Rules of engagement

Three channel classes, enforced in code (not just in the AI prompt):

| Class | Channels | Behavior |
|---|---|---|
| **Auto-eligible** (can earn autopilot) | Artist's own mailbox replying to alert-sourced posts (Craigslist relay, Bark-purchased contacts, direct poster emails); Bark Zapier quoting; Thumbtack Messages API if partner access lands | Draft → approve → send. After 10–20 consecutive unedited approvals on a channel (streams suggested 10 vs 20–50; tune in beta), offer reversible per-channel autopilot with budget caps wherever money moves — Bark credits are never auto-spent |
| **Approve-gated, never autopilot** | On-platform inboxes: GigSalad quotes, The Bash, Thumbtack pre-partner, Gig Soup | Agent pre-drafts; human taps send in the platform's own UI via deep link. No server-side session automation, ever — that's the account-ban and lawsuit pattern |
| **Human-handoff only** | Facebook groups, Instagram, Nextdoor, Reddit, LinkedIn | Agent finds the post lawfully (logged-out public scrape, or the artist's own notification emails), pings the artist with link + uniquely generated reply + Copy button: "This channel is gated for agents — you take over here." Never the same text twice; Meta fingerprints duplicates |

**Account-safety rules:**
- **Proactive email never touches Postmark.** Its terms require permission-based recipients with a 0.1% spam-complaint ceiling — one artist's cold sends could endanger the shared account running the reactive product ([Postmark ToS](https://postmarkapp.com/terms-of-service)). All outreach goes from the artist's own mailbox via OAuth (the "sign in with Google/Microsoft" permission flow).
- **Hard cap 10–20 outbound/day per artist** (our number, from 2025–26 practitioner caps), spread across 8–11am recipient-local. This stays far below the 5,000/day bulk-sender rules, but the 0.3% spam-complaint ceiling applies to ALL senders ([Google](https://support.google.com/a/answer/81126); Yahoo sets no volume threshold at all) — complaint hygiene matters at any volume.
- **Email authentication (SPF/DKIM/DMARC — DNS records proving the sender is genuine) verified green before the agent may send**; CAN-SPAM compliance on every message (truthful identity, address, honored opt-out) — RadPad paid $40M of its $60.5M judgment for exactly this ([NLR](https://natlawreview.com/article/craigslist-garners-60-million-judgment-against-radpad-scraping-dispute)).
- **Suppression and dedup:** master do-not-contact list; cross-channel dedup so one bride posting in two places gets one coherent touch; repliers auto-exit sequences.
- **No fake accounts, no automated logins, no credential custody.** The case law is consistent: logged-out scraping of public pages is defensible (Meta v. Bright Data, district court); anything involving accounts you automate loses (BrandTotal; hiQ died on contract claims).
- **A cease-and-desist letter kills that channel the same day** — the 3Taps rule: continuing after C&D plus IP block = liability under the CFAA, the US anti-hacking law.
- Log every send with prompt + model version; one global kill switch per artist.

## The remote control plane

**Ship Telegram + WhatsApp together; web push (already built) is the universal fallback; US-only SMS in phase 2; skip the rest.**

| Channel | Cost/user/mo at 150 msgs | Notes |
|---|---|---|
| Telegram | $0 | Free at our scale; buttons, in-place edits, Mini Apps, deep-link account linking ([Bot FAQ](https://core.telegram.org/bots/faq)). Weakness: ~8–9% US penetration |
| WhatsApp US/CA | ~$0.90 | Twilio $0.005/msg + utility templates $0.0034 out-of-window; everything inside the 24h service window is free from Meta ([Twilio](https://www.twilio.com/en-us/whatsapp/pricing)) |
| WhatsApp UK / AU | ~$1.63 / ~$1.20 | Utility $0.0220 UK / ~$0.0114 AU |
| SMS US (phase 2) | ~$2.50–3.50 | Needs A2P 10DLC (US carrier registration for business texting): $4.50 brand + $15 vetting + $1.50–10/mo, reviews running 10–15 business days |
| SMS UK/AU | $6–12 — don't | UK is now $0.056/segment ([Twilio GB](https://www.twilio.com/en-us/sms/pricing/gb)) |
| LINE | skip | Verified accounts and paid plans aren't offered in the US — a US-facing service sits on an unverified gray-badge free tier. Park until a Thai product exists |
| iMessage | watch | No bot path; Apple approved its first AI agent (Poke) on Messages for Business June 4, 2026 — revisit in 12 months |

Worst case ~$1.70/user/month = 6.8% of a $25 plan. Margin-irrelevant.

**Three WhatsApp rules:** (1) The US marketing-template pause (since April 1, 2025) is still active — the daily digest must be approved as a **utility template** (pre-approved transactional wording: "Your search for June 12 finished: 3 matches") or it silently fails with error 131049; Meta re-scans and reclassifies promotional-sounding templates, making this the #1 operational risk — monitor 131049, appeal within 60 days, fall back to push + Telegram. (2) WhatsApp banned general-purpose AI assistants (Jan 15, 2026) but explicitly permits scoped business AI ([terms](https://www.whatsapp.com/legal/business-solution-terms)) — keep the bot scoped to bookings/calendar/approvals and politely refuse everything else. (3) Most traffic rides free inside the 24-hour window the artist opens by messaging their agent — design for daily conversation.

**Approve-from-chat UX:** every message ends in ≤3 buttons (WhatsApp's hard limit, mirrored on Telegram): **Approve / Edit / Skip**. One daily digest at a user-chosen time; instant pings only when a buyer replied or a gig closes soon. Edit deep-links into the PWA with the draft open — don't rebuild the editor in chat. State updates in place ("Sent"), idempotent so stale buttons can't double-fire. Linking via one-time short-lived tokens confirmed in the logged-in web app; chat can never change email, password, or billing.

## How the machine works

Six steps, plain words:

1. **Listen — three intake pipes.** (a) **Email alerts** set up at onboarding — marketplace lead alerts, Craigslist saved searches, Facebook group notification emails — forwarded to the artist's existing Bright Ears address and parsed by the pipeline already in production. (b) **Sanctioned feeds** — Bark's Zapier triggers, Thumbtack's webhook. (c) **Our polling** — search APIs (paid services returning Google results as data: Serper $0.30–1.00/1k queries, optionally Exa $7/1k for meaning-based queries), page monitoring (Firecrawl, ~$0.83/1k pages), and rented per-result scrapers ("actors" — hosted scrapers someone else maintains: Craigslist $1.49/1k listings, community-maintained; public Facebook groups $2.60/1k posts, Apify-official). First-party search APIs are gone — Bing retired Aug 11, 2025; Google's is closed to new customers ([Microsoft](https://learn.microsoft.com/en-us/lifecycle/announcements/bing-search-api-retirement), [Google](https://developers.google.com/custom-search/v1/overview)).
2. **Normalize + dedup.** Every find becomes one opportunity record; the same gig seen twice becomes one card.
3. **Rank** against profile (genres, radius, fee floor, event types) and live calendar. LLM cost is trivial: DeepSeek via OpenRouter at ~$0.23/$0.34 per million tokens keeps ranking under $2/artist/month even hourly ([OpenRouter](https://openrouter.ai/deepseek/deepseek-v3.2)).
4. **Draft** in the artist's voice from the rate card, channel-aware: quote marketplaces get a real number; message channels get relevance + a range + next step (Bark's own guidance says detailed pricing up front backfires there).
5. **Gate** by channel class — auto-eligible, tap-to-send, or handoff card.
6. **Close.** A reply flips the card into the existing pipeline: FOUND → PITCHED → NEW → DRAFTED → … → BOOKED/DEAD. Same drafting, follow-ups, and weekly report — now with a "found by your agent" line.

**Monthly infra cost per artist** (our estimates; assumptions explicit):

| Cadence | Cost/artist/mo | Assumptions |
|---|---|---|
| Daily, alerts-led | **$4–6** | 1 metro, 5 channels, ~20 queries + 10 index pages per sweep, ~50 items/day fetched in detail |
| Daily, scrape-heavy | **$20–27** | 3 metros, 20 public FB groups, ~6k Craigslist listings + 4k FB posts/mo via actors |
| Hourly | **$25–32** | Polling ×30 on light footprint; content volume unchanged |
| 15-min, 2–3 fast boards | **$38–48** | Same first-responder value at a fraction of full continuous |
| True 24/7, all channels | **$262–290** | Don't sell this |

Two streams modeled daily cost differently ($4–6 vs $20–27); both are right for their footprint — cost is almost entirely polling × scraping volume, so we cap metros and groups per tier and lead with alerts. Underneath sits ~$130–170/mo of fixed platform subscriptions (Firecrawl, Apify, Serper), under $2/artist past ~75 customers.

**Do not build:** a browser/proxy farm; anything logging into marketplaces or Facebook server-side with artist credentials; auto-posting bots; Reddit's commercial API; Google Custom Search; LinkedIn anything (HeyReach's page deleted and founder banned March 2026; Apollo and Seamless banned 2025 — [MarTech](https://martech.org/a-pair-of-lead-gen-providers-have-disappeared-from-linkedin/)); iMessage bridges; a second pipeline UI.

## What it costs and what we charge

| Plan | Price | Agent capability | Est. total COGS (direct cost to serve, incl. reactive) | Gross margin |
|---|---|---|---|---|
| Starter | $25 | Reactive + weekly teaser scan; optional **Booking Agent add-on +$19**: daily, 3 channels, 15 pitches/mo | ~$8 with add-on | ~79% on add-on |
| Pro | $79 | **Agent included**: daily sweeps, 5 channels, 60 pitches/mo, 10 "Scan now" boosts | ~$9–10 | **~87%** |
| Studio | $149 | Hourly sweeps ("reply first"), 10 channels, 150 pitches/mo | ~$36–40 | **73–76%** |
| Always-On | +$99 (Studio only) | 15-min polling on the 2–3 fastest boards + priority queue | ~$40 incremental | 72% blended at $248 |
| Hunt Boosts | $5 / $15 prepaid | 24h / 7-day hourly boost | ~$1 / ~$6–7 | Fixed price, never auto-charged |

All figures from the cost model above (our estimates, light footprint). Price anchors: Vollna, the closest analog (board-scanning + auto-proposals for Upwork), charges $59/mo for 50 proposals ([pricing](https://www.vollna.com/pricing)); GigSalad/Bash flat memberships are the niche's best-liked model; adjacent contractors pay LeadTruffle $229–629/mo.

**Recommended: Structure A — cadence lives in the ladder.** Including the agent in Pro makes Pro the obvious upgrade from $25, and "hourly = you reply first" finally gives Studio a reason beyond multi-performer. **Fallback: Structure B** — a flat add-on on every tier (+$29 daily / +$79 hourly) if bundling depresses Pro conversion; cleaner attach-rate measurement, weaker upgrade pull. **Rejected: a universal agent-credit pool** — opaque burn and expiring credits are the most-complained-about mechanics in consumer AI agents, and this audience was already burned by Bark's credits.

**How the meters work:** cadence ("how often your agent goes hunting") is the headline plan feature and the true cost driver; channel count caps the scraping footprint per tier (this is what protects margin); pitch caps (15/60/150) are fair-use guardrails mirroring the existing lead allowances — "leads in, pitches out" — never a per-pitch price, because charging per pitch punishes the action that creates bookings. Never meter opportunities surfaced (it recreates pay-per-lead trauma and incentivizes junk), never charge success fees. Bursts are prepaid fixed-price Boosts, consistent with the existing pause-and-packs DNA.

Marketing honesty note: marketplace memberships and credits (GigSalad $359/yr, Bash membership, Bark credits) are the artist's own costs. The pitch is "your agent works the channels you already pay for, so you stop missing the 48-hour windows."

## The full circle: the artist's journey

**Day 0 (10 minutes).** Four questions — act type, city, radius, fee floor — then the agent runs a live scan of pre-indexed public sources and shows: "I found 9 gigs near Austin that fit a mobile DJ this month" (Bark's proven see-real-demand-before-paying onboarding pattern; the "9" depends on per-metro supply, which the seeded test must verify). Cards are browsable; pitch buttons are locked.

**The quality gate ("hunting license").** The agent finds with 4 fields but may not pitch until: 1 performance video + 3 photos + short bio + packages + calendar connected. Grounded: The Bash members with video get 3x the gigs (self-reported; top bookers average 8 videos and 46 photos), and Encore refuses to publish profiles without a vetted promo video ([Encore](https://encoremusicians.com/musician)). Framed as "give your agent ammunition — profile strength 60%; add a video to unlock pitching."

**Profile/EPK fields needed beyond what exists** (existing: act type, rate card/packages, calendar, writing voice):
- *Matching:* genres + 5–10 vibe tags; event types served; service radius / named cities; travel policy; **fee floor** (never pitch below) + sweet spot; languages; insured yes/no.
- *Pitching:* headline (≤80 chars); 40–120-word bio in the artist's voice; ≥1 video link; 3–5+ photos; review count + 1–2 quotes + notable venues; an auto-generated **hosted one-page EPK** — the pitch's landing page, white-label, zero AI mention.
- *Closing:* existing machinery. Tech rider / stage plot is an optional "send if asked" attachment — no marketplace evidence it converts wedding buyers.

**Daily life.** One home feed — the agent's desk. Inbound and found opportunities are the same card with a source badge ("Came to you" / "I found this"). Morning digest, mirrored to chat: "While you slept: scanned 412 listings across 6 channels, 3 matches, 3 drafts waiting, skipped 14 — tap to see why." The skipped list is the trust engine and the settings tutor ("skipped: below your $1,200 floor — adjust?").

**The card.** Event, date, location + distance, budget vs your floor, channel badge, freshness ("posted 2h ago — 1 in 3 gigs goes to the first responder"). Fit 87% + exactly 3 plain reasons + 1 caution. Then the draft and Approve / Edit / Skip; Skip asks a one-tap why that tunes matching. **Gated handoff card** (Facebook-class): "Gated — you take over: this channel doesn't allow agents to act for you," deep link + drafted reply + Copy button, then "I replied / Skip"; on "I replied" the card enters PITCHED with a 48h paste-back nudge so the thread stays in the measured funnel. (Meta's current developer policies even allow business-authored prefill in its messaging products, but groups have no API at all — copy/paste is both compliant and honest.)

**First booked gig.** The approved pitch sends 8–11am recipient-local from the artist's own mailbox; the reply drops into the existing conversation → calendar → booked flow. The weekly report gains the retention sentence: **"Your agent found 4 of your last 7 bookings."**

**The 5 key UX decisions:** (1) one feed, one pipeline, a source badge — never a separate outbound module; (2) browse free, pitch gated — the quality gate IS onboarding; (3) approve-each default, per-channel Autopilot earned after 10–20 unedited approvals, gated channels never graduate; (4) show the skipped, not just the sent — max 3 reasons per card, no AI-babble; (5) the gated handoff is a first-class card with a paste-back loop, not a dead end.

## Risks that could kill it + kill criteria

| # | Risk | Evidence | Kill criterion / mitigation (our proposed thresholds) |
|---|---|---|---|
| 1 | **Not enough supply per metro** — nobody publishes per-category volumes | Only hard number anywhere: Bash ~23 leads/mo avg | 2-week seeded vendor accounts in 3–4 metros BEFORE building. <10 fitting fresh opportunities/week/metro for a mobile DJ → narrow the promise to marketplace-speed (still valuable via Auto-Add economics) and shelve open-web discovery |
| 2 | **Cold pitches don't convert** — no published benchmark for unsolicited pitches to wedding buyers; generic cold email runs 3–5% | Belkins; Gig App's 20% is vendor-claimed | Instrument reply rate per channel from day 1; never publish promised rates. If <30% of beta artists get ≥1 real conversation from a found gig within 14 days, fix ranking/drafting before charging |
| 3 | **90-day disappointment churn** — the AI-SDR death curve | 11x 70–80% churn; ~50–70% category cancellations (directional) | North-star: % of artists with an agent-sourced booking inside 90 days. <25% at beta end → reposition from "finds you gigs" to "never miss a fast window" |
| 4 | **Channel rug-pulls** — Bark could pull Zapier; marketplaces could block; WhatsApp could reclassify the digest template | Zapier app ≠ contract; error-131049 mechanics documented | No single channel >40% of found volume; email-alert fallback for Bark; 131049 monitoring + Telegram/push fallback; Thumbtack partner application as hedge |
| 5 | **Artist account bans** on gated channels burn trust | Meta ToS; BrandTotal; extension tools carry ban reports | Handoff-only on gated channels; never duplicate text; no browser extension in v1; if any beta artist is restricted for behavior we suggested, freeze that channel |
| 6 | **Legal** — scrape-and-email is the RadPad pattern ($60.5M, incl. $40M CAN-SPAM); UK posters bring UK GDPR | Case law cited above | Alerts-first design; CAN-SPAM footers; delete dead-lead personal data at ~90 days; no enrichment beyond the post; same-day C&D kill rule |
| 7 | **Margin erosion at high cadence** | Cost model: 24/7 all-channel ≈ $280/mo | Cadence is the meter; Always-On limited to 2–3 boards at +$99; Starter never includes discovery |

## Open questions only the founder can answer

1. **Who is the v1 customer:** performers already paying for GigSalad/Bash/Bark (pitch: "your agent works what you already pay for"), or newcomers we instruct to join those platforms? This decides onboarding, copy, and whether the day-0 demo can lean on marketplace channels.
2. **Structure A or B:** fold the agent into Pro $79 as the hero plan (changing what the ladder means), or sell a flat add-on so existing customers' plans stay untouched? You know the live base's price sensitivity; the research can't.
3. **US-only launch, or US+UK together?** Bark covers both, but the UK bundle and UK WhatsApp costs are extra work, and the seeded supply test can only run in one or two markets first.
4. **Are you comfortable requiring Gmail/Microsoft OAuth at onboarding** so the agent sends as the artist from their own mailbox? It is the deliverability-correct and ToS-correct architecture, but it's a trust ask, a support surface, and the one step artists can't skip.
5. **Will you personally drive the two things software can't:** the Thumbtack Partner application (and later a Bark partner conversation), and operating the seeded vendor accounts for the 2-week volume test that gates this whole roadmap?