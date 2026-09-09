# TeenCleanPressureWash

Google Sheets is the only persistent business-data store. No Supabase/Postgres database, Google login, employee features or Maps integration is required or included in the running site.

## Connect the existing spreadsheet

1. Back up the spreadsheet.
2. Update its bound Apps Script with [google-sheets/Code.gs](google-sheets/Code.gs). Run `setupTeenClean` if it has not been run before.
3. Deploy a **new version** of the web app: execute as the sheet owner, access Anyone. Keep the spreadsheet private; every connector request requires a private token.
4. In this site's Render Environment settings, set `SHEETS_SYNC_URL` to the `/exec` deployment URL and `SHEETS_SYNC_TOKEN` to the script's private `SYNC_TOKEN`. Set `VITE_JOBS_SHEET_URL` to the spreadsheet's ordinary browser URL.
5. Build with `npm ci && npm run build`, start with `npm start`. Remove any old database migration or seed pre-deploy command. Rebuild after changing `VITE_JOBS_SHEET_URL`.
6. Open the site and click **Refresh**. Jobs are fetched directly from the connector. An old script version, missing configuration or Google error now produces an explicit error rather than empty success.

See [the detailed guide](google-sheets/SETUP.md) for Google deployment screens. No new token or deployment URL is needed when updating an existing deployment version.

## What is stored where

- `Sheet1`: jobs, customer names, phone numbers, addresses, dates, prices, statuses and job notes. Existing columns and totals are preserved; blank placeholders and totals are not imported as jobs.
- `_TeenCleanSync` hidden helper tab: job IDs/times, customer details, leads, calendar events, recurring service plans and notification read state. These records are JSON rows managed by the website. Edit these extra records through the site, not by changing the helper JSON.
- Dashboard and analytics: calculated from the fetched records. There is no second copy in a database or bundled customer-data file.
- No offline saving: if Sheets cannot confirm a write, the site reports an error. Check Refresh before repeating a save whose outcome is uncertain. Backups remain important; a multi-cell Sheets write is not an atomic transaction.

Map and solicitation tracking have been removed. Imported notes mentioning recurrence are not automatically turned into service plans; create plans through the website. Existing records in an unrelated database are not migrated or deleted by this change.

## Access and credentials

This site has no login at the owner's request. **Anyone with the URL can view and change business records, including deleting jobs.** Notifications use one shared inbox. The connector token stays on the server and protects the raw Apps Script endpoint, not access to the public website.

Only the three Sheets variables above are used. Remove obsolete `DATABASE_URL`, Google login/code variables and `VITE_GOOGLE_MAPS_API_KEY` from this Render service. Removing the Maps code prevents this site from loading the Maps API; it does not cancel an existing Google billing account or erase previous charges. Do not disable anything belonging to the original business.

## Local development and verification

Node.js 22+ is supported. Install with `npm ci`; use a private `.env` based on `.env.example`, then run `npm run build` and `node --env-file=.env server/index.mjs`. The site opens at `http://localhost:4173`.

```sh
npm run build
npm run lint
node --check server/index.mjs
node --test tests/isolation.test.mjs tests/sheets-connector.test.mjs tests/sheets-server.test.mjs
```

Automated tests use synthetic records, including two-way job changes, retained totals, TBD dates, recurring jobs, leads, events, notification state, missing configuration and connector-version errors. Live Apps Script authorization/deployment is performed by the sheet owner.
