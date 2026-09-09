# Connect the customer spreadsheet

This connector is for TeenCleanPressureWash's existing `Sheet1`, not another business's spreadsheet. It is prepared in the repository but is not connected until the owner completes the steps below. No live rows or deployment settings were changed while preparing it.

## 1. Install the script in the sheet

1. Make a backup copy of the spreadsheet before enabling writes.
2. In the original spreadsheet, open **Extensions > Apps Script** using the Google account that owns it.
3. Open `Code.gs`. For a new script project, replace the default sample with this folder's `Code.gs` and save. If there is already custom code, preserve it and check for conflicting `doGet`/`doPost` functions first.
4. Select `setupTeenClean` in the function selector and click **Run**. Review and authorize the script using the sheet owner's account. It reads the sheet to validate headers and stores its ID plus a random sync token in Script Properties.
5. Open **Project Settings > Script properties**. Keep the value of `SYNC_TOKEN` private. You will enter it into Render in step 3. Do not paste it into chat, GitHub, or any `VITE_` variable.

## 2. Deploy the connector

1. Choose **Deploy > New deployment > Web app**.
2. Set **Execute as: Me**, with the sheet owner's account.
3. Set **Who has access: Anyone**. The script still requires the private sync token before accessing any spreadsheet data. If an organization policy prevents this option, ask the account administrator or use the owner's permitted account; do not make the spreadsheet public.
4. Deploy and authorize when prompted. Copy the **Web app URL**, ending in `/exec`, not the editor URL or a `/dev` testing URL.

For later code changes, save and use **Deploy > Manage deployments > Edit > New version > Deploy**. Saving code alone does not update the deployed version.

## 3. Configure the friend's Render service

Only edit the Render service connected to the TeenCleanPressureWash repo.

| Environment variable | Value |
| --- | --- |
| `SHEETS_SYNC_URL` | The Apps Script web app `/exec` URL |
| `SHEETS_SYNC_TOKEN` | The private `SYNC_TOKEN` from Script Properties |
| `VITE_JOBS_SHEET_URL` | The normal Google Sheets browser link |

Save and rebuild/redeploy, since `VITE_JOBS_SHEET_URL` is baked into the frontend. The URL and token for syncing stay server-side. Do not use `VITE_SHEETS_SYNC_URL`.

Real saving also requires the friend's own database and owner authentication setup in the main README: `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `AUTH_OWNER_CODE`, and the database migration. The empty starter dashboard is a preview and cannot save or import real records. No existing business's credentials should be reused.

## 4. Verify

1. Sign in as the owner and click **Sync sheets**.
2. Check several jobs against the spreadsheet, including a Finished job and a TBD-date job. Totals and placeholder rows should not appear as jobs.
3. Add a clearly labeled test job on the website. Confirm it appears once in Sheet1, before the total row, and the total formula includes it.
4. Edit its notes, price and status on the website. Confirm those cells change in Sheets. Change a note in Sheets and click **Sync sheets** to confirm the reverse direction.
5. Refresh the page to verify database persistence. Then remove the test job through the website and verify its sheet fields are cleared.

Automatic refresh uses the server's existing 30-minute stale-data interval when the application requests a refresh. This is not a standalone background scheduler. Use **Sync sheets** for an immediate pull.

## Supported layout and behavior

Keep the tab named `Sheet1`. Headers are matched by name, so column order can change:

`Job number | Date | Costumer | Address | Phone number | Job description | Notes | Status | Amount made`

- `Customer` is also accepted instead of `Costumer`.
- Job numbers must be positive, unique, permanent identifiers. Sorting rows is safe; renumbering jobs is not. Do not copy an existing job number into a new row.
- Finished/Complete/Completed becomes completed on the website; website completion writes `Finished`. TBD becomes scheduled; date `TBD` stays undated, not overdue or on the calendar.
- Empty placeholder rows and the total row are not imported. Invalid dates/statuses or duplicate job numbers stop the sync instead of overwriting records with incomplete data.
- Existing jobs without times are not given invented appointment times. Website times, stable website IDs, and extra metadata are stored in a hidden `_TeenCleanSync` tab created on the first website write. Do not delete it. Add an optional `Time` column to Sheet1 to view/edit appointment times there instead.
- Website job creation, editing and deletion update Sheet1. New jobs are inserted before the total, not automatically date-sorted. Deletion clears job fields but keeps the number reserved and preserves other rows and charts. Backups are still important: Sheets and the database are separate systems, not one atomic transaction.
- Repeated customer names at the same address are grouped on import. New customers are kept in the helper tab until a job creates their visible Sheet1 row.
- This sheet has no leads or recurring-plan table. Leads and service-plan details stay in the database. Creating a recurring job adds its job to Sheet1, but its renewal schedule is database-only. Free-text recurrence in a job description is not automatically converted into a service plan.
- The spreadsheet is authoritative for imported job fields at the next successful sync. Avoid simultaneous edits to the same job in both places.

## Troubleshooting

- **Unauthorized sync request:** the Render token must exactly match the script's `SYNC_TOKEN`.
- **HTML, Google sign-in page, or invalid spreadsheet response:** verify `/exec`, access setting, execution account, and deployed version. Do not publish the spreadsheet to the web as a workaround.
- **Missing/duplicate job number:** correct that row's unique identifier before retrying. Do not renumber all jobs.
- **Missing column / Sheet1:** restore the expected header/tab name or adapt the script deliberately.
- **Starter workspace:** database and authentication setup is still incomplete.

This setup creates no paid services or billing subscriptions. Existing hosting/database plans and Google service quotas still apply.
