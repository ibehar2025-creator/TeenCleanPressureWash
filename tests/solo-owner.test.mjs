import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../server/index.mjs', import.meta.url), 'utf8');
const tree = ts.createSourceFile('server.mjs', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const routes = tree.statements.filter((node) => ts.isExpressionStatement(node)
  && ts.isCallExpression(node.expression)
  && ts.isPropertyAccessExpression(node.expression.expression)
  && node.expression.expression.expression.getText(tree) === 'app'
  && ts.isStringLiteral(node.expression.arguments[0])).map((node) => node.expression);

test('employee, staffing and payroll endpoints are removed', () => {
  for (const route of routes) {
    assert.doesNotMatch(route.arguments[0].text, /^\/api\/(employee(?:\/|$)|owner\/(operations|employees|assignments|earnings|contracts|payouts|payroll)(?:\/|$))/);
  }
  for (const name of ['jobs', 'leads', 'calendar-events', 'service-plans', 'solicitations']) {
    assert.ok(routes.some((route) => route.arguments[0].text === `/api/${name}`), `Missing solo workflow: ${name}`);
  }
});

test('employee signup is rejected before creating an account', async () => {
  const route = routes.find((item) => item.arguments[0].text === '/api/auth/register');
  const register = vm.runInNewContext(`(${route.arguments.at(-1).getText(tree)})`, {
    loginRequired: true,
    validAuthState: () => true,
    verifyGoogleCredential: () => { throw new Error('Must not verify or create an employee account'); },
  });
  let status;
  let body;
  const response = { status: (value) => { status = value; return response; }, json: (value) => { body = value; } };
  await register({ body: { age: 20, role: 'employee' } }, response, (error) => { throw error; });
  assert.equal(status, 400);
  assert.match(body.error, /owner accounts only/);
});
