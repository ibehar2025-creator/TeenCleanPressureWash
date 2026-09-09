# TeenCleanPressureWash

An independent pressure-washing business dashboard with fresh Git history and no preloaded business records. No database, spreadsheet, login account, API key, billing account, or hosting service is connected by default.

## Included

- Owner dashboard and analytics; job creation, editing, calendar events, and recurring service plans.
- Leads, follow-up reminders, personal notification inboxes, and job/solicitation maps.
- Solo-owner workspace, optional Google sign-in, mobile layouts, and installable app support.

## First setup

1. Install Node.js 22 or newer and run `npm ci`.
2. Create a new Postgres database (a separate Supabase project is supported). Do not point this application at an existing business's database.
3. Create `.env` from `.env.example` and enter the new database connection string in `DATABASE_URL`. Do not commit `.env`.
4. Create a Google OAuth web client for this business. Add `http://localhost:4173` and the eventual deployed origin to its authorized JavaScript origins, then set `GOOGLE_CLIENT_ID`.
5. Set a random `AUTH_OWNER_CODE`. Share this code only with the business owner. Signup supports owner accounts only. No previous accounts or access codes are included.
6. Initialize the empty database with `node --env-file=.env server/migrate.mjs`.
7. Run `npm run build`, then `node --env-file=.env server/index.mjs`. Open `http://localhost:4173` and register the first owner using Google and the owner code.

Before database and sign-in configuration, the application opens directly to an empty starter dashboard without a Google sign-in screen. You can browse the layout; saving records requires completing the setup above. No business API requests are made in starter mode. After configuration, account sign-in protects real records. It does not connect to another business as a fallback.

## Optional Google Sheets

Leave `SHEETS_SYNC_URL` blank to use the website with its own database only. Job creation, editing, and other database workflows do not require a spreadsheet. The refresh button reloads database records when no spreadsheet is configured.

The included [Apps Script connector and setup guide](google-sheets/SETUP.md) supports the existing `Sheet1` customer/jobs layout. Deploy it from the friend's spreadsheet, then configure server-only `SHEETS_SYNC_URL` and `SHEETS_SYNC_TOKEN`, plus `VITE_JOBS_SHEET_URL` for the browser link. Rebuild after changing a `VITE_` variable. The sync endpoint is not a normal spreadsheet sharing link.

GET must return `customers` and `jobs` arrays with stable unique IDs matching `src/types/business.ts`; other collections are optional. POST accepts `{ action, row }` and must return `{ ok: true }` on successful writes. The supplied connector syncs jobs and customer data; leads and recurring-plan details remain database-backed. TBD jobs remain undated, and spreadsheet total/placeholder rows are excluded. Deployment and Google authorization must be completed by the spreadsheet owner.

## Optional maps

Provide `VITE_GOOGLE_MAPS_API_KEY` from this business's own Google Cloud project to enable the existing Google Maps features. Restrict it to the new site's domains and required Maps APIs. This repository creates no Google billing account or paid services.

## Hosting

Create a separate Node web service connected to this repository. Build with `npm ci && npm run build`, initialize the new database with `npm run db:migrate` once, and start with `npm start`. Configure the environment variables from `.env.example` on the new service. Use `NODE_ENV=production` for hosting. The server honors the provider's `PORT` and exposes `/api/health`.

For Supabase, run the migration using a trusted server database connection. Browser requests go through the Express API, not directly to database tables. Keep database credentials server-side; do not enable public table access for the browser.

Update the OAuth authorized origin and Maps key restrictions for the deployed URL. Installable app features require HTTPS outside localhost. No hosting deployment is created by cloning this repo.

## Checks

```sh
npm run build
npm run lint
node --check server/index.mjs
node --test tests/isolation.test.mjs tests/solo-owner.test.mjs tests/sheets-connector.test.mjs
```

`src/data/googleSheetData.ts` contains only empty collections and new-business defaults. Optional integration values are blank in `.env.example`. Credentials, historical customer records, and the source business's Git history are excluded.
