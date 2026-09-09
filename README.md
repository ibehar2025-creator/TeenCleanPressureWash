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
4. Initialize the empty database with `node --env-file=.env server/migrate.mjs`.
5. Run `npm run build`, then `node --env-file=.env server/index.mjs`. Open `http://localhost:4173`. No Google login or signup code is required by default.

Without a database, the application opens an empty starter dashboard. Refresh explicitly reports that database setup is needed. Once the database is configured and initialized, it opens directly to real records without login. It does not connect to another business as a fallback.

**Access warning:** login is off by default at the owner's request. Anyone who reaches the deployed URL can view customer information and create, edit or delete business records, including spreadsheet-backed jobs. Notifications share one workspace inbox; they are not private per person. Keep credentials server-side and consider network-level access restrictions before using real customer data.

To restore Google login later, set `REQUIRE_LOGIN=true`, configure `GOOGLE_CLIENT_ID` with the website origin authorized, and set a private `AUTH_OWNER_CODE`. Redeploy, then register the owner. In no-login mode, a non-person shared database identity supports notification/audit references; it has no personal profile or sign-out/delete-account controls.

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
node --test tests/isolation.test.mjs tests/solo-owner.test.mjs tests/sheets-connector.test.mjs tests/open-workspace.test.mjs
```

`src/data/googleSheetData.ts` contains only empty collections and new-business defaults. Optional integration values are blank in `.env.example`. Credentials, historical customer records, and the source business's Git history are excluded.
