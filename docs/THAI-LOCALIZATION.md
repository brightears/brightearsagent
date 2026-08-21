# Thai localization

Verified: 2026-08-21

## Scope

Bright Ears supports English (`en`) and Thai (`th`) as first-class product locales. The Thai beta journey covers:

- marketing home and pricing;
- Clerk sign-in/sign-up UI;
- onboarding and forwarding instructions;
- dashboard navigation, pipeline, Hunt, venue follow-up, results, calendar, packages, spam review, lead detail, reply/pitch approval, booking outcomes, and Control room;
- push/install prompts and owner-facing validation/error states;
- public artist EPK and availability form;
- owner push/email notifications, weekly reports, monthly ROI receipts, venue-fit explanations, and deterministic booking confirmations for Thai-language inquiries.

Secondary public editorial/SEO pages (story, comparisons, roadmap, and free tools) remain English reference content and display a Thai notice. Legal documents remain the reviewed English controlling text and display a stronger Thai language notice. Do not present an unreviewed machine translation as binding legal copy.

## Locale selection and persistence

The locale is resolved in this order:

1. `be_locale` secure, HTTP-only, same-site cookie;
2. the browser `Accept-Language` header (`th` and regional Thai tags select Thai);
3. English fallback.

The visible `ไทย` / `EN` switch posts to the server action in `app/actions/locale.ts`. For signed-in users the action also persists `Business.locale`, which lets background jobs use the same language when there is no browser request. Onboarding also persists the active locale so a Thai browser does not need an explicit switch click before reports and notifications become Thai.

URLs are not locale-prefixed. This deliberately preserves existing OAuth callbacks, webhooks, deep links, SEO routes, and bookmarks.

## Translation architecture

- `lib/i18n/config.ts`: supported locales, cookie name, negotiation, formatting tags.
- `lib/i18n/messages.ts`: flat, typed English source dictionary and Thai dictionary. `Record<MessageKey, string>` makes missing/extra Thai keys a TypeScript error.
- `lib/i18n/server.ts`: server request locale and translator.
- `components/locale-provider.tsx`: client translator context.
- `components/language-switcher.tsx`: locale control.
- `@clerk/localizations/th-TH`: Clerk's official Thai localization.
- `Business.locale`: persisted owner/background-job locale.

Dates and numbers use `th-TH` or `en-US` formatting. Fee currency remains the business currency; a Thailand business defaults to THB. Thai onboarding also adds `th` to `pitchLanguages` without removing an existing language.

## AI and outbound-language behavior

UI locale and recipient language are separate concerns:

- owner UI, owner notifications, and reports follow `Business.locale`;
- reply drafts must follow the language in the client's latest message;
- Thai venue pitches are supported, remain manual-review-only, and never auto-send;
- deterministic booking confirmations use Thai when the underlying inquiry is Thai;
- English remains the safe fallback when language cannot be established.

The Gmail boundary is unchanged: Bright Ears requests only `gmail.send` plus identity scopes, never reads/lists/imports Gmail, and never sends connected Google email addresses, OAuth tokens, or Gmail message IDs to OpenRouter.

## Adding another locale

1. Add the locale to `SUPPORTED_LOCALES` and `languageTag`.
2. Add a dictionary typed as `Record<MessageKey, string>`.
3. Add the appropriate official Clerk localization when available.
4. Localize background notifications and report renderers, not only React pages.
5. Add browser-negotiation, translation, outbound-language, and rendering tests.
6. Obtain qualified review before publishing translated legal documents.

## Verification

Use Node 22:

```sh
PATH=/opt/homebrew/opt/node@22/bin:$PATH npx tsc --noEmit
PATH=/opt/homebrew/opt/node@22/bin:$PATH npm run lint
PATH=/opt/homebrew/opt/node@22/bin:$PATH npm test
PATH=/opt/homebrew/opt/node@22/bin:$PATH npm run build
```

Manual QA should cover both `ไทย` and `EN` at desktop and mobile widths, switching mid-onboarding, refreshing after a switch, signed-in persistence, Thai EPK form validation, Gmail consent disclosure, and a Thai inquiry draft. Never send a live email as part of localization QA without action-time approval.
