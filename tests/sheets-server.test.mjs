import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { once } from 'node:events';
import { createApp } from '../server/index.mjs';

async function serve(t, options) {
  const server = createApp(options).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  return `http://127.0.0.1:${server.address().port}`;
}
const snapshot = { ok: true, connector: 'teenclean-v2', jobs: [{ id: 'tc-job-1', price: 60 }], customers: [], leads: [], calendarEvents: [], servicePlans: [], readKeys: [] };

test('reads directly from connector and forwards writes with private server-side token', async t => {
  const requests = [];
  const url = await serve(t, { syncUrl: 'https://example.invalid/exec', syncToken: 'test-secret', fetcher: async (url, options) => {
    requests.push({ url, options });
    return { ok: true, json: async () => options.method === 'POST' ? { ok: true, connector: 'teenclean-v2', result: { id: 'lead-test', name: 'New lead' } } : snapshot };
  } });
  for (const path of ['/api/bootstrap', '/api/sync-sheets']) {
    const response = await fetch(url + path, { method: path.endsWith('sync-sheets') ? 'POST' : 'GET' });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).jobs[0].price, 60);
  }
  const response = await fetch(url + '/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'New lead' }) });
  assert.equal(response.status, 201);
  assert.equal((await response.json()).id, 'lead-test');
  assert.equal(new URL(requests[0].url).searchParams.get('syncToken'), 'test-secret');
  const sent = JSON.parse(requests.at(-1).options.body);
  assert.equal(sent.action, 'workspaceWrite');
  assert.equal(sent.row.collection, 'leads');
  assert.equal(sent.row.operation, 'create');
  assert.equal((await (await fetch(url + '/api/auth/config')).json()).loginRequired, false);
});

test('missing setup and old connector show errors rather than empty success', async t => {
  const missing = await serve(t, { syncUrl: '', syncToken: '' });
  let response = await fetch(missing + '/api/bootstrap');
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /SHEETS_SYNC_URL/);
  const old = await serve(t, { syncUrl: 'https://example.invalid/exec', syncToken: 'test', fetcher: async () => ({ ok: true, json: async () => ({ ...snapshot, connector: 'teenclean-v1' }) }) });
  response = await fetch(old + '/api/bootstrap');
  assert.equal(response.status, 502);
  assert.match((await response.json()).error, /Update Code.gs/);
});

test('map is available without database or account mutation endpoints', async t => {
  const url = await serve(t, { syncUrl: '', syncToken: '' });
  for (const path of ['/api/auth/register', '/api/auth/account', '/api/solicitations', '/api/owner/operations']) {
    assert.equal((await fetch(url + path, { method: 'POST' })).status, 404);
  }
  const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url)));
  assert.equal(pkg.dependencies.pg, undefined);
  assert.ok(pkg.dependencies['@vis.gl/react-google-maps']);
  const app = fs.readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.match(app, /id: "map"/);
  const map = fs.readFileSync(new URL('../src/components/BusinessMap.tsx', import.meta.url), 'utf8');
  assert.match(map, /getCurrentPosition/);
  assert.doesNotMatch(map, /watchPosition|\/api\/solicitations/);
});
