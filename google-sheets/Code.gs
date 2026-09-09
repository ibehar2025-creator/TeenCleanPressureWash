// Bound Apps Script for the existing Sheet1 layout. Configure Script Properties first.
function setupTeenClean() {
  var props = PropertiesService.getScriptProperties();
  var book = SpreadsheetApp.getActiveSpreadsheet();
  if (!book) throw new Error('Open Apps Script from the spreadsheet first.');
  props.setProperty('SPREADSHEET_ID', book.getId());
  if (!props.getProperty('SYNC_TOKEN')) props.setProperty('SYNC_TOKEN', Utilities.getUuid() + Utilities.getUuid());
  readJobs_(book, loadState_(book));
  return 'Ready. Find SYNC_TOKEN under Project Settings > Script properties.';
}

function doGet(e) { return handle_(e, false); }
function doPost(e) { return handle_(e, true); }

function handle_(e, write) {
  var lock, acquired = false;
  try {
    var props = PropertiesService.getScriptProperties();
    var expected = props.getProperty('SYNC_TOKEN');
    if (!expected || !e || !e.parameter || e.parameter.syncToken !== expected) throw new Error('Unauthorized sync request.');
    var id = props.getProperty('SPREADSHEET_ID');
    if (!id) throw new Error('Run setupTeenClean first.');
    lock = LockService.getScriptLock();
    lock.waitLock(15000);
    acquired = true;
    var book = SpreadsheetApp.openById(id);
    var state = loadState_(book);
    var result;
    if (write) {
      var request = JSON.parse(e.postData.contents);
      result = request.action === 'workspaceWrite'
        ? { ok: true, connector: 'teenclean-v2', result: workspaceWrite_(book, state, request.row || {}) }
        : writeAction_(book, state, request.action, request.row || {});
      saveState_(book, state);
      SpreadsheetApp.flush();
    } else result = workspaceSnapshot_(book, state);
    return json_(result);
  } catch (error) {
    return json_({ ok: false, error: String(error.message || error) });
  } finally {
    if (acquired) lock.releaseLock();
  }
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

function loadState_(book) {
  var sheet = book.getSheetByName('_TeenCleanSync');
  var state = { jobs: {}, customers: {}, leads: {}, servicePlans: {}, calendarEvents: {}, notifications: {} };
  if (!sheet || sheet.getLastRow() < 2) return state;
  sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).getValues().forEach(function(row) {
    if (state[row[0]] && row[1] && row[2]) state[row[0]][row[1]] = JSON.parse(row[2]);
  });
  return state;
}

function saveState_(book, state) {
  var sheet = book.getSheetByName('_TeenCleanSync') || book.insertSheet('_TeenCleanSync');
  var rows = [['Type', 'Key', 'Data']];
  Object.keys(state).forEach(function(type) {
    Object.keys(state[type]).forEach(function(key) { rows.push([type, key, JSON.stringify(state[type][key])]); });
  });
  if (rows.length > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), rows.length - sheet.getMaxRows());
  // Write before clearing old trailing entries so a failed write does not erase all metadata.
  var oldEnd = sheet.getLastRow();
  sheet.getRange(1, 1, rows.length, 3).setValues(rows);
  if (oldEnd > rows.length) sheet.getRange(rows.length + 1, 1, oldEnd - rows.length, 3).clearContent();
  sheet.hideSheet();
}

function layout_(book) {
  var sheet = book.getSheetByName('Sheet1');
  if (!sheet) throw new Error('The jobs tab must be named Sheet1.');
  var width = Math.max(9, sheet.getLastColumn());
  var headers = sheet.getRange(1, 1, 1, width).getDisplayValues()[0].map(function(h) { return String(h).trim().toLowerCase(); });
  var names = { number: 'job number', date: 'date', name: 'costumer', address: 'address', phone: 'phone number', serviceType: 'job description', notes: 'notes', status: 'status', price: 'amount made' };
  var columns = {};
  Object.keys(names).forEach(function(key) {
    var col = headers.indexOf(names[key]);
    if (key === 'name' && col < 0) col = headers.indexOf('customer');
    if (col < 0) throw new Error('Missing column: ' + names[key]);
    columns[key] = col;
  });
  columns.time = headers.indexOf('time');
  var count = Math.max(0, sheet.getLastRow() - 1);
  return { sheet: sheet, columns: columns, width: width, values: count ? sheet.getRange(2, 1, count, width).getDisplayValues() : [], formulas: count ? sheet.getRange(2, 1, count, width).getFormulas() : [] };
}

