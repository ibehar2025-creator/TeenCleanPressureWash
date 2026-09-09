import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import test from 'node:test';
import ts from 'typescript';

const source = fs.readFileSync(new URL('../google-sheets/Code.gs', import.meta.url), 'utf8');
const headers = ['Job number', 'Date', 'Costumer', 'Address', 'Phone number', 'Job description', 'Notes', 'Status', 'Amount made'];

// A small in-memory Sheet API, including the SUM range adjustment used by row insertion.
class Sheet {
  constructor(rows) { this.rows = structuredClone(rows); }
  getLastRow() { return this.rows.length; }
  getLastColumn() { return Math.max(...this.rows.map(r => r.length)); }
  getMaxRows() { return 1000; }
  hideSheet() {}
  insertRowsBefore(row) {
    this.rows.splice(row - 1, 0, Array(9).fill(''));
    this.rows.forEach(r => r.forEach((v, i) => {
      if (typeof v === 'string') r[i] = v.replace(/^=SUM\(I2:I(\d+)\)$/, (_, end) => `=SUM(I2:I${Number(end) >= row ? Number(end) + 1 : end})`);
    }));
  }
  getRange(row, col, height = 1, width = 1) {
    const read = formulas => Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => {
      const value = this.rows[row + y - 1]?.[col + x - 1] ?? '';
      return formulas ? (String(value).startsWith('=') ? value : '') : value;
    }));
    const write = value => { this.rows[row - 1] ??= []; this.rows[row - 1][col - 1] = value; };
    return {
      getValues: () => read(false), getDisplayValues: () => read(false), getFormulas: () => read(true),
      setValue: write, setFormula: write, clearContent: () => write(''), getDataValidation: () => null,
      setValues: values => values.forEach((r, y) => r.forEach((v, x) => {
        this.rows[row + y - 1] ??= []; this.rows[row + y - 1][col + x - 1] = v;
      })),
    };
  }
}

function fixture() {
  const sheet = new Sheet([
    headers,
    ['#1', '8/1/2026', 'Sample Owner', '1 Test Lane', '555-0100', 'Windows', '', 'Finished', '$50.00'],
    ['#2', 'TBD', 'Sample Owner', '1 Test Lane', '555-0100', 'Driveway', 'Call later', 'TBD', ''],
    ['#3', '', '', '', '', '', '', 'TBD', ''],
    ['#4', '', '', '', '', '', '', '', '=SUM(I2:I4)'],
  ]);
  const sheets = { Sheet1: sheet };
  const book = { getSheetByName: n => sheets[n], insertSheet: n => (sheets[n] = new Sheet([])) };
  const context = vm.createContext({
    Utilities: { DigestAlgorithm: { SHA_256: 'sha256' }, computeDigest: (algorithm, value) => [...crypto.createHash(algorithm).update(value).digest()] },
  });
  vm.runInContext(source, context);
  return { sheet, book, context, state: { jobs: {}, customers: {} } };
}

test('imports jobs, merges repeat customers, skips spare and total rows, preserves TBD', () => {
  const { book, state, context } = fixture();
  const result = context.readJobs_(book, state);
  assert.equal(result.jobs.length, 2);
  assert.equal(result.customers.length, 1);
  assert.equal(result.jobs[0].status, 'completed');
  assert.equal(result.jobs[0].price, 50);
  assert.equal(result.jobs[1].date, '');
  assert.equal(result.jobs[1].time, '');
  assert.equal(result.jobs[1].status, 'scheduled');
});

test('job IDs survive row reordering; duplicate or missing numbers fail safely', () => {
  const { book, sheet, state, context } = fixture();
  [sheet.rows[1], sheet.rows[2]] = [sheet.rows[2], sheet.rows[1]];
  assert.equal(context.readJobs_(book, state).jobs[0].id, 'tc-job-2');
  sheet.rows[2][0] = '#02';
  assert.throws(() => context.readJobs_(book, state), /duplicate job number/);
  sheet.rows[2][0] = '';
  assert.throws(() => context.readJobs_(book, state), /Missing/);
});

test('invalid dates, amounts and statuses reject before changing cells', () => {
  const { context, book, state, sheet } = fixture();
  for (const patch of [{ date: '2026-02-30' }, { price: 'invalid' }, { status: 'garbage' }]) {
    const before = JSON.stringify(sheet.rows);
    assert.throws(() => context.writeAction_(book, state, 'updateJob', { jobId: 'tc-job-1', ...patch }));
    assert.equal(JSON.stringify(sheet.rows), before);
  }
});

test('website edits and hidden time/tips round trip and sheet edits win next sync', () => {
  const { context, book, state, sheet } = fixture();
  context.writeAction_(book, state, 'updateJob', { jobId: 'tc-job-2', status: 'completed', price: 80, notes: 'Done', time: '2:30 PM', tipAmount: 10 });
  assert.equal(sheet.rows[2][7], 'Finished');
  assert.equal(sheet.rows[2][6], 'Done');
  let job = context.readJobs_(book, context.loadState_(book)).jobs[1];
  assert.equal(job.time, '14:30');
  assert.equal(job.tipAmount, 10);
  sheet.rows[2][6] = 'Changed in sheet';
  sheet.rows[2][8] = '$90.00';
  job = context.readJobs_(book, context.loadState_(book)).jobs[1];
  assert.equal(job.notes, 'Changed in sheet');
  assert.equal(job.price, 90);
});

