import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

// Run without another test framework or experimental TypeScript loaders.
const source = await readFile(
  new URL('../services/records-api.ts', import.meta.url),
  'utf8',
);
const output = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const previousBase = process.env.NEXT_PUBLIC_API_BASE_URL;
process.env.NEXT_PUBLIC_API_BASE_URL = 'http://records.test/';
const { getRecordsApi, getStoredTaxCardsApi, RecordsApiError } = await import(
  `data:text/javascript;base64,${Buffer.from(output).toString('base64')}`
);
if (previousBase === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL;
else process.env.NEXT_PUBLIC_API_BASE_URL = previousBase;

function record(type = 'PAYCHECK', overrides = {}) {
  return {
    recordKey: `${type}:1`,
    type,
    sourceId: 1,
    recordedAt: '2026-07-25T09:15:00',
    analyzedAt: '2026-07-25T09:15:00',
    status: type === 'PAYCHECK' ? 'NORMAL' : 'REVIEW_REQUIRED',
    analysisSummary: '서버에 저장된 분석 요약',
    nextAction: '추가 자료를 확인해 주세요.',
    payPeriod: type === 'PAYCHECK' ? '2026-07' : null,
    taxYear: type === 'TAX_CHECK' ? 2026 : null,
    expectedExitDate: type === 'EXIT_CHECK' ? '2026-12-31' : null,
    actualAmount: type === 'PAYCHECK' ? 2380000 : null,
    readinessScore: type === 'EXIT_CHECK' ? 0 : null,
    ...overrides,
  };
}

function list(items = [record('TAX_CHECK'), record()]) {
  return {
    items,
    counts: {
      all: items.length,
      paycheck: items.filter((item) => item.type === 'PAYCHECK').length,
      taxCheck: items.filter((item) => item.type === 'TAX_CHECK').length,
      exitCheck: items.filter((item) => item.type === 'EXIT_CHECK').length,
    },
  };
}

function respond(t, data, inspect = () => {}) {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    inspect(url, options);
    return Response.json({ success: true, data, message: '성공' });
  });
}

function isFailure(kind, status) {
  return (error) =>
    error instanceof RecordsApiError &&
    error.kind === kind &&
    (status === undefined || error.status === status);
}

test('all: explicit demo user, GET only, no cache/cookies, server order and same IDs across types', async (t) => {
  const expected = list();
  respond(t, expected, (url, options) => {
    assert.equal(url, 'http://records.test/api/records?userId=1');
    assert.equal(options.method, 'GET');
    assert.equal(options.cache, 'no-store');
    assert.equal(options.credentials, 'omit');
    assert.equal(options.body, undefined);
    assert.equal(options.headers.Accept, 'application/json');
    assert.ok(options.signal instanceof AbortSignal);
  });
  assert.deepEqual(await getRecordsApi(), expected);
});

for (const type of ['PAYCHECK', 'TAX_CHECK', 'EXIT_CHECK']) {
  test(`filter ${type}: retain unfiltered counts`, async (t) => {
    const expected = {
      items: [record(type)],
      counts: { all: 3, paycheck: 1, taxCheck: 1, exitCheck: 1 },
    };
    respond(t, expected, (url) => {
      assert.equal(new URL(url).searchParams.get('type'), type);
    });
    assert.deepEqual(await getRecordsApi(type), expected);
  });
}

test('genuine empty list succeeds without inventing records', async (t) => {
  respond(t, list([]));
  assert.deepEqual(await getRecordsApi(), list([]));
});

test('empty category may still have records in other categories', async (t) => {
  const expected = { ...list(), items: [] };
  respond(t, expected);
  assert.deepEqual(await getRecordsApi('EXIT_CHECK'), expected);
});

for (const amount of [null, 0, 123.45]) {
  test(`amount ${amount} is preserved, not replaced by a fallback`, async (t) => {
    respond(t, list([record('PAYCHECK', { actualAmount: amount })]));
    assert.equal((await getRecordsApi()).items[0].actualAmount, amount);
  });
}

for (const status of [400, 404, 500]) {
  test(`HTTP ${status} is an error, not an empty list`, async (t) => {
    t.mock.method(
      globalThis,
      'fetch',
      async () => new Response('', { status }),
    );
    await assert.rejects(getRecordsApi(), isFailure('http', status));
  });
}

test('network failure never falls back to local/mock data', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => {
    throw new TypeError('Failed to fetch');
  });
  await assert.rejects(getRecordsApi(), isFailure('network'));
});