function text_(value) { return String(value == null ? '' : value).trim(); }
function jobNumber_(value) { return text_(value).replace(/^#/, '').trim(); }
function isJob_(row, c) { return Boolean(text_(row[c.name]) || text_(row[c.address]) || text_(row[c.serviceType])); }
function amount_(value) {
  if (!text_(value)) return 0;
  var number = Number(text_(value).replace(/[$,\s]/g, ''));
  if (!isFinite(number) || number < 0) throw new Error('Invalid job amount: ' + value);
  return number;
}
function date_(value) {
  var raw = text_(value);
  if (!raw || /^(tbd|not scheduled)$/i.test(raw)) return '';
  var match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) raw = match[3] + '-' + ('0' + match[1]).slice(-2) + '-' + ('0' + match[2]).slice(-2);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || !isFinite(Date.parse(raw + 'T12:00:00Z')) || new Date(raw + 'T12:00:00Z').toISOString().slice(0, 10) !== raw) throw new Error('Invalid date: ' + value);
  return raw;
}
function time_(value) {
  var raw = text_(value);
  if (!raw) return '';
  var m = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
  if (!m) throw new Error('Use a time such as 09:30 or 2:30 PM.');
  var hour = Number(m[1]);
  if (Number(m[2]) > 59 || (m[3] ? hour < 1 || hour > 12 : hour > 23)) throw new Error('Invalid time.');
  if (m[3]) hour = hour % 12 + (m[3].toUpperCase() === 'PM' ? 12 : 0);
  return ('0' + hour).slice(-2) + ':' + m[2];
}
function status_(value) {
  var status = text_(value).toLowerCase();
  if (['finished', 'complete', 'completed', 'paid'].indexOf(status) >= 0) return 'completed';
  if (['', 'tbd', 'scheduled', 'incomplete'].indexOf(status) >= 0) return 'scheduled';
  if (status === 'cancelled') return 'canceled';
  if (['canceled', 'in progress', 'past due'].indexOf(status) >= 0) return status;
  throw new Error('Unrecognized job status: ' + value);
}
function customerKey_(name, address) {
  var normalized = (text_(name).toLowerCase() + '|' + text_(address).toLowerCase()).replace(/\s+/g, ' ');
  return 'tc-customer-' + Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, normalized).map(function(b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('').slice(0, 24);
}

function readJobs_(book, state) {
  var layout = layout_(book), c = layout.columns;
  var jobs = [], customers = {}, seen = {};
  Object.keys(state.customers).forEach(function(id) { customers[id] = state.customers[id]; });
  layout.values.forEach(function(row, index) {
    if (!isJob_(row, c)) return;
    var number = String(Number(jobNumber_(row[c.number])));
    if (!/^\d+$/.test(jobNumber_(row[c.number])) || Number(number) < 1 || seen[number]) throw new Error('Missing or duplicate job number at row ' + (index + 2) + '. Fix it before syncing.');
    seen[number] = true;
    var saved = state.jobs[number] || {};
    var name = text_(row[c.name]) || 'Customer', address = text_(row[c.address]);
    var customerId = saved.customerId || customerKey_(name, address);
    customers[customerId] = Object.assign({}, customers[customerId], { id: customerId, name: name, address: address, phone: text_(row[c.phone]), email: (customers[customerId] || {}).email || '', notes: (customers[customerId] || {}).notes || '', insights: [] });
    var status = status_(row[c.status]), price = amount_(row[c.price]);
    jobs.push({ id: saved.jobId || 'tc-job-' + number, customerId: customerId, date: date_(row[c.date]), time: time_(c.time >= 0 ? row[c.time] : saved.time), address: address, serviceType: text_(row[c.serviceType]), notes: text_(row[c.notes]), status: status, price: price, amountPaid: status === 'completed' ? price : 0, paymentStatus: status === 'completed' ? 'paid' : 'unpaid', tipAmount: saved.tipAmount || 0, paymentMethod: saved.paymentMethod || null, crewIds: [], source: 'spreadsheet-import' });
  });
  return { ok: true, connector: 'teenclean-v1', customers: Object.keys(customers).map(function(id) { return customers[id]; }), jobs: jobs };
}

function safeValue_(value) {
  return typeof value === 'string' && /^[=+@-]/.test(value) ? "'" + value : value;
}

function workspaceSnapshot_(book, state) {
  var result = readJobs_(book, state);
  result.connector = 'teenclean-v2';
  ['leads', 'servicePlans', 'calendarEvents'].forEach(function(key) {
    result[key] = Object.keys(state[key] || {}).map(function(id) { return state[key][id]; });
  });
  result.readKeys = Object.keys(state.notifications || {});
  result.invoices = []; result.expenses = []; result.reviews = []; result.solicitations = [];
  return result;
}

function workspaceWrite_(book, state, request) {
  var collection = request.collection, operation = request.operation, id = text_(request.id);
  ['leads', 'servicePlans', 'calendarEvents', 'notifications'].forEach(function(key) { state[key] = state[key] || {}; });
  if (collection === 'notifications' && operation === 'markRead') {
    if (!Array.isArray(request.keys) || request.keys.length > 500) throw new Error('Invalid notification keys.');
    request.keys.forEach(function(key) {
      if (typeof key !== 'string' || key.length > 4000 || ['__proto__', 'constructor', 'prototype'].indexOf(key) >= 0) throw new Error('Invalid notification key.');
      state.notifications[key] = { readAt: new Date().toISOString() };
    });
    return { readKeys: Object.keys(state.notifications) };
  }
  if (['customers', 'jobs', 'leads', 'servicePlans', 'calendarEvents'].indexOf(collection) < 0 || ['create', 'update', 'delete'].indexOf(operation) < 0) throw new Error('Unsupported record operation.');
  if (!id || !/^[a-zA-Z0-9-]+$/.test(id)) throw new Error('Invalid record ID.');
  var snapshot = workspaceSnapshot_(book, state);
  var existing = snapshot[collection].filter(function(item) { return item.id === id; })[0];
  if (operation !== 'create' && !existing) {
    if (operation === 'delete') return { deleted: true };
    throw new Error('Record no longer exists. Refresh before editing.');
  }
  if (operation === 'delete') {
    if (collection === 'jobs') writeAction_(book, state, 'deleteJob', { jobId: id });
    else if (collection === 'leads' || collection === 'calendarEvents') delete state[collection][id];
    else throw new Error('Deletion is not supported for this record.');
    return { deleted: true };
  }
  var input = request.data || {};
  var defaults = {
    customers: { name: '', phone: '', email: '', address: '', notes: '', insights: [] },
    jobs: { customerId: '', date: '', time: '', price: 0, address: '', serviceType: '', notes: '', status: 'scheduled', tipAmount: 0 },
    leads: { name: '', contact: '', address: '', status: 'new', estimatedValue: 0, followUpDate: '', notes: '', source: 'Website' },
    servicePlans: { customerId: '', type: 'yearly', price: 0, discountPct: 0, renewalDate: '', servicesIncluded: [], paymentStatus: 'unpaid', notes: '' },
    calendarEvents: { title: '', type: 'meeting', date: '', startTime: '', endTime: '', location: '', notes: '' },
  };
  var record = Object.assign({}, defaults[collection], existing || {});
  Object.keys(defaults[collection]).forEach(function(key) {
    if (Object.prototype.hasOwnProperty.call(input, key)) record[key] = input[key];
  });
  record.id = id;
  Object.keys(defaults[collection]).forEach(function(key) {
    if (typeof defaults[collection][key] === 'string') {
      if (typeof record[key] !== 'string' || record[key].length > 12000) throw new Error('Invalid ' + key + '.');
      record[key] = text_(record[key]);
    }
  });
  if (JSON.stringify(record).length > 40000) throw new Error('Record is too large for a spreadsheet cell.');
  if (collection === 'jobs' || collection === 'servicePlans') {
    var customer = snapshot.customers.filter(function(item) { return item.id === record.customerId; })[0];
    if (!customer) throw new Error('Choose or create a customer first.');
    record.price = amount_(record.price);
  }
  if (collection === 'jobs') {
    if (!record.address || !record.serviceType) throw new Error('Address and service are required.');
    record.date = date_(record.date); record.time = time_(record.time); record.status = status_(record.status);
    record.tipAmount = amount_(record.tipAmount);
    var plan;
    if (operation === 'create' && input.recurrence) {
      var recurrence = input.recurrence;
      if (['monthly', '3-month', '4-month', '6-month', 'yearly'].indexOf(recurrence.frequency) < 0 || !date_(recurrence.renewalDate)) throw new Error('Invalid recurring frequency or renewal date.');
      plan = { id: 'plan-' + id, customerId: record.customerId, type: recurrence.frequency, renewalDate: date_(recurrence.renewalDate), servicesIncluded: [record.serviceType], price: record.price, discountPct: 0, paymentStatus: 'unpaid', notes: record.notes };
    }
    writeAction_(book, state, operation === 'create' ? 'addUpcomingJob' : 'updateJob', Object.assign({}, record, { jobId: id, name: customer.name, phone: customer.phone }));
    if (plan) state.servicePlans[plan.id] = plan;
    var job = readJobs_(book, state).jobs.filter(function(item) { return item.id === id; })[0];
    return operation === 'create' ? { job: job, servicePlan: plan } : job;
  }
  if (collection === 'customers') {
    if (!record.name) throw new Error('Customer name is required.');
    record.insights = existing ? existing.insights : [];
    state.customers[id] = record;
    snapshot.jobs.filter(function(job) { return job.customerId === id; }).forEach(function(job) {
      writeAction_(book, state, 'updateJob', { jobId: job.id, customerId: id, name: record.name, phone: record.phone, address: record.address || job.address });
    });
  }
  if (collection === 'leads') {
    if (!record.name || ['new', 'contacted', 'quoted', 'scheduled', 'won', 'lost'].indexOf(record.status) < 0) throw new Error('Lead name and valid status are required.');
    record.estimatedValue = amount_(record.estimatedValue); record.followUpDate = date_(record.followUpDate);
  }
  if (collection === 'servicePlans') {
    if (['monthly', '3-month', '4-month', '6-month', 'yearly'].indexOf(record.type) < 0) throw new Error('Invalid plan frequency.');
    record.renewalDate = date_(record.renewalDate);
    if (!record.renewalDate || !Array.isArray(record.servicesIncluded) || record.servicesIncluded.some(function(v) { return typeof v !== 'string'; })) throw new Error('Renewal date and services are required.');
    record.discountPct = amount_(record.discountPct);
    if (record.discountPct > 100) throw new Error('Discount cannot exceed 100%.');
  }
  if (collection === 'calendarEvents') {
    record.date = date_(record.date); record.startTime = time_(record.startTime); record.endTime = time_(record.endTime);
    if (!record.title || !record.date || !record.startTime) throw new Error('Event title, date and time are required.');
    if (record.endTime && record.endTime < record.startTime) throw new Error('End time must be after start time.');
    if (['meeting', 'soliciting', 'estimate', 'reminder', 'other'].indexOf(record.type) < 0) throw new Error('Invalid event type.');
  }
  state[collection][id] = record;
  return record;
}
function writeAction_(book, state, action, input) {
  // Only the existing customer/jobs sheet is connected. Leads and plans stay database-backed.
  if (['addLead', 'deleteLead', 'addServicePlan'].indexOf(action) >= 0) return { ok: true, skipped: true };
  if (action === 'addCustomer') {
    if (!input.customerId || !text_(input.name)) throw new Error('Customer ID and name are required.');
    state.customers[input.customerId] = { id: input.customerId, name: text_(input.name), phone: text_(input.phone), email: text_(input.email), address: text_(input.address), notes: text_(input.notes), insights: [] };
    return { ok: true };
  }
  if (['addUpcomingJob', 'addRecurringJob', 'updateJob', 'deleteJob'].indexOf(action) < 0) throw new Error('Unsupported action: ' + action);
  if (!input.jobId) throw new Error('Job ID is required.');
  var snapshot = readJobs_(book, state);
  var layout = layout_(book), c = layout.columns;
  var number = Object.keys(state.jobs).filter(function(key) { return state.jobs[key].jobId === input.jobId; })[0];
  if (!number && /^tc-job-\d+$/.test(input.jobId)) number = input.jobId.slice(7);
  var adding = action === 'addUpcomingJob' || action === 'addRecurringJob';
  var index = number ? layout.values.findIndex(function(row) { return String(Number(jobNumber_(row[c.number]))) === number && (adding || isJob_(row, c)); }) : -1;
  if (!adding && index < 0) {
    if (action === 'deleteJob') return { ok: true };
    throw new Error('Job was not found in Sheet1. Refresh before editing.');
  }
  if (action === 'deleteJob') {
    // Clear only job cells, preserving charts, formulas and the rest of the row.
    Object.keys(c).filter(function(key) { return key !== 'number' && c[key] >= 0; }).forEach(function(key) { layout.sheet.getRange(index + 2, c[key] + 1).clearContent(); });
    delete state.jobs[number];
    return { ok: true };
  }
  // Validate before making any cell changes.
  if ('date' in input) date_(input.date);
  if ('time' in input) time_(input.time);
  if ('price' in input) amount_(input.price);
  if ('status' in input) status_(input.status);
  if (adding && (!input.name || !input.address || !input.customerId)) throw new Error('New jobs require a customer name, address and customer ID.');
  if (adding && index < 0) {
    var totalIndex = layout.formulas.findIndex(function(row, i) { return !isJob_(layout.values[i], c) && Boolean(row[c.price]); });
    var maxNumber = layout.values.reduce(function(max, row) { return Math.max(max, Number(jobNumber_(row[c.number])) || 0); }, 0);
    // Insert ahead of the final spare row so SUM ranges and chart references expand naturally.
    if (totalIndex > 0 && !isJob_(layout.values[totalIndex - 1], c)) index = totalIndex - 1;
    else if (totalIndex >= 0) index = totalIndex;
    else index = layout.values.length;
    layout.sheet.insertRowsBefore(index + 2, 1);
    number = String(maxNumber + 1);
    layout.sheet.getRange(index + 2, c.number + 1).setValue('#' + number);
    if (totalIndex >= 0 && index === totalIndex) {
      var total = layout.sheet.getRange(totalIndex + 3, c.price + 1);
      var simpleSum = layout.formulas[totalIndex][c.price].match(/^=SUM\(([A-Z]+)2:\1\d+\)$/i);
      if (simpleSum) total.setFormula('=SUM(' + simpleSum[1] + '2:' + simpleSum[1] + (totalIndex + 2) + ')');
    }
  }
  var previous = snapshot.jobs.filter(function(job) { return job.id === input.jobId; })[0];
  state.jobs[number] = Object.assign({}, state.jobs[number], { jobId: input.jobId, customerId: input.customerId || (previous || {}).customerId, time: 'time' in input ? time_(input.time) : (previous || {}).time || '' });
  // Reserve the identity before cell writes so a partial failure can be retried without duplicating the job.
  if ('tipAmount' in input) state.jobs[number].tipAmount = amount_(input.tipAmount);
  if ('paymentMethod' in input) state.jobs[number].paymentMethod = input.paymentMethod;
  saveState_(book, state);
  ['name', 'date', 'address', 'phone', 'serviceType', 'notes', 'status', 'price', 'time'].forEach(function(key) {
    if (!(key in input) || c[key] < 0) return;
    var value = input[key];
    if (key === 'date') { var iso = date_(value); value = iso ? iso.slice(5, 7) + '/' + iso.slice(8, 10) + '/' + iso.slice(0, 4) : 'TBD'; }
    if (key === 'time') value = time_(value);
    if (key === 'price') value = amount_(value);
    if (key === 'status') { var normalized = status_(value); value = normalized === 'completed' ? 'Finished' : normalized === 'scheduled' ? 'TBD' : normalized; }
    var cell = layout.sheet.getRange(index + 2, c[key] + 1);
    if (key === 'status') {
      var rule = cell.getDataValidation();
      if (rule) cell.setDataValidation(rule.copy().setAllowInvalid(true).build());
    }
    cell.setValue(safeValue_(value));
  });
  return { ok: true };
}
