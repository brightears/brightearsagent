---
name: make-tutorial
description: Build, revise, render, and QA Bright Ears tutorial-video packages from manifests under tutorial/. Use for a new tutorial topic or script, synthetic pipeline checks, approved product capture, narration, subtitles, chapters, thumbnails, metadata, localization planning, or diagnosing a tutorial run. Enforce live-action approvals, secret hygiene, asset provenance, and mandatory human review.
---

# Make Tutorial

Build through the repository's isolated `tutorial/` package. Keep product-code changes out of scope unless a stable capture selector genuinely requires an inert `data-testid`; isolate and call out any such change.

## Prepare

1. Read the applicable `AGENTS.md`, `tutorial/README.md`, and `tutorial/docs/verified-2026-08.md` completely.
2. Confirm Node 22 is active and work from `tutorial/`.
3. Inspect Git status before editing. Preserve unrelated work and stage explicit paths only; never use `git add -A`.
4. Copy the closest reviewed manifest in `tutorial/manifests/`. Keep source licenses and hashes in provenance.
5. Use synthetic scenes until the script, redaction plan, accounts, selectors, and live actions have been reviewed.

## Enforce safety gates

- Never inspect, accept, type, print, or store a password. For an approved login, let the user type in the unrecorded headed browser. Store only ignored auth state under `tutorial/.auth/`.
- Never run headed login, live capture, OAuth/mailbox changes, an email send, or any upload without fresh action-time approval for that exact action.
- Require the CLI's exact confirmation flags. Do not weaken or bypass them.
- Never record a credential entry. Prepare all sessions off-record, then verify the destination page before capture.
- Allow only manifest-listed hosts. Mask approved selectors and stop if any customer, venue, secret, token, credential, or admin-only data could appear.
- Keep `allowUpload` false. Uploading is not implemented. A human must review every frame and artifact before publication.

## Run the pipeline

Use Node 22 for every command:

```sh
npm ci
npm run validate -- manifests/<tutorial>.json
npm run build
npm test
npm run run:placeholder -- --output ./output/<tutorial>
```

The default run accepts only `synthetic-only` manifests. Stages are resumable through `state.json`. Treat generated media, `.auth/`, `.cache/`, `.env*`, storage state, credentials, tokens, and `node_modules/` as local ignored state.

For approved publication narration, use the reviewed Google Cloud TTS adapter with a dedicated API-restricted key stored only in ignored `tutorial/.env.local`. Never put a key in a manifest, source file, command, chat, issue, or PR, and never add credential JSON to the repository. macOS `say` is development-only.

## Review the package

Require all of these before handoff:

- `tutorial.mp4`, `thumbnail.png`, `subtitles.srt`, `chapters.txt`, `metadata.json`, and a passing `qa-report.json`.
- Exact 1920x1080, 30 fps H.264 video and AAC audio unless a reviewed manifest changes the delivery contract.
- Monotonic chapters, matching subtitle cue count, current artifact hashes, and no secret-pattern hits.
- Manual playback, subtitle, pronunciation, music-ducking, redaction, and full-frame review.
- A report of any remaining action approvals. Do not publish, send, reconnect, disconnect, or contact a reviewer on the user's behalf.

## Handle live capture only after approval

Use the commands documented in `tutorial/README.md`. The auth command must remain unrecorded. The capture command needs separate confirmation for recording, mailbox changes, and sending when those actions appear in the manifest. Stop on selector drift, unexpected hosts, a sign-in screen, an account chooser that requires credentials, or any sensitive content not covered by the reviewed mask plan.
