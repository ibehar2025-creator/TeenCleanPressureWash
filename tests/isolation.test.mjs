import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
test('all bundled business collections are empty', () => {
  const source = fs.readFileSync(path.join(root, 'src/data/googleSheetData.ts'), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
  const context = { exports: {} };
  vm.runInNewContext(compiled.outputText, context);
  for (const collection of ['customers', 'crewMembers', 'jobs', 'leads', 'invoices', 'payments', 'servicePlans', 'reviews', 'expenses']) {
    assert.equal(context.exports[collection].length, 0, collection);
  }
  assert.equal(context.exports.businessSettings.businessName, 'TeenCleanPressureWash');
  for (const field of ['phone', 'email', 'website']) assert.equal(context.exports.businessSettings[field], '');
});

test('all external integrations and access codes start blank', () => {
  const example = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
  for (const line of example.split(/\r?\n/)) {
    if (!line || line.startsWith('#') || line.startsWith('PORT=')) continue;
    assert.equal(line.split('=').slice(1).join('='), '', line.split('=')[0]);
  }
  assert.equal(fs.existsSync(path.join(root, '.env')), false);
});

test('no hardcoded business spreadsheet or database endpoints remain', () => {
  for (const dir of ['src', 'server', 'public']) {
    const base = path.join(root, dir);
    for (const entry of fs.readdirSync(base, { recursive: true, withFileTypes: true })) {
      if (!entry.isFile() || !/\.(tsx?|mjs|js|json|sql|html|css|webmanifest)$/.test(entry.name)) continue;
      const source = fs.readFileSync(path.join(entry.parentPath, entry.name), 'utf8');
      assert.doesNotMatch(source, /https:\/\/docs\.google\.com\/spreadsheets\/d\/[\w-]+/);
      assert.doesNotMatch(source, /https:\/\/script\.google\.com\/macros\/s\/[\w-]+/);
      assert.doesNotMatch(source, /[a-z0-9]{20}\.supabase\.co/);
      assert.doesNotMatch(source, /AIza[\w-]{30,}/);
    }
  }
});