test('malformed JSON is rejected', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('{invalid'));
  await assert.rejects(getRecordsApi(), isFailure('response'));
});

test('success:false with HTTP 200 is rejected', async (t) => {
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ success: false, data: list([]) }),
  );
  await assert.rejects(getRecordsApi(), isFailure('response'));
});

const invalidLists = {
  'missing data': null,
  'items is not an array': { ...list(), items: {} },
  'unknown record type': list([record('OTHER')]),
  'wrong record key': list([record('PAYCHECK', { recordKey: 'TAX_CHECK:1' })]),
  'unsafe id': list([
    record('PAYCHECK', { sourceId: Number.MAX_SAFE_INTEGER + 1 }),
  ]),
  'wrong amount type': list([record('PAYCHECK', { actualAmount: '2380000' })]),
  'missing nullable field': list([record('PAYCHECK', { taxYear: undefined })]),
  'duplicate record': list([record(), record()]),
  'inconsistent counts': {
    ...list(),
    counts: { all: 99, paycheck: 1, taxCheck: 1, exitCheck: 0 },
  },
  'truncated records': { ...list(), items: [] },
  'wrong category counts': {
    ...list(),
    counts: { all: 2, paycheck: 2, taxCheck: 0, exitCheck: 0 },
  },
};
for (const [name, data] of Object.entries(invalidLists)) {
  test(`reject ${name}`, async (t) => {
    respond(t, data);
    await assert.rejects(getRecordsApi(), isFailure('response'));
  });
}

test('a filtered response cannot contain another category', async (t) => {
  respond(t, { ...list(), items: [record('TAX_CHECK')] });
  await assert.rejects(getRecordsApi('PAYCHECK'), isFailure('response'));
});

test('invalid filter and detail id do not send requests', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('Unexpected request');
  });
  await assert.rejects(getRecordsApi('INVALID'), isFailure('response'));
  await assert.rejects(getStoredTaxCardsApi(0), isFailure('response'));
  assert.equal(fetchMock.mock.callCount(), 0);
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

test('caller cancellation is propagated to fetch', async (t) => {
  waitUntilAborted(t);
  const controller = new AbortController();
  const request = getRecordsApi('ALL', controller.signal);
  controller.abort();
  await assert.rejects(request, { name: 'AbortError' });
});

test('a pre-aborted caller is respected', async (t) => {
  waitUntilAborted(t);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(getRecordsApi('ALL', controller.signal), {
    name: 'AbortError',
  });
});

test('15-second timeout cancels fetch and is reported distinctly', async (t) => {
  waitUntilAborted(t);
  let expire;
  t.mock.method(globalThis, 'setTimeout', (callback, milliseconds) => {
    assert.equal(milliseconds, 15000);
    expire = callback;
    return 0;
  });
  const request = getRecordsApi();
  expire();
  await assert.rejects(request, isFailure('timeout'));
});

const card = {
  id: 'flat',
  title: '단일세율 참고값',
  status: 'UNKNOWN',
  summary: '적용 자격은 확인되지 않았습니다.',
  nextActions: ['추가 자료 확인'],
};
function detail(overrides = {}) {
  return {
    taxCheckId: 1,
    simulation: false,
    result: { cards: [card] },
    ...overrides,
  };
}

test('detail reads existing saved cards; it never analyzes or simulates', async (t) => {
  respond(t, detail(), (url, options) => {
    assert.equal(url, 'http://records.test/api/tax-checks/1?userId=1');
    assert.equal(options.method, 'GET');
  });
  assert.deepEqual(await getStoredTaxCardsApi(1), [card]);
});

test('saved detail with no cards is a genuine empty detail', async (t) => {
  respond(t, detail({ result: { cards: [] } }));
  assert.deepEqual(await getStoredTaxCardsApi(1), []);
});

for (const [name, data] of Object.entries({
  'wrong id': detail({ taxCheckId: 2 }),
  simulation: detail({ simulation: true }),
  'missing cards': detail({ result: {} }),
  'invalid next actions': detail({
    result: { cards: [{ ...card, nextActions: [null] }] },
  }),
  'duplicate card': detail({ result: { cards: [card, card] } }),
})) {
  test(`detail rejects ${name}`, async (t) => {
    respond(t, data);
    await assert.rejects(getStoredTaxCardsApi(1), isFailure('response'));
  });
}
