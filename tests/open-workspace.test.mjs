import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../server/index.mjs', import.meta.url), 'utf8');
const tree = ts.createSourceFile('server.mjs', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const fn = name => tree.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name).getText(tree);
const actor = { id: 'shared-test-id', role: 'owner', active: true };

test('open workspace does not need cookies, Google configuration or an access code', async () => {
  const session = vm.runInNewContext(`${fn('sessionUser')}; sessionUser`, { loginRequired: false, workspaceUser: actor });
  assert.equal(await session({ headers: {} }), actor);
  let passed = false;
  const authorize = vm.runInNewContext(`${fn('requireAuth')}; requireAuth`, { pool: {}, sessionUser: session });
  const req = {};
  await authorize(req, {}, () => { passed = true; });
  assert.equal(passed, true);
  assert.equal(req.authUser.id, actor.id);
});

test('optional login mode still rejects unsigned requests', async () => {
  const session = vm.runInNewContext(`${fn('sessionUser')}; sessionUser`, {
    loginRequired: true, pool: {}, parseCookies: () => ({}), sessionCookieName: 'session', workspaceUser: actor,
  });
  assert.equal(await session({}), null);
});

test('shared identity initializes once without creating a Google login or making up an age', async () => {
  const queries = [];
  const context = vm.createContext({ loginRequired: false, workspaceSubject: 'test-shared-workspace', workspaceUser: null,
    pool: { query: async (sql, values) => { queries.push({ sql, values }); return { rows: sql.startsWith('select') ? [actor] : [] }; } },
  });
  vm.runInContext(fn('initializeWorkspaceUser'), context);
  await context.initializeWorkspaceUser();
  assert.equal(context.workspaceUser.id, actor.id);
  assert.match(queries[0].sql, /age drop not null/);
  assert.match(queries[1].sql, /null, 'owner'/);
  assert.match(queries[1].sql, /on conflict \(google_sub\) do nothing/);
  assert.equal(queries[1].values[0], 'test-shared-workspace');
});

test('missing database returns a useful setup error, not a login error', async () => {
  const authorize = vm.runInNewContext(`${fn('requireAuth')}; requireAuth`, { pool: null });
  let code, body;
  const res = { status: n => { code = n; return res; }, json: data => { body = data; } };
  await authorize({}, res, () => { throw new Error('Should stop before querying data'); });
  assert.equal(code, 503);
  assert.match(body.error, /DATABASE_URL/);
});

test('shared workspace account cannot be registered, edited or deleted through old auth routes', async () => {
  const paths = ['/api/auth/register', '/api/auth/profile', '/api/auth/account', '/api/auth/google'];
  for (const endpoint of paths) {
    const route = tree.statements.find(n => ts.isExpressionStatement(n) && ts.isCallExpression(n.expression)
      && n.expression.arguments[0]?.text === endpoint).expression;
    const handler = vm.runInNewContext(`(${route.arguments.at(-1).getText(tree)})`, { loginRequired: false });
    let code;
    const res = { status: n => { code = n; return res; }, json: () => {} };
    await handler({}, res, () => { throw new Error('Unexpected route continuation'); });
    assert.equal(code, 409, endpoint);
  }
});
