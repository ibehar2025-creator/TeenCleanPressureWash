# TeenCleanPressureWash

An independent pressure-washing business dashboard with fresh Git history and no preloaded business records. No database, spreadsheet, login account, API key, billing account, or hosting service is connected by default.

## Included

- Owner dashboard and analytics; job creation, editing, calendar events, and recurring service plans.
- Leads, follow-up reminders, personal notification inboxes, and job/solicitation maps.
- Employee workspace, job assignments, contract generation and signatures, upsells, and earnings approval.
- Contractor pay tracking and exports. This records internal payments; it does not run payroll or file taxes.
- Google sign-in, owner/employee access controls, mobile layouts, and installable app support.

## First setup

1. Install Node.js 22 or newer and run `npm ci`.
2. Create a new Postgres database (a separate Supabase project is supported). Do not point this application at an existing business's database.
3. Create `.env` from `.env.example` and enter the new database connection string in `DATABASE_URL`. Do not commit `.env`.
4. Create a Google OAuth web client for this business. Add `http://localhost:4173` and the eventual deployed origin to its authorized JavaScript origins, then set `GOOGLE_CLIENT_ID`.
5. Set distinct, random `AUTH_OWNER_CODE` and `AUTH_EMPLOYEE_CODE` values. Share the owner code only with the business owner. No previous accounts or access codes are included.
6. Initialize the empty database with `node --env-file=.env server/migrate.mjs`.
7. Run `npm run build`, then `node --env-file=.env server/index.mjs`. Open `http://localhost:4173` and register the first owner using Google and the owner code.

Before database and sign-in configuration, the application opens directly to an empty starter dashboard without a Google sign-in screen. You can browse the layout; saving records requires completing the setup above. No business API requests are made in starter mode. After configuration, account sign-in protects real records. It does not connect to another business as a fallback.

## Optional Google Sheets

Leave `SHEETS_SYNC_URL` blank to use the website with its own database only. Job creation, editing, earnings approval, and other database workflows do not require a spreadsheet. The refresh button reloads database records when no spreadsheet is configured.

To enable spreadsheets later, create a separate spreadsheet and a compatible sync endpoint. Set the server-only `SHEETS_SYNC_URL` to that endpoint, and `VITE_JOBS_SHEET_URL` to the new spreadsheet's browser URL. Rebuild after changing a `VITE_` variable. The endpoint URL is not a normal spreadsheet sharing link.

The server expects GET to return collections such as `customers`, `jobs`, `leads`, `invoices`, `servicePlans`, and `reviews`, with stable unique IDs matching `src/types/business.ts`. POST accepts `{ action, row }`; supported callers are listed in `server/index.mjs` under `runSheetAction` (customer/lead creation, job creation/update/deletion, and recurring jobs/service plans). The endpoint must return `{ ok: true }` on successful writes and report failures explicitly. No Apps Script deployment or external integration code is included.

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
node --test tests/isolation.test.mjs
```

`src/data/googleSheetData.ts` contains only empty collections and new-business defaults. Optional integration values are blank in `.env.example`. Credentials, historical customer records, and the source business's Git history are excluded.
