# Bright Ears Tutorial-Video Factory

This isolated Node 22 toolchain turns a reviewed tutorial manifest into a reproducible video package. It does not participate in the Next.js product build.

## Pipeline

`manifest -> validate -> narrate -> capture -> compose -> package -> QA -> human review`

- `validate` checks the schema, privacy policy, action gates, and source provenance.
- `narrate` uses macOS `say` for local development. Google Cloud TTS is the planned publication provider.
- `capture` uses Playwright with an explicit 1920x1080 viewport and recording size. Live capture is disabled unless the manifest allows it and the operator supplies the exact confirmation flag.
- `compose` uses Remotion for deterministic frames, then ffmpeg adds narration and a ducked, provenance-tracked music bed.
- `package` writes `tutorial.mp4`, `thumbnail.png`, `subtitles.srt`, `chapters.txt`, and `metadata.json`.
- `qa` probes codecs, dimensions, duration, audio, chapters, subtitles, hashes, and secret-like text. Human frame review remains mandatory.

Each stage records its input fingerprint in `state.json`; unchanged successful stages are reusable. Generated work stays in `tutorial/output/` by default and is ignored by Git.

## Safe placeholder

From this directory, with Node 22 first on `PATH`:

```sh
npm ci
npx playwright install chromium
npm run run:placeholder -- --output ./output/sprint0-placeholder
```

The placeholder is synthetic. It opens no product page, performs no login, uses no credentials, sends nothing, and uploads nothing.

## Live-use gates

Do not run `auth:headed` or `capture` without action-time approval. `auth:headed` opens an unrecorded browser where the user enters credentials personally; the tool never accepts or logs passwords. Auth state is written only beneath ignored `tutorial/.auth/`. Capture refuses live manifests without `--confirm-live-capture=I_HAVE_USER_CONFIRMATION`.

After fresh approval, the headed-login shape is:

```sh
npm run auth:headed -- bright-ears-google-demo https://brightears.io/dashboard/settings --confirm-headed-login=I_HAVE_USER_CONFIRMATION
```

The user completes both product and Google sessions personally while no recording is active. Re-running the command with the same profile resumes its ignored storage state, so a Google-only login preflight does not discard the existing Bright Ears session. Do not run the Sprint 1 capture until its storyboard and masks have been reviewed. That capture has independent gates for recording, mailbox changes, and the controlled self-send:

```sh
npm run capture -- manifests/google-oauth-verification.sprint1.json \
  --confirm-live-capture=I_HAVE_USER_CONFIRMATION \
  --confirm-mailbox-change=I_HAVE_USER_CONFIRMATION \
  --confirm-send=I_HAVE_USER_CONFIRMATION
```

To replace one reviewed scene without replaying unrelated external actions, add `--scene=<scene-id>`. Approval checks are calculated only from that selected scene; the live-recording confirmation is always required.

After every live source has been frame-reviewed, build a local review cut with the explicitly labelled macOS narration fallback:

```sh
npm run run:live -- manifests/google-oauth-verification.sprint1.json \
  --narration-fallback=say \
  --sent-email=true
```

The command reads only ignored files from `.work/captures/`, applies manifest-listed edit windows, normalizes them to 30 fps, and never replays capture actions. Metadata records the actual narration provider and whether the approved test send occurred.

Uploading is intentionally not implemented in Sprint 0. Every package requires human review before any publication or verification submission.
