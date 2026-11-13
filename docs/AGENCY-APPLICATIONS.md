# Artist applications (/join)

10 November 2026. Field list, values and consent text come from the Talent desk spec, `team/talent/application-form-spec.md` (v1) under the records root.

## Flow

1. A visitor submits `/join` (English or Thai). The browser posts `multipart/form-data` to `POST /api/agency/applications`: a `payload` JSON field and an optional `photo`.
2. Before upload, the browser redraws the photo at 2,400 pixels on the long side as JPEG (`lib/agency/photo-resize.ts`), usually 0.5 to 1.5 MB. The original is sent only if the browser cannot redraw it and it is already under the limit.
3. The server validates the payload (`lib/agency/application-contract.ts`), sniffs the photo bytes (JPG, PNG or WebP, at most 3 MB), and saves an `ArtistApplication` row plus an optional `ArtistApplicationPhoto` row in Postgres. Photos never go to the public R2 bucket.
4. The Talent desk runs `team/web/application_export.py` under the records root. It reads pending applications with the Mac-side `AGENCY_INQUIRY_TOKEN`, writes each one and its photo to `team/talent/inbox/` (0600 files, 0700 folders), checks the photo hash, acknowledges it (which deletes the site's photo copy), records the `agency:application-export` heartbeat and calls the purge.

Applications never enter `/api/agency/inquiries`, so the hourly Vinyl enquiry worker is unchanged. Nothing is sent to the applicant beyond the on-screen confirmation.

## Rules the code enforces

- No field for ID, passport, bank, date of birth, address or work-permit documents. A 13-digit number starting 1–8 (Thai ID pattern) in any free-text field is refused with a field message.
- At least one of email, LINE ID or phone; one https link; both consent boxes.
- `/join` accepts submissions only while the export heartbeat is under 8 days old, so nobody applies into an unread queue. Before the first export run it answers 503 and the page offers LINE.
- Duplicate submissions resolve to the original reference; a changed payload under the same key is refused. Limits: 3 per network per hour, 50 per day.
- The network hash is cleared when the application is exported. No public page, sitemap or API returns application data.

## Storage and memory limits

| Limit | Value | Where |
|---|---|---|
| Photo size accepted by the server | 3 MB | `MAX_PHOTO_BYTES` |
| Request body | 3 MB + 64 KB, read as a stream and stopped once passed | `MAX_APPLICATION_BODY`, `limitedBody` in the route |
| Photos held on the site, all applications | 100 MB; over it, the application is saved without the photo, `details.photo_not_stored = "storage_full"`, and the confirmation says so | `MAX_STORED_PHOTO_BYTES` |
| Uploads parsed at once | 3 per process, 1 per network address; others get 503 `busy` | route |
| Attempts | 6 per network per hour (before the body is read); 3 saved per network per hour, 50 per day | route, `saveArtistApplication` |
| Exported site copy | photo deleted at acknowledgement; row deleted 30 days after export | `acknowledgeArtistApplication`, `purgeExportedApplications` |
| Uncollected application | deleted 30 days after it was sent | `purgeExportedApplications` |

The route checks origin, content type, declared length, the rate limit, the open/closed gate (cached for one minute) and the concurrency slot before it reads any of the body.

The purge runs from three places: the export script, the nightly Render cron (`/api/cron/margin-guardrail`, before its retired-assistant return) and, at most once an hour, the public upload route. Deletion therefore continues if the Mac-side export stops.

`proxy.ts` runs on `/api/*`, and Next buffers proxied request bodies only up to 10 MB (`proxyClientMaxBodySize`), so the body limit must stay under 10 MB.

## Endpoints (Bearer `AGENCY_INQUIRY_TOKEN`)

| Method and path | Purpose |
|---|---|
| `GET /api/agency/applications` | Up to 25 pending applications, photo metadata only |
| `GET /api/agency/applications/:id/photo` | Photo bytes, `X-Content-SHA256` header |
| `POST /api/agency/applications/:id/ack` | `{ "exportReference": "talent-inbox:<id>" }`; idempotent |
| `POST /api/agency/applications/heartbeat` | Keeps `/join` open |
| `POST /api/agency/applications/purge` | Deletes site copies exported more than 30 days ago |

## Release

Apply migration `20261110090000_artist_applications` (additive: two new tables), deploy, then run the export script once so `/join` opens. Tests: `tests/agency-applications.test.tsx`, `tests/agency-applications.integration.ts` and `team/web/test_application_export.py`.

## Public profile consent (since 13 November 2026)

The roster on `/artists` is a catalogue buyers choose from. An applicant is listed only with written consent, so `/join` has a separate, optional box (`consent_listing`, unchecked by default, not required to submit). The wording and its version live in `lib/agency/listing-consent.ts`; change the version whenever either wording changes.

- `ArtistApplication.listingConsent` (false unless ticked), `listingConsentAt` (submission time) and `listingConsentVersion` (wording shown, `listing-v1-2026-11-13`) are stored for every new application. Older rows have false and no timestamp.
- The export returns all three fields, `application_export.py` writes them into each inbox record, and its receipt counts `listing_consented`.
- The required data consent now says nothing is published unless the box is ticked, and that Bright Ears sends the artist the profile to check before it goes live. Whoever builds the profile must do that check before making it visible.
