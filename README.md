# Bright Ears

Agency website at https://brightears.io with existing assistant account access preserved. Start with [the current direction](docs/AGENCY-RESTORATION.md) and [deployment instructions](docs/DEPLOYMENT.md). Historical SaaS growth work is paused.

## Development

Use the Node version in `.node-version`. Install with `npm ci` and a local `DATABASE_URL` for Prisma generation; then run `npm run dev`. Run `npm test`, `npx tsc --noEmit`, `npm run lint` and `npm run build` before a release. Never use a production database for local development or `prisma db push` for deployment.
