import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

async function importTypescript(path) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  return import(
    `data:text/javascript;base64,${Buffer.from(output).toString('base64')}`
  );
}

const previousBase = process.env.NEXT_PUBLIC_API_BASE_URL;
process.env.NEXT_PUBLIC_API_BASE_URL = 'http://dashboard.test/';
const { getDashboardApi, RecordsApiError } = await importTypescript(
  '../services/records-api.ts',
);
if (previousBase === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL;
else process.env.NEXT_PUBLIC_API_BASE_URL = previousBase;
const { DASHBOARD_COPY, dashboardMoney, dashboardStatusLabel } =
  await importTypescript('../app/dashboard/dashboard-copy.ts');

function record(type = 'PAYCHECK', overrides = {}) {
  return {
    recordKey: `${type}:1`,
    type,
    sourceId: 1,
    recordedAt: '2026-09-02T13:00:00',
    analyzedAt: '2026-09-02T13:00:00',
    status: type === 'PAYCHECK' ? 'NORMAL' : 'REVIEW_REQUIRED',
    analysisSummary: '서버에 저장된 요약',
    nextAction: '저장된 다음 행동',
    payPeriod: type === 'PAYCHECK' ? '2026-07' : null,
    taxYear: type === 'TAX_CHECK' ? 2025 : null,
    expectedExitDate: null,
    actualAmount: type === 'PAYCHECK' ? 2380000 : null,
    readinessScore: type === 'EXIT_CHECK' ? 0 : null,
    ...overrides,
  };
}

function dashboard(summary = {}) {
  return {
    year: 2026,
    paySummary: {
      totalReceivedPay: 2380000,
      recordedMonths: 1,
      amountKnownMonths: 1,
      recordedPeriods: ['2026-07'],
      missingAmountPeriods: [],
      ...summary,
    },
    latestPaycheck: record(),
    latestTaxCheck: record('TAX_CHECK'),
    latestExitCheck: null,
    recentRecords: [record('TAX_CHECK'), record()],
  };
}

function respond(t, data, inspect = () => {}) {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    inspect(url, options);
    return Response.json({ success: true, data, message: '성공' });
  });
}

function failure(kind, status) {
  return (error) =>
    error instanceof RecordsApiError &&
    error.kind === kind &&
    (status === undefined || error.status === status);
}

test('GET shared user 1, server-default year, no cache/cookies or writes', async (t) => {
  const data = dashboard();
  respond(t, data, (url, options) => {
    assert.equal(url, 'http://dashboard.test/api/dashboard?userId=1');
    assert.equal(options.method, 'GET');
    assert.equal(options.cache, 'no-store');
    assert.equal(options.credentials, 'omit');
    assert.equal(options.body, undefined);
    assert.equal(options.headers.Accept, 'application/json');
    assert.ok(options.signal instanceof AbortSignal);
  });
  assert.deepEqual(await getDashboardApi(), data);
});

test('empty year and empty history remain genuinely empty, not zero', async (t) => {
  const data = {
    ...dashboard({
      totalReceivedPay: null,
      recordedMonths: 0,
      amountKnownMonths: 0,
      recordedPeriods: [],
    }),
    latestPaycheck: null,
    latestTaxCheck: null,
    latestExitCheck: null,
    recentRecords: [],
  };
  respond(t, data);
  assert.deepEqual(await getDashboardApi(), data);
});

test('all recorded amounts unknown remains null with missing months', async (t) => {
  const data = dashboard({
    totalReceivedPay: null,
    amountKnownMonths: 0,
    missingAmountPeriods: ['2026-07'],
  });
  respond(t, data);
  assert.deepEqual((await getDashboardApi()).paySummary, data.paySummary);
});

for (const amount of [0, 2600000.1]) {
  test(`known total ${amount} is preserved`, async (t) => {
    respond(t, dashboard({ totalReceivedPay: amount }));
    assert.equal((await getDashboardApi()).paySummary.totalReceivedPay, amount);
  });
}

test('partial total is not recomputed from recent records or annualized', async (t) => {
  const summary = {
    totalReceivedPay: 2600000.1,
    recordedMonths: 3,
    amountKnownMonths: 2,
    recordedPeriods: ['2026-01', '2026-02', '2026-03'],
    missingAmountPeriods: ['2026-02'],
  };
  respond(t, dashboard(summary));
  assert.deepEqual((await getDashboardApi()).paySummary, summary);
});

test('latest tax/pay records may belong to years outside the pay summary', async (t) => {
  const data = dashboard();
  data.latestPaycheck.payPeriod = '2025-12';
  data.recentRecords[1].payPeriod = '2025-12';
  respond(t, data);
  const response = await getDashboardApi();
  assert.equal(response.year, 2026);
  assert.equal(response.latestTaxCheck.taxYear, 2025);
  assert.equal(response.latestPaycheck.payPeriod, '2025-12');
});

test('same IDs across types, null timestamps, zero readiness and unknown status are retained', async (t) => {
  const data = dashboard();
  data.latestExitCheck = record('EXIT_CHECK', {
    recordedAt: null,
    analyzedAt: null,
    status: 'NEW_STATUS',
  });
  data.recentRecords.push(data.latestExitCheck);
  respond(t, data);
  assert.deepEqual(await getDashboardApi(), data);
});

