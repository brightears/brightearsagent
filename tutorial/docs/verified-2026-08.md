# Bright Ears Tutorial-Video Factory — Sprint 0 verification

Verified on 2026-08-17 on the local Mac. This record separates primary-document claims, repository evidence, empirical results, and unverified/deferred items. Sprint 0 stops here; it authorizes no live capture or external action.

## Status and risk

- Risk tier: **Tier 2 / moderate tooling risk**. The committed scope is isolated build tooling, but a later approved workflow can hold authenticated browser state and perform representational actions. The default path is synthetic-only and all live actions have independent gates.
- Product impact: no product source, schema, migration, deployment, route, selector, or production configuration was changed.
- External actions performed: none. No Gmail disconnect/reconnect, OAuth grant, email send, live recording, YouTube upload, Google contact, commit, push, or pull request occurred.
- Output policy: generated media, auth state, caches, secrets, credentials, storage state, tokens, and nested `node_modules` are ignored. The review copy is outside the Git worktree under the dedicated task's `outputs/` directory.
- Publication policy: automated QA does not replace full human review. The manifest and metadata both keep publication blocked.

## Repository and base audit

The applicable root `AGENTS.md` was read completely. It requires consulting the bundled Next.js documentation before product-code work; no Next.js product code was changed in this sprint.

Repository facts at start:

- Known release worktree: `/Users/norbert/Documents/Codex/2026-07-30/you/brightears-work`.
- Its branch was `improve/contact-yield-and-metrics` at `07d635a28e996a35dbe8cf32029b71f74e6f9055`, initially ahead of the stale local `github/main` by three commits.
- `git ls-remote github refs/heads/main` returned `97c1cf2e48ae9f3780a4fb32d1203adbf389b273`, exactly the stated production commit.
- After a read-safe fetch, the release worktree was `ahead 3, behind 3`; it was not edited, reset, rebased, checked out, or otherwise disturbed.
- The isolated worktree is `/Users/norbert/Documents/Codex/2026-08-17/bright-ears-video-factory/work/brightears-tutorial` on `feat/bright-ears-tutorial-video-factory`, based on `github/main` at `97c1cf2e…`.
- No commit, push, PR, or explicit staging has been done. When publication work is eventually approved, stage exact paths only; never use `git add -A`.

This is the safe canonical base because it is the current GitHub `main` and current production commit, while the active release branch retains its independent work.

## Beat Breeze reference search

Two safe full-home searches traversed `/Users/norbert`, including hidden directories:

1. Exact paths/names for `research/tutorial-video-factory-202608/EXECUTION-PLAN.md`, `research/tutorial-video-factory-202608/research/audit.md`, `.claude/worktrees/beat-breeze-tutorial-system-c090fd/tutorial/`, and `.claude/worktrees/beat-breeze-tutorial-system-c090fd/.claude/skills/make-tutorial/`.
2. Relocated files/directories named `EXECUTION-PLAN.md`, `audit.md`, `SKILL.md`, `beat-breeze-tutorial-system-c090fd`, or `make-tutorial`, filtered for the Beat Breeze/tutorial paths.

No matching source material was found. No stale or unaudited Beat Breeze code was copied. The design therefore derives from this task specification, current primary documentation, the Bright Ears repository, and local empirical tests.

## Toolchain verification

### Remotion and Node

