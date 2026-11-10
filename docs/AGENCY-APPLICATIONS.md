# Artist applications (/join)

10 November 2026. Field list, values and consent text come from the Talent desk spec, `team/talent/application-form-spec.md` (v1) under the records root.

## Flow

1. A visitor submits `/join` (English or Thai). The browser posts `multipart/form-data` to `POST /api/agency/applications`: a `payload` JSON field and an optional `photo`.
2. The server validates the payload (`lib/agency/application-contract.ts`), sniffs the photo bytes (JPG, PNG or WebP, at most 8 MB), and saves an `ArtistApplication` row plus an optional `ArtistApplicationPhoto` row in Postgres. Photos never go to the public R2 bucket.
3. The Talent desk runs `team/web/application_export.py` under the records root. It reads pending applications with the Mac-side `AGENCY_INQUIRY_TOKEN`, writes each one and its photo to `team/talent/inbox/` (0600 files, 0700 folders), acknowledges it, records the `agency:application-export` heartbeat and purges site copies exported more than 30 days ago.

Applications never enter `/api/agency/inquiries`, so the hourly Vinyl enquiry worker is unchanged. Nothing is sent to the applicant beyond the on-screen confirmation.

## Rules the code enforces

- No field for ID, passport, bank, date of birth, address or work-permit documents. A 13-digit number starting 1–8 (Thai ID pattern) in any free-text field is refused with a field message.
- At least one of email, LINE ID or phone; one https link; both consent boxes.
- `/join` accepts submissions only while the export heartbeat is under 8 days old, so nobody applies into an unread queue. Before the first export run it answers 503 and the page offers LINE.
- Duplicate submissions resolve to the original reference; a changed payload under the same key is refused. Limits: 3 per network per hour, 50 per day.
- The network hash is cleared when the application is exported. No public page, sitemap or API returns application data.

## Why 8 MB, not 10 MB

`proxy.ts` runs on `/api/*`, and Next buffers proxied request bodies only up to 10 MB (`proxyClientMaxBodySize`). A larger multipart body would arrive truncated. The cap keeps photo plus payload under that limit.

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