const invalidSummaries = {
  'string total': { totalReceivedPay: '2380000' },
  'negative total': { totalReceivedPay: -1 },
  'missing total': { totalReceivedPay: undefined },
  'known months exceed registered': { amountKnownMonths: 2 },
  'fractional month count': { recordedMonths: 1.5 },
  'too many months': { recordedMonths: 13 },
  'recorded periods missing': { recordedPeriods: undefined },
  'recorded periods not array': { recordedPeriods: {} },
  'missing months not array': { missingAmountPeriods: {} },
  'wrong year in period': { recordedPeriods: ['2025-07'] },
  'bad month': { recordedPeriods: ['2026-13'] },
  'bad period format': { recordedPeriods: ['2026-7'] },
  'duplicate period': {
    recordedMonths: 2,
    amountKnownMonths: 2,
    recordedPeriods: ['2026-07', '2026-07'],
  },
  'count and periods disagree': { recordedMonths: 2 },
  'missing month not recorded': {
    totalReceivedPay: null,
    amountKnownMonths: 0,
    missingAmountPeriods: ['2026-08'],
  },
  'duplicate missing month': { missingAmountPeriods: ['2026-07', '2026-07'] },
  'known total but no known months': {
    amountKnownMonths: 0,
    missingAmountPeriods: ['2026-07'],
  },
  'null total despite known month': { totalReceivedPay: null },
};
for (const [name, summary] of Object.entries(invalidSummaries)) {
  test(`reject summary: ${name}`, async (t) => {
    respond(t, dashboard(summary));
    await assert.rejects(getDashboardApi(), failure('response'));
  });
}

const invalidResponses = {
  'null data': null,
  'string year': { ...dashboard(), year: '2026' },
  'year out of range': { ...dashboard(), year: 1999 },
  'null summary': { ...dashboard(), paySummary: null },
  'wrong latest type': { ...dashboard(), latestPaycheck: record('TAX_CHECK') },
  'missing latest field': { ...dashboard(), latestTaxCheck: undefined },
  'corrupt latest summary': {
    ...dashboard(),
    latestTaxCheck: record('TAX_CHECK', { analysisSummary: [] }),
  },
  'recent records not array': { ...dashboard(), recentRecords: {} },
  'too many recent records': {
    ...dashboard(),
    recentRecords: Array.from({ length: 4 }, (_, i) =>
      record('PAYCHECK', { sourceId: i + 1, recordKey: `PAYCHECK:${i + 1}` }),
    ),
  },
  'duplicate recent record': {
    ...dashboard(),
    recentRecords: [record(), record()],
  },
  'wrong record key': {
    ...dashboard(),
    recentRecords: [record('PAYCHECK', { recordKey: 'TAX_CHECK:1' })],
  },
  'unknown type': { ...dashboard(), recentRecords: [record('OTHER')] },
};
for (const [name, data] of Object.entries(invalidResponses)) {
  test(`reject response: ${name}`, async (t) => {
    respond(t, data);
    await assert.rejects(getDashboardApi(), failure('response'));
  });
}

for (const status of [400, 404, 500]) {
  test(`HTTP ${status} is never shown as an empty dashboard`, async (t) => {
    t.mock.method(
      globalThis,
      'fetch',
      async () => new Response('', { status }),
    );
    await assert.rejects(getDashboardApi(), failure('http', status));
  });
}

test('network failure does not fall back to context or localStorage', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => {
    throw new TypeError('Failed to fetch');
  });
  await assert.rejects(getDashboardApi(), failure('network'));
});

test('invalid JSON is a response error', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('{bad'));
  await assert.rejects(getDashboardApi(), failure('response'));
});

test('success:false is rejected even with a valid payload', async (t) => {
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ success: false, data: dashboard() }),
  );
  await assert.rejects(getDashboardApi(), failure('response'));
});

function waitUntilAborted(t) {
  t.mock.method(
    globalThis,
    'fetch',
    (_url, options) =>
      new Promise((_resolve, reject) => {
        const cancel = () => reject(new DOMException('Aborted', 'AbortError'));
        if (options.signal.aborted) cancel();
        else options.signal.addEventListener('abort', cancel, { once: true });
      }),
  );
}

for (const preAborted of [true, false]) {
  test(`caller abort is forwarded (pre-aborted=${preAborted})`, async (t) => {
    waitUntilAborted(t);
    const controller = new AbortController();
    if (preAborted) controller.abort();
    const promise = getDashboardApi(controller.signal);
    controller.abort();
    await assert.rejects(promise, { name: 'AbortError' });
  });
}

test('timeout aborts the request after 15 seconds', async (t) => {
  waitUntilAborted(t);
  let expire;
  t.mock.method(globalThis, 'setTimeout', (callback, milliseconds) => {
    assert.equal(milliseconds, 15000);
    expire = callback;
    return 0;
  });
  const promise = getDashboardApi();
  expire();
  await assert.rejects(promise, failure('timeout'));
});

for (const locale of ['ko', 'en', 'vi', 'zh']) {
  test(`display ${locale}: null, zero, cents and unknown statuses`, () => {
    assert.equal(dashboardMoney(null, locale), '—');
    assert.notEqual(dashboardMoney(0, locale), '—');
    assert.notEqual(
      dashboardMoney(2600000.1, locale),
      dashboardMoney(2600000, locale),
    );
    assert.equal(
      dashboardStatusLabel('NORMAL', DASHBOARD_COPY[locale]),
      DASHBOARD_COPY[locale].normal,
    );
    assert.equal(
      dashboardStatusLabel(null, DASHBOARD_COPY[locale]),
      DASHBOARD_COPY[locale].unknown,
    );
    assert.equal(
      dashboardStatusLabel('NEW_STATUS', DASHBOARD_COPY[locale]),
      'NEW_STATUS',
    );
  });
}