test('new jobs preserve totals and retry without duplication; delete preserves other rows', () => {
  const { context, book, state, sheet } = fixture();
  const job = { jobId: 'manual-job-example', customerId: 'manual-customer-example', name: 'New Sample', address: '2 Test Lane', date: '2026-09-08', time: '09:00', status: 'scheduled', price: 100, serviceType: 'Windows', notes: '=NOT_A_FORMULA()' };
  context.writeAction_(book, state, 'addUpcomingJob', job);
  assert.equal(sheet.rows.length, 6);
  assert.equal(sheet.rows[5][8], '=SUM(I2:I5)');
  assert.equal(sheet.rows[3][6], "'=NOT_A_FORMULA()");
  context.writeAction_(book, context.loadState_(book), 'addUpcomingJob', job);
  assert.equal(sheet.rows.length, 6);
  assert.equal(context.readJobs_(book, context.loadState_(book)).jobs.length, 3);
  context.writeAction_(book, state, 'deleteJob', { jobId: job.jobId });
  assert.equal(context.readJobs_(book, state).jobs.length, 2);
  assert.equal(sheet.rows[5][8], '=SUM(I2:I5)');
  assert.equal(sheet.rows[1][2], 'Sample Owner');
});

test('unauthorized requests never open the spreadsheet', () => {
  const { context } = fixture();
  context.PropertiesService = { getScriptProperties: () => ({ getProperty: () => 'private-test-token' }) };
  context.SpreadsheetApp = { openById: () => { throw new Error('Should not access data'); } };
  context.ContentService = { MimeType: { JSON: 'json' }, createTextOutput: text => ({ setMimeType: () => JSON.parse(text) }) };
  assert.equal(context.doGet({ parameter: {} }).error, 'Unauthorized sync request.');
  assert.equal(context.doPost({ parameter: { syncToken: 'wrong' } }).ok, false);
});

test('undated jobs remain editable and are not overdue or in time charts', () => {
  const src = fs.readFileSync(new URL('../src/lib/calculations.ts', import.meta.url), 'utf8');
  const context = { exports: {} };
  vm.runInNewContext(ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, context);
  const job = { date: '', status: 'scheduled', price: 100 };
  assert.equal(context.exports.jobDisplayStatus(job, '2026-09-08'), 'scheduled');
  assert.equal(context.exports.isUpcomingJob(job, '2026-09-08'), false);
  assert.equal(context.exports.cumulativeRevenueOverTime([job]).length, 0);
});

test('full sheets-only workflow survives fresh reads with no database', () => {
  const { context, book } = fixture();
  function write(collection, operation, id, data) {
    const state = context.loadState_(book);
    const result = context.workspaceWrite_(book, state, { collection, operation, id, data });
    context.saveState_(book, state);
    return result;
  }
  const customer = write('customers', 'create', 'customer-test', { name: 'Synthetic Customer', address: '3 Test Lane' });
  assert.equal(customer.id, 'customer-test');
  const created = write('jobs', 'create', 'job-test', { customerId: customer.id, date: '2026-09-09', time: '10:00', address: '3 Test Lane', serviceType: 'Windows', price: 75, recurrence: { frequency: 'yearly', renewalDate: '2027-09-09' } });
  assert.equal(created.job.price, 75);
  assert.equal(created.servicePlan.type, 'yearly');
  write('jobs', 'update', 'job-test', { notes: 'Edited on website', status: 'completed' });
  write('customers', 'update', customer.id, { phone: '555-0111' });
  write('leads', 'create', 'lead-test', { name: 'Test Lead', followUpDate: '2026-09-10' });
  write('leads', 'update', 'lead-test', { status: 'contacted' });
  write('calendarEvents', 'create', 'event-test', { title: 'Test meeting', date: '2026-09-10', startTime: '12:00', endTime: '13:00' });
  write('servicePlans', 'update', created.servicePlan.id, { notes: 'Annual reminder', price: 85 });
  const state = context.loadState_(book);
  context.workspaceWrite_(book, state, { collection: 'notifications', operation: 'markRead', keys: ['test-reminder'] });
  context.saveState_(book, state);
  const snapshot = context.workspaceSnapshot_(book, context.loadState_(book));
  assert.equal(snapshot.connector, 'teenclean-v2');
  assert.equal(snapshot.jobs.find(j => j.id === 'job-test').status, 'completed');
  assert.equal(snapshot.jobs.find(j => j.id === 'job-test').notes, 'Edited on website');
  assert.equal(snapshot.customers.find(c => c.id === customer.id).phone, '555-0111');
  assert.equal(snapshot.leads[0].status, 'contacted');
  assert.equal(snapshot.calendarEvents[0].title, 'Test meeting');
  assert.equal(snapshot.servicePlans[0].price, 85);
  assert.equal(snapshot.readKeys[0], 'test-reminder');
  for (const [collection, id] of [['jobs', 'job-test'], ['leads', 'lead-test'], ['calendarEvents', 'event-test']]) write(collection, 'delete', id);
  const after = context.workspaceSnapshot_(book, context.loadState_(book));
  assert.equal(after.jobs.length, 2);
  assert.equal(after.leads.length, 0);
  assert.equal(after.calendarEvents.length, 0);
  assert.equal(after.servicePlans.length, 1);
});
