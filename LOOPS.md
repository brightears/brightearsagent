# LOOPS — copy-paste commands to run this project end to end

Open Claude Code in **this folder** (`Bright Ears/brightears-app`) and paste one of these. Each loop is self-pacing (no fixed interval) and stops only when it needs you.

---

## 1. THE BUILD LOOP (run this until the product is live)

```
/loop Work through ROADMAP.md strictly top to bottom. Read CLAUDE.md and docs/PRODUCT-BRIEF.md before the first item each session. For each item: implement it, verify the acceptance check (build green, tests green, feature actually works), mark it [x], and commit with a clear message. If you hit a 🔑 founder gate, write me a short plain-language instruction block (what to create, where, exact steps, what to paste back) and continue with the next non-blocked item; if everything is blocked, stop and summarize what you need from me. Use ultracode for complex phases (fan out subagents for parsers, tests, and review). Never touch ../brightears or ../brightears26. At the end of each iteration, report: items completed, current phase, what I need to do next.
```

When it pauses for a 🔑 gate, do the thing it asks (create the account, paste the key into `.env.local`), then just run the same command again — it picks up where it left off.

## 2. THE QUALITY LOOP (run weekly during the build, or after big phases)

```
/code-review high
```

Then, to apply what it finds: `/code-review high --fix`. Before any deploy: `/security-review`.

## 3. THE MARKETING ENGINE LOOP (start during Phase 6, runs forever)

```
/loop Work through Track 1 of docs/MARKETING-PLAN.md. Each iteration: pick the next unchecked engine item, produce it completely (research with real sources, write, build the page/tool in the repo where applicable), mark it [x] with a link to the artifact, and leave anything needing my approval or manual action in a "FOUNDER REVIEW" list at the end of your report. Use the verbatim customer language and brand voice from CLAUDE.md. Verify every price/claim against current sources before publishing — our credibility is the product.
```

## 4. THE LAUNCH-OPS LOOP (after launch — weekly heartbeat)

```
/loop 7d Review the live Bright Ears SaaS: pull signup/trial/conversion/churn numbers, check error logs and uptime, review LlmUsage margins per tenant (flag any below 70%), check Gate 1/Gate 2 progress from docs/PRODUCT-BRIEF.md §10, summarize what's working and what needs my attention this week, and update docs/MARKETING-PLAN.md metrics section.
```

---

## Founder gates you'll hit, in order (≈ when)

| Gate | What you create | Where |
|---|---|---|
| Phase 1 | Postmark (or Mailgun) account — **the first gate you'll hit** | postmarkapp.com — free dev tier |
| Phase 2 | ~~OpenRouter API key~~ ✓ done (in `.env.local`) | — |
| Phase 3 | Clerk app | clerk.com — free tier |
| Phase 5 | Stripe account + confirm the 3 prices | stripe.com |
| Phase 7 | GitHub: `brew install gh && gh auth login`, private repo `brightears-app` · Render API key (so agents configure the new service themselves) | github.com · dashboard.render.com → Account Settings → API Keys |
| Phase 8 | DNS records (agency./in./mail. brightears.io), LINE webhook URL change, Clerk origins | your DNS + LINE Developers Console |

Phase 8 is the only one that touches anything Vinyl-related, and the roadmap forces the safe order: old app moves to agency.brightears.io and soaks for 7 verified days BEFORE brightears.io points at the new product.
