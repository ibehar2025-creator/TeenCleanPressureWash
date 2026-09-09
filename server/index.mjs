import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const collections = { customers: 'customers', jobs: 'jobs', leads: 'leads', 'service-plans': 'servicePlans', 'calendar-events': 'calendarEvents' };
const workspaceUser = { id: 'teenclean-workspace', name: 'TeenCleanPressureWash', email: '', phone: '', pictureUrl: '', age: 0, role: 'owner', sharedWorkspace: true };

export function createApp({ syncUrl = process.env.SHEETS_SYNC_URL, syncToken = process.env.SHEETS_SYNC_TOKEN, fetcher = fetch } = {}) {
  const app = express();
  const configured = Boolean(syncUrl && syncToken);
  let pendingRead = null;
  app.use(express.json({ limit: '100kb' }));
  app.use('/api', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });

  async function connector(action, row) {
    if (!configured) throw Object.assign(new Error('Set SHEETS_SYNC_URL and SHEETS_SYNC_TOKEN in Render to connect your spreadsheet.'), { status: 503 });
    const url = new URL(syncUrl);
    url.searchParams.set('syncToken', syncToken);
    let response;
    try {
      response = await fetcher(url.toString(), { signal: AbortSignal.timeout(45000), ...(action ? {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, row }),
      } : {}) });
    } catch { throw new Error('Google Sheets could not be reached. Retry Refresh before repeating an uncertain save.'); }
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload || payload.ok !== true) throw new Error(payload?.error || 'Google Sheets did not confirm the request. Check the Apps Script deployment and token.');
    if (payload.connector !== 'teenclean-v2') throw new Error('Update Code.gs and deploy a new Apps Script version. This site needs the sheets-only connector (v2).');
    return payload;
  }

  async function snapshot() {
    // Coalesce simultaneous reads; nothing is saved on the web server.
    if (!pendingRead) pendingRead = connector().then(data => {
      for (const key of ['jobs', 'customers', 'leads', 'servicePlans', 'calendarEvents']) {
        if (!Array.isArray(data[key])) throw new Error(`Incomplete spreadsheet response: ${key}.`);
      }
      return data;
    }).finally(() => { pendingRead = null; });
    return pendingRead;
  }

  app.get('/api/health', (_req, res) => res.json({ ok: true, storage: 'google-sheets', sheetsConfigured: configured }));
  app.get('/api/auth/config', (_req, res) => res.json({ enabled: true, loginRequired: false, clientId: '', state: '', signupCodeRequired: false }));
  app.get('/api/auth/session', (_req, res) => res.json({ user: workspaceUser }));
  app.get('/api/bootstrap', async (_req, res) => res.json(await snapshot()));
  app.post('/api/sync-sheets', async (_req, res) => res.json(await snapshot()));
  app.get('/api/notifications/read', async (_req, res) => res.json({ readKeys: (await snapshot()).readKeys || [] }));
  app.post('/api/notifications/read', async (req, res) => {
    if (!Array.isArray(req.body.keys) || req.body.keys.length > 500 || req.body.keys.some(k => typeof k !== 'string' || k.length > 4000)) return res.status(400).json({ error: 'Invalid notification keys.' });
    res.json((await connector('workspaceWrite', { collection: 'notifications', operation: 'markRead', keys: req.body.keys })).result);
  });
  for (const [route, collection] of Object.entries(collections)) {
    app.post(`/api/${route}`, async (req, res) => {
      const result = await connector('workspaceWrite', { collection, operation: 'create', id: `${collection}-${randomUUID()}`, data: req.body });
      res.status(201).json(result.result);
    });
    app.patch(`/api/${route}/:id`, async (req, res) => {
      res.json((await connector('workspaceWrite', { collection, operation: 'update', id: req.params.id, data: req.body })).result);
    });
    if (['jobs', 'leads', 'calendarEvents'].includes(collection)) app.delete(`/api/${route}/:id`, async (req, res) => {
      res.json((await connector('workspaceWrite', { collection, operation: 'delete', id: req.params.id })).result);
    });
  }
  app.use('/api', (_req, res) => res.status(404).json({ error: 'This feature is not available in the sheets-only workspace.' }));
  app.use(express.static(path.join(root, 'dist')));
  app.get(/.*/, (_req, res) => res.sendFile(path.join(root, 'dist/index.html')));
  app.use((error, _req, res, _next) => res.status(error.status || 502).json({ error: error.message || 'Spreadsheet request failed.' }));
  return app;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4173);
  createApp().listen(port, '0.0.0.0', () => console.log(`TeenCleanPressureWash sheets-only dashboard listening on ${port}`));
}
