# Catalogue profiles

16 November 2026. How an artist who applied through `/join` gets a public profile on `/artists` without an entry in Vinyl's artist records or booking system.

## Rules the code enforces

- **No consent, no profile.** The site creates a profile only from an application that is still on the site (up to 30 days after export) with the profile box ticked. It copies the consent version and time into the profile, privately.
- **Nothing private is public.** Pages read only the public columns (`PUBLIC_SELECT` in `lib/agency/catalogue.ts`): name, act label, act tags, bio, genres, where the artist is based, links, photo and photo credit, and the played marker. Fees, contact details, legal names, right-to-work answers and consent records are never copied into a profile. Text that looks like an email, phone number, LINE ID, Thai ID number or fee is refused.
- **Links** go only to the artist's own Instagram, Facebook, TikTok, YouTube, SoundCloud, Mixcloud or Spotify page.
- **Photo** is the artist's own upload. The desk script sends the photo file from the Talent inbox and checks its SHA-256 against the exported record first.
- **Preview links** are random (24 bytes) and stored only as a hash. The page carries `noindex` and `no-referrer`, and `/artists/preview/` is disallowed in `robots.txt`. A new link replaces the old one. Removed profiles have no preview.
- **Publishing** needs the artist's confirmation on record: where and when they said OK.
- **Unpublishing** takes the profile, its photo and its preview off the site on the next request. Pages and photos are not cached.
- Every desk action is logged in `CatalogueProfileEvent` on the site and in `team/talent/catalogue/actions.jsonl` on the Mac.

## Desk steps (from the records root)

All commands use the export credential in `~/.config/brightears/inquiry-worker.json`.

1. **Draft.** `python3 team/web/catalogue_profile.py draft <application-id>` writes `team/talent/catalogue/<slug>.json` with public fields only. Edit it: the act label in English and Thai, act tags (`dj`, `sax`, `piano`, `guitar`, `violin`, `percussion`, `vocals`, `band`, `mc`, `musician`), a bio of at least 40 characters in English (Thai optional, marked for a native read), genre names, links, photo credit, and `playedForBrightEars` only if Vinyl's records show a set.
2. **Create and preview.** `python3 team/web/catalogue_profile.py create team/talent/catalogue/<slug>.json` uploads the draft and the photo and prints the private preview link. It is also saved in `team/talent/catalogue/previews.json` (0600). Send the link to the artist and ask "OK to publish?". Run `create` again after any change; to change the text only, add `--no-photo`. `preview <slug>` issues a fresh link.
3. **Publish.** `python3 team/web/catalogue_profile.py publish <slug> --confirmed "Instagram 16 Nov 14:02: OK to publish"`.
4. **Remove.** `python3 team/web/catalogue_profile.py unpublish <slug> --reason "..."` takes it off at once. Use `delete <slug> --reason "..."` when the artist asks for the data to be deleted too.
5. **Check.** `python3 team/web/catalogue_profile.py list` shows every profile and the latest actions.

If you edit a published profile, send the artist the preview link again; the text changes on the site as soon as you run `create`.

## API (Bearer `AGENCY_INQUIRY_TOKEN`)

| Method and path | Purpose |
|---|---|
| `GET /api/agency/catalogue` | All profiles (no photo, no token) and the last 50 actions |
| `POST /api/agency/catalogue` | Create or update a draft: multipart `payload` (JSON) and `photo` |
| `POST /api/agency/catalogue/:slug` | `{"action":"preview"}`, `{"action":"publish","confirmation":"..."}` or `{"action":"unpublish","reason":"..."}` |
| `DELETE /api/agency/catalogue/:slug` | Delete the profile and photo; `{"reason":"..."}` is logged |

Public, no credential: `GET /api/agency/catalogue/photo/:slug` (published only) and `GET /api/agency/catalogue/preview/:token/photo` (draft or published).

## On /artists

Roster artists from Vinyl's records come first, then published catalogue profiles; a catalogue profile never replaces a roster artist with the same id. Buyers can filter by act tag and by where the artist is based. Both filters appear once there is more than one value. "Has played for Bright Ears" shows for catalogue profiles with `playedForBrightEars` and for roster artists listed in `lib/agency/roster-presentation.json` `playedArtistIds`. That list was taken from sets recorded in Vinyl's brief between 12 and 16 November 2026, and Vinyl should confirm it. Catalogue artists have no promotion kit.