- npm and the official Remotion renderer documentation both reported current stable Remotion `4.0.512` on 2026-08-17. The renderer docs require all `remotion` and `@remotion/*` packages to use the same exact version and warn against caret ranges. All four installed Remotion packages are pinned to `4.0.512`: [official renderer documentation](https://www.remotion.dev/docs/renderer).
- The repository specifies Node `22.22.0`; the tutorial package requires `22.x`. Remotion's npm package did not publish an `engines` field, so Node 22 support is an empirical result rather than a claimed upstream range. Playwright `1.62.1` declares Node `>=20`.
- Empirical result: Node `v22.22.0` installed 292 tutorial packages, typechecked the code, ran tests, bundled the Remotion composition, downloaded Chrome Headless Shell `149.0.7790.0` for macOS arm64, rendered 900 frames, and produced the final package successfully.
- Remotion's official site has a usage-based/company licensing model. Bright Ears must confirm its team size and “creator” versus automation use before recurring commercial production; Sprint 0 does not claim a license decision: [Remotion license/pricing](https://www.remotion.dev/).

### Playwright and Chrome capture

- Installed Playwright: `1.62.1`; local desktop Chrome: `151.0.7922.138` on arm64 macOS `26.5.2`.
- Official behavior: video is off by default; recorded files finalize when the browser context closes. If `recordVideo.size` is omitted, Playwright scales the viewport down to fit within 800×800; an unspecified viewport/video defaults to 800×450. The factory therefore sets both viewport and video size to exactly 1920×1080: [Playwright video guide](https://playwright.dev/docs/videos), [Browser context options](https://playwright.dev/docs/api/class-testoptions#test-options-video).
- Official security warning: storage state may contain cookies/headers capable of impersonating the account and must not be committed. The factory stores it only below ignored `tutorial/.auth/`: [Playwright authentication guide](https://playwright.dev/docs/auth).
- Empirical non-recording probe: Playwright launched the installed Chrome channel headlessly, created a 1920×1080 viewport at device pixel ratio 1, and wrote a probed 1920×1080 PNG.
- Intentional discrepancy: no Playwright video recording was started. The task explicitly prohibited starting a recording before action-time confirmation. Recording dimensions and context-close semantics are verified from the primary API documentation, while the local encoder path remains a Sprint 1 preflight after approval.
- Headed authentication is separate and unrecorded. The user types credentials personally; the tool has no password argument, input, inspection, or log path.

### ffmpeg and codecs

- Local binaries: `/opt/homebrew/bin/ffmpeg` and `/opt/homebrew/bin/ffprobe`, version `8.1.2`.
- Empirically available encoders: `libx264`, `h264_videotoolbox`, `libvpx-vp9`, `hevc_videotoolbox`, and AAC; H.264, VP9, and AAC decoders are present.
- The factory currently uses Remotion H.264 frames, system ffmpeg for audio assembly/ducking, AAC at 192 kb/s, and `+faststart` MP4 packaging.
- The Homebrew ffmpeg build is GPL-enabled because it includes x264. The binary is an operator dependency and is not redistributed by this repository.

### Narration

- Sprint 0 development fallback: `/usr/bin/say` with the installed `Samantha` `en_US` voice. It was used only to exercise and probe the synthetic placeholder pipeline.
- Publication provider: Google Cloud Text-to-Speech. The synchronous REST method is `POST https://texttospeech.googleapis.com/v1/text:synthesize`, accepts text or SSML plus a voice/audio configuration, and returns base64 audio: [text.synthesize reference](https://docs.cloud.google.com/text-to-speech/docs/reference/rest/v1/text/synthesize).
- Google recommends Application Default Credentials (ADC) for client-library workflows. The local factory instead uses a dedicated API key at the user's request, sends it only in the `x-goog-api-key` header, and reads it from the process environment or ignored `tutorial/.env.local`: [Cloud TTS authentication](https://docs.cloud.google.com/text-to-speech/docs/authentication), [API-key best practices](https://docs.cloud.google.com/docs/authentication/api-keys-best-practices).
- The configured local key is restricted to Cloud Text-to-Speech and the current rendering Mac's IP addresses. Its ignored file is mode `0600`; the value was never printed or committed. Do not add service-account JSON or API-key values to the repository.

### YouTube upload

- Upload requires OAuth and at least the narrow `youtube.upload` scope; `videos.insert` accepts `video/*` or `application/octet-stream`, supports a 256 GB maximum file, and can set metadata/privacy. API projects created after 2020 that have not passed the required audit restrict uploaded videos to private: [videos.insert](https://developers.google.com/youtube/v3/docs/videos/insert), [upload guide](https://developers.google.com/youtube/v3/guides/uploading_a_video).
- Current documentation reports a separate Video Uploads quota bucket; quota values can change and must be rechecked at implementation time.
- Uploading is not implemented. There is no upload command, credential path, or YouTube OAuth state in Sprint 0.

### Fonts, music, and assets

- Placeholder font: macOS system `Avenir Next` with `Arial` fallback. The font file is not copied or redistributed. The render is reproducible on this Mac, but cross-machine pixel identity is not guaranteed. Before a CI/cloud renderer is adopted, select and commit an approved redistributable font with its license and hash.
- Placeholder music: a deterministic test-only 220 Hz + 330 Hz ffmpeg signal generated during the run. It is original procedural audio, explicitly marked not for publication. It exercises music ducking without importing a third-party track.
- Sprint 1 Google verification plan has music disabled so narration and consent text remain unambiguous.
- No external logo, stock image, video, or customer asset is bundled. The composition now uses repository-owned `public/brand/logo.svg` (SHA-256 `48dd8c36e93690d2a26c58aaf22843f6945e307451b2fdc0143cf3dee301ce49`) and the product's Neon Collage v2 palette from `app/globals.css`. Live product footage shows the production UI itself.
- Long-term music requires a written commercial license/source URL, local source hash, attribution requirements, territory/platform terms, and proof that video/tutorial/YouTube use is covered before a manifest can validate.

## Google OAuth and Bright Ears data-boundary verification

### Google's review requirements

Google's current verification guide requires the demonstration to show the end-to-end app flow including the OAuth grant, the same app name/branding, the complete consent screen, the exact requested scopes, English selected at the lower left, and app functionality that uses those scopes: [Google verification requirements](https://support.google.com/cloud/answer/13464321).

Google also requires clear identity/purpose, minimum relevant permissions, accurate privacy disclosures, secure handling, and Limited Use compliance: [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy).

The official Gmail scope table describes `gmail.send` as “Send email on your behalf,” while read/list capabilities are separate scopes such as `gmail.readonly`, `gmail.modify`, and `gmail.metadata`: [Gmail scopes](https://developers.google.com/workspace/gmail/api/auth/scopes). The `users.messages.send` method accepts `gmail.send`: [send method](https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/send).

### Repository evidence at production commit `97c1cf2e…`

- `lib/oauth/google.ts:26-28` defines only `gmail.send`, `openid`, and `email`; `buildAuthUrl()` uses that exact list at lines 67-78.
- `lib/outbound/gmail.ts:15` contains the only Gmail message endpoint used by the transport: `users/me/messages/send`; lines 206-213 perform only that POST.
- A source search found no Gmail read/list/modify endpoint or read scope outside negative assertions in tests.
- `lib/llm/index.ts:64-74` centralizes OpenRouter construction and applies `{ data_collection: "deny", zdr: true }` to every model. OpenRouter documents `data_collection: "deny"` as excluding providers that may store/train and `zdr: true` as requiring zero-data-retention endpoints: [OpenRouter provider routing](https://openrouter.ai/docs/guides/routing/provider-selection).
- `tests/google-data-boundary.test.ts:8-37` asserts the narrow scope, transport/LLM dependency separation, pre-consent disclosure, and Limited Use language.
- `tests/llm-timeout.test.ts:55-67` asserts both routing controls are passed for the model.
- `components/mailbox-card.tsx:141-163` contains the prominent pre-consent disclosure: send only; never read/list/import; connected address, tokens, and message IDs never sent to OpenRouter; privacy-policy link before the Connect Gmail action.
- `app/(marketing)/privacy/page.tsx:123-143` publicly discloses `gmail.send`, no Gmail reading/listing/import, encrypted token storage, Google message-ID storage, Limited Use, and separation from AI providers.
- AI drafting and Gmail are structurally separate. Reactive drafts load Bright Ears business/profile/packages and Postmark-delivered inbound messages in `lib/agent/generate-for-lead.ts`; venue pitches load business/profile plus discovered public venue evidence in `lib/venues/draft-pitch.ts`; only the later Gmail transport sends the finished approved payload.

This supports the proposed narration. The video must phrase these as the product's implemented design and visible policy, not as a claim that Google itself has certified the architecture.

## Architecture adopted

The factory is a nested, private Node package under `tutorial/`; it is absent from root scripts and does not alter the Render product build.

```text
tutorial/
  manifests/       reviewed tutorial/project specifications
  src/manifest.ts  Zod schema for video, privacy, scenes, actions, and provenance
  src/capture.ts   separately gated headed auth and Playwright capture
  src/pipeline.ts  validate, narrate, compose, package, QA, and resumability
  src/remotion/    branded deterministic visual composition
  tests/           manifest and safety-gate tests
  docs/            verification and execution record
  output/          ignored generated runs
.claude/skills/make-tutorial/
  SKILL.md          concise agent workflow and safety policy
```

Manifest properties make the following reviewable before execution:

- fixed 1920×1080/30 fps output contract;
- narration provider/voice/rate;
- music source and license provenance;
- scene timing, chapter, narration, titles, and bullets;
- synthetic versus capture scenes;
- allowlisted hosts, ordered actions, and mask selectors;
- independent `mailbox-change` and `send-email` external-action markers;
- forbidden secret patterns, the narrow allowed-email list, and mandatory frame review;
- explicit `recordCredentials: false` and `allowUpload: false` invariants.

Stages write fingerprints to `state.json` and resume only when their expected outputs remain present. The fingerprint includes the manifest, implementation sources, package lock, Node, and Remotion version, so code or dependency changes invalidate stale stages. Manifest hash, exact tools, git commit, sources, music, narration mode, output hashes, and safety facts are written to `metadata.json`.

The generated contract is:

- `tutorial.mp4`
- `thumbnail.png`
- `subtitles.srt`
- `chapters.txt`
- `metadata.json`
- `qa-report.json` (additional required internal gate)

Automated QA checks exact dimensions, H.264, AAC, duration tolerance, thumbnail dimensions, subtitle cue count, monotonic chapters beginning at 00:00:00, artifact hashes, secret-like text, and the human-review gate. Full-frame visual redaction, pronunciation, caption meaning, and audio taste remain human checks.

## Sprint 0 empirical run

The synthetic manifest generated a green package with no browser capture or external data:

- 30.000 seconds, 900 frames, 1920×1080, 30 fps;
- H.264 High profile video (`avc1`) and AAC-LC 48 kHz audio;
- three subtitle cues and three monotonic chapters;
- 1920×1080 PNG thumbnail;
- test narration from macOS `say` and a ducked procedural music bed;
- no secret-pattern hit;
- artifact hashes matched metadata;
- `humanReviewRequired: true`, `sentEmail: false`, `uploaded: false`, and `containsLiveProductCapture: false`.

Additional media probes found no black interval of 0.5 seconds or more. EBU R128 measured -15.8 LUFS integrated, 7.8 LU loudness range, and -1.3 dBFS true peak. Silence detection found expected narration-free reading space at the end of each ten-second scene; the test music is deliberately very quiet and is not a publication mix.

Placeholder video SHA-256: `01083110b1ff1dd89b3226a0be43293d4ebcb7a19226177c9fffcc248f5ffa33`.

A second full render after the resumability/import-resolution changes produced the same video, thumbnail, SRT, and chapter hashes, providing empirical evidence of deterministic composition on this Mac.

Verification checks completed:

- tutorial TypeScript build: pass;
- full root Next.js 16 production build: pass with no product environment secrets (a non-secret local-format `DATABASE_URL` was supplied only because Prisma generation validates that variable; no database connection occurred);
- tutorial ESLint: pass;
- tutorial Vitest: 6/6 pass, including denial before any headed browser/recording without fresh confirmation;
- full existing product suite: 996/996 tests across 97 files pass; the targeted Google data separation, Gmail send behavior, and OpenRouter routing/deadline subset is 33/33;
- both Sprint 0 and Sprint 1 manifests: schema-valid;
- repo-local `make-tutorial` skill: valid with the skill-creator validator;
- `git diff --check`: pass;
- ignore probes: `node_modules`, `.auth`, `.cache`, `.secrets`, output media, storage state, client secrets, credentials, and token files are ignored;
- tracked-file probe: no ignored tutorial state/media is tracked;
- source secret-pattern scan: no secret-like value found;
- `npm audit --omit=dev`: zero production vulnerabilities in both the root and tutorial package at check time.

## Exact Sprint 1 storyboard: Google OAuth verification

The reviewed plan is encoded but inert in `tutorial/manifests/google-oauth-verification.sprint1.json`. Estimated length is about 2 minutes 5 seconds before editorial tightening.

1. **Purpose — synthetic, 12 s.** Identify Bright Ears and state that Gmail is a delivery transport. On-screen: `gmail.send + openid + email`; no Gmail read/list/import.
2. **Pre-consent disclosure — real product, 20 s.** Open the production Control Room at Connections while the founder mailbox is disconnected. Show the entire “What connecting Gmail allows” panel and its Privacy Policy link before clicking Connect Gmail.
3. **Google consent — real product/Google, 35 s.** Click Connect Gmail. Show the complete Google consent flow with Bright Ears branding, English selected at bottom left, and the exact send-email permission. Use an already authenticated founder session; never record credential entry. Grant consent only after a fresh mailbox-change approval.
4. **Scope in use — real product, 20 s.** Back on Connections, show the connected founder address and “Connected.” Only with a separate fresh send approval, click “Send test email,” which sends a sample to `norbert@brightears.io` itself; show the success result. Contact no venue/customer.
5. **Data isolation — synthetic diagram, 18 s.** Left path: Bright Ears profile + Postmark inbound + public venue facts → AI draft, with OpenRouter `data_collection=deny` and `zdr=true`. Right path: connected email + encrypted OAuth tokens + returned Gmail message ID → Gmail transport only. The paths meet only at the finished owner-approved email payload.
6. **Limited Use — real public policy, 20 s.** Open `https://brightears.io/privacy`, hold on the full “Google Limited Use and separation from AI providers” section, and close on the no-read/no-AI-transfer commitment.

Editing requirements:

- No music unless Google specifically permits it and review confirms speech clarity; current plan uses none.
- Keep the browser address/app identity and complete consent text legible at 1080p.
- Do not zoom/crop away any requested scope or the English language indicator.
- Do not show a password, one-time code, secret, token, cookie, unrelated inbox, venue/customer data, internal admin page, developer console, logs, database, or Render dashboard.
- A reviewer watches every frame, reads the SRT, checks the one allowed email, and validates consent-screen scope text against the Cloud Console submission before any upload.

## Required user actions before Sprint 1

These are separate decisions; none is implied by reviewing Sprint 0:

1. Approve the storyboard/script, founder-email visibility, redaction list, and no-music choice.
2. At action time, approve disconnecting the current Gmail connection if it is connected. The operator/user performs and verifies the disconnected starting state before recording.
3. At action time, approve one unrecorded headed-login session. The user types all product/Google credentials personally. Confirm the resulting ignored auth state can reach both Bright Ears settings and the Google account chooser without any credential prompt.
4. Confirm the Google consent screen is production, branded Bright Ears, matches the submitted app, displays the exact scopes, and can be shown entirely in English.
5. Separately approve starting the live recording and the OAuth reconnect/grant.
6. Separately approve one controlled test email to `norbert@brightears.io`. If not approved, the video cannot honestly demonstrate the requested scope in use and should not be submitted as complete.
7. Review the resulting cut, thumbnail, SRT, chapters, metadata, QA report, and a frame-contact sheet.
8. Only after that review, separately decide whether to upload and whether to message Google. Upload/contact tooling remains out of scope here.

## Deferred decisions and known limitations

- The Google TTS adapter and `en-US-Chirp3-HD-Aoede` review voice are implemented. Final voice acceptance remains part of the user's mandatory playback review; changing to ADC or service-account attachment is optional future hardening for a hosted renderer.
- Confirm Remotion commercial licensing for Bright Ears' team/use model.
- Select a redistributable brand font for deterministic CI/cloud rendering.
- Select and license publication music for ordinary tutorials; verification video currently uses none.
- Verify Playwright's actual 1920×1080 recorded WebM on this Mac only after recording approval. The API is configured explicitly, but no recording was started in Sprint 0.
- Add optional OCR/contact-sheet QA after selecting a safe local OCR dependency. Automated OCR must supplement, never replace, manual review.
- Decide localization policy: translated script review, locale-specific TTS voice, line-breaking, UI locale, SRT, thumbnail text, and per-language QA. English remains the only enabled publication locale.
- Decide future YouTube credential ownership, private-first upload policy, retry/idempotency, audit requirements, and reviewer approval boundary before implementing any uploader.

## Review commands

Repository review:

```sh
cd /Users/norbert/Documents/Codex/2026-08-17/bright-ears-video-factory/work/brightears-tutorial
git status --short --branch
git diff -- .gitignore
git ls-files --others --exclude-standard | sort
sed -n '1,260p' tutorial/docs/verified-2026-08.md
git diff --check
git log -1 --oneline --decorate
```

Tooling verification with Node 22:

```sh
cd /Users/norbert/Documents/Codex/2026-08-17/bright-ears-video-factory/work/brightears-tutorial/tutorial
PATH=/opt/homebrew/opt/node@22/bin:$PATH npm ci
PATH=/opt/homebrew/opt/node@22/bin:$PATH npm run build
PATH=/opt/homebrew/opt/node@22/bin:$PATH npm test
PATH=/opt/homebrew/opt/node@22/bin:$PATH npm run validate -- manifests/sprint0-placeholder.json
PATH=/opt/homebrew/opt/node@22/bin:$PATH npm run validate -- manifests/google-oauth-verification.sprint1.json
```

Re-run or re-check the synthetic package (no live action):

```sh
PATH=/opt/homebrew/opt/node@22/bin:$PATH npm run run:placeholder -- --output /Users/norbert/Documents/Codex/2026-08-17/bright-ears-video-factory/outputs/sprint0-placeholder
PATH=/opt/homebrew/opt/node@22/bin:$PATH npm run qa:placeholder -- --output /Users/norbert/Documents/Codex/2026-08-17/bright-ears-video-factory/outputs/sprint0-placeholder
ffprobe -v error -show_streams -show_format -of json /Users/norbert/Documents/Codex/2026-08-17/bright-ears-video-factory/outputs/sprint0-placeholder/tutorial.mp4
shasum -a 256 /Users/norbert/Documents/Codex/2026-08-17/bright-ears-video-factory/outputs/sprint0-placeholder/{tutorial.mp4,thumbnail.png,subtitles.srt,chapters.txt}
open /Users/norbert/Documents/Codex/2026-08-17/bright-ears-video-factory/outputs/sprint0-placeholder/tutorial.mp4
```

Skill validation:

```sh
/Users/norbert/Documents/Codex/2026-08-17/bright-ears-video-factory/work/skill-validator-venv/bin/python /Users/norbert/.codex/skills/.system/skill-creator/scripts/quick_validate.py /Users/norbert/Documents/Codex/2026-08-17/bright-ears-video-factory/work/brightears-tutorial/.claude/skills/make-tutorial
```

Do not run the headed-auth or capture commands during Sprint 0 review.

## Sprint 1 execution update — 2026-08-20

Sprint 1 proceeded only after the user approved the reviewed Bright Ears workflow, approved the mailbox disconnect, personally completed Google authentication off-record, and authorized the production OAuth reconnect plus one controlled self-send. Risk remains **Tier 2 / moderate tooling risk**. No customer or venue was contacted, no upload occurred, and no message was sent to Google.

### Live-action record and final state

- The production Outreach mailbox was disconnected only to capture the real pre-consent state. It was restored after the corrected disclosure take.
- Google showed the Bright Ears account chooser, Bright Ears branding, `norbert@brightears.io`, English (United Kingdom) at the lower left, a “signing back in” step, and the complete permission screen. The sole Gmail permission displayed was **“Send email on your behalf.”**
- Bright Ears returned to production Settings with the Outreach mailbox connected as `norbert@brightears.io`.
- One and only one test message was triggered. The product showed `AI-generated test sent to norbert@brightears.io — check your inbox.` No second test was sent during corrected scene recaptures.
- The final verified production state is connected to `norbert@brightears.io`. Uploading and contacting Google remain separately prohibited pending human review.

### Safety incidents and corrections

- Playwright's system-level ffmpeg probe was insufficient for its recorder; the first recording attempt stopped before a page or external action because Playwright's own `ffmpeg-1011` helper was absent. The official helper was installed into the user's Playwright cache. A synthetic local recorder preflight then empirically produced 1920×1080 VP8 footage.
- In a later take, Google unexpectedly requested login after recording had begun. The user completed the login before reporting it. The recorder was stopped immediately, every file from that take was permanently deleted without viewing, and the take was never used. The headed-auth helper was changed to resume an existing ignored storage state; the saved session was then empirically verified to reach Bright Ears and Google's signed-in account page with no login fields before the successful take.
- An early post-capture probe incorrectly read the separate Bright Ears assistant inbound address higher on the Connections page. Frame review and a card-scoped probe confirmed the Outreach mailbox and test recipient were `norbert@brightears.io`. The future send guard now scopes to the Outreach mailbox card and refuses unless exactly one visible address matches the manifest allowlist.
- The initial disclosure and privacy captures did not place all required text inside the viewport. The reusable action format now supports explicit centered `scrollIntoView`, minimum scene holds, and `--scene=<scene-id>` recapture. Only those two non-send scenes were replaced; the email action was not replayed.
- Capture cleanup now closes browsers/readline handles on failure and deletes Playwright's redundant raw copy after saving the canonical scene file. Four older redundant WebM copies and temporary review stills were removed after final review. The four canonical ignored captures remain for local provenance.

### Empirical capture and edit results

- Playwright source recordings are 1920×1080 VP8 at 25 fps on this Mac. The documented 1920×1080 size configuration is correct; the empirical source frame rate differs from the 30 fps delivery contract.
- The live edit stage uses manifest-listed source windows, produces safe H.264 intermediate clips, and normalizes them to 1920×1080 at 30 fps before Remotion composition.
- The consent edit includes only the account chooser, sign-back-in screen, and send-only permission screen. It ends before the production Identity page and business mailing address appear.
- The self-send edit shows the connected founder mailbox, the in-progress send, and the product's success text, then freezes the verified success state for reading time.
- The disclosure edit shows the full pre-consent explanation and Connect Gmail action. The Limited Use edit shows the full public section and the adjacent `gmail.send` description.
- Final frame sampling found no password, one-time code, token, cookie, customer/venue record, developer console, Render/admin screen, or Identity/address frame.

### Superseded development-voice review package

Local ignored package: `tutorial/output/google-oauth-verification/`.

- `tutorial.mp4`: 125.000 seconds, 3,750 frames, 1920×1080, 30 fps, H.264 High, AAC-LC stereo 48 kHz.
- Video SHA-256: `1cc58cbe530fdededb9a7ba4f48fddcbf3880b2ad17c6dd8ae44db46a1a36884`.
- `thumbnail.png`: 1920×1080.
- `subtitles.srt`: six cues; `chapters.txt`: six strictly monotonic chapters beginning at `00:00:00`.
- `metadata.json` records the production git commit, manifest and capture hashes, exact edit windows, tools, live-capture status, the one test send, no upload, and mandatory human review.
- `qa-report.json`: all automated checks pass, including dimensions, 30 fps, codecs, exact duration, subtitle/chapter counts, artifact hashes, and secret-pattern scan.
- Final contact-sheet SHA-256: `aecac10cd8c4f81264b7d3a0236c7d47346dd2fa148296551d14936707facc4c`.
- Black detection found no black interval of 0.5 seconds or more. EBU R128 measured -15.8 LUFS integrated, 8.2 LU loudness range, and -4.4 dBFS true peak. Expected reading-room silence remains after each voiceover sentence because the verification cut has no music.

These hashes and audio measurements describe the first development-voice review cut and are retained as an execution record. That cut used macOS `Samantha` and has been superseded by the Google TTS cut below. No upload or submission occurred.

### Review revision requested 2026-08-20

The user rejected the development `Samantha` voice and requested Google Cloud TTS plus tighter Bright Ears branding. The revised implementation:

- replaces the temporary CSS mark with the repository-owned cyan-ring `BE` logo;
- uses the exact product ink, cream, cyan, magenta and orange values from `app/globals.css`;
- synthesizes publication narration through `POST https://texttospeech.googleapis.com/v1/text:synthesize` with manifest voice `en-US-Chirp3-HD-Aoede` and LINEAR16 output;
- provides a dedicated-key adapter that sends the key in the `x-goog-api-key` header, suppresses it from network errors, and reads it only from the process environment or ignored `tutorial/.env.local`;
- keeps the key out of manifests, source, commands, metadata, child-process arguments, logs and generated provenance.

Google's current API-key guidance recommends the `x-goog-api-key` header instead of a query parameter and recommends both API and application restrictions: [use API keys](https://docs.cloud.google.com/docs/authentication/api-keys-use), [manage and restrict API keys](https://docs.cloud.google.com/docs/authentication/api-keys), [API-key best practices](https://docs.cloud.google.com/docs/authentication/api-keys-best-practices). Cloud TTS's own authentication guide continues to recommend Application Default Credentials for client libraries: [Cloud TTS authentication](https://docs.cloud.google.com/text-to-speech/docs/authentication). The dedicated key path is used here at the user's request for this local rendering workflow.

The first attempted dedicated Cloud TTS project had neither the API enabled nor billing attached. Its billing prompt was cancelled and no billing account was linked. After separate user confirmations, a dedicated key named for the Bright Ears Tutorial Factory was created in the already billed project `gen-lang-client-0359686621`, restricted to Cloud Text-to-Speech and the rendering Mac's current IPv4 and IPv6 addresses. The value is present only in ignored `tutorial/.env.local`, whose mode is `0600`; it was never printed, included in a command, written to metadata, or committed.

An empirical live API probe produced 24 kHz mono LINEAR16 narration. The final render uses Google Cloud TTS voice `en-US-Chirp3-HD-Aoede`; Node 22 typecheck passes; 15/15 tutorial tests pass, including six credential/request tests; both manifests validate; and the synthetic brand-only render passes automated QA.

### Current Google TTS review package

The Google TTS rerender supersedes the development-voice hashes above.

- `tutorial.mp4`: 125.000 seconds, 3,750 frames, 1920×1080, 30 fps, H.264 High, AAC-LC stereo 48 kHz.
- Video SHA-256: `79c2779862c506cff242d42c0b67574c262c2322a42b9cf765c640a81e2a82ee`.
- `thumbnail.png`: 1920×1080; SHA-256 `6f9fb7d7d7e018535ad88070d18be50b13252dabbe541d217f1f260578cfb85b`.
- `contact-sheet.png`: twelve reviewed frames; SHA-256 `6f30d25d75a518f949c2ae41bedc5ae61e1ca987130405b5d019dc9a8e389c1e`.
- `subtitles.srt`: six cues; SHA-256 `d8a433aac5657da470b8d87ee01cac2a0c291ef6accb2ec98a40df7731eb14dd`.
- `chapters.txt`: six strictly monotonic chapters beginning at `00:00:00`; SHA-256 `8ade297c8bd9cf51c91afc5f9c518b52cee384a7fc8d05865d269fdae4a0e4f2`.
- `metadata.json` records provider `google-cloud-tts`, voice `en-US-Chirp3-HD-Aoede`, the live-capture provenance, the one approved self-send, no upload, and mandatory human review.
- `qa-report.json` passes every automated check: dimensions, frame rate, codecs, duration, thumbnail, subtitles, chapters, artifact hashes, secret-pattern scan, and the human-review gate.
- EBU R128 measurement: -16.1 LUFS integrated, 8.0 LU loudness range, and -1.4 dBFS true peak. Black detection found no black interval of 0.5 seconds or more.

The real repository-owned cyan-ring `BE` logo appears beside the Bright Ears name. The composition uses the product's Neon Collage v2 ink, cream, cyan, magenta, and orange values. Frame review found no password, one-time code, token, cookie, customer/venue record, developer console, Render/admin screen, or Identity/address frame. The founder email remains visible intentionally as part of the approved verification demonstration.

The video remains blocked on the user's complete playback, pronunciation, subtitle, and frame review. Uploading, publishing, merging, or contacting Google requires a separate instruction.

Review the package with:

```sh
cd /Users/norbert/Documents/Codex/2026-08-17/bright-ears-video-factory/work/brightears-tutorial/tutorial
open output/google-oauth-verification/tutorial.mp4
open output/google-oauth-verification/contact-sheet.png
open output/google-oauth-verification/thumbnail.png
cat output/google-oauth-verification/qa-report.json
cat output/google-oauth-verification/metadata.json
```
