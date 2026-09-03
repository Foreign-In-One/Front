import assert from 'node:assert/strict';
import test from 'node:test';
import { api, fixture, input, simulated } from './taxcheck-test-helpers.mjs';

const { getTaxCheckApi, analyzeTaxCheckApi, simulateTaxCheckApi, TaxApiError } =
  api;
function respond(t, data, inspect = () => {}) {
  return t.mock.method(globalThis, 'fetch', async (url, options) => {
    inspect(url, options);
    return Response.json({ success: true, data, message: '성공' });
  });
}
const failure =
  (kind, uncertain = false) =>
  (error) =>
    error instanceof TaxApiError &&
    error.kind === kind &&
    error.saveUncertain === uncertain;

test('TaxCheck: GET reloads one saved snapshot with explicit demo user and no cookies/cache', async (t) => {
  const expected = fixture();
  respond(t, expected, (url, options) => {
    assert.equal(url, 'http://taxcheck.test/api/tax-checks/1?userId=1');
    assert.equal(options.method, 'GET');
    assert.equal(options.body, undefined);
    assert.equal(options.cache, 'no-store');
    assert.equal(options.credentials, 'omit');
  });
  assert.deepEqual(await getTaxCheckApi(1), expected);
});
for (const value of [
  '2000-02-29T00:00:00',
  '2024-02-29T00:00:00',
  '2026-09-03T23:59:59.1',
  '2026-09-03T18:07:02.123456789',
]) {
  test(`TaxCheck: preserves valid local datetime ${value}`, async (t) => {
    const data = fixture();
    data.analyzedAt = value;
    respond(t, data);
    assert.equal((await getTaxCheckApi(1)).analyzedAt, value);
  });
}
for (const value of [
  '2026-02-29T18:00:00',
  '2026-04-31T18:00:00',
  '2100-02-29T18:00:00',
  '2026-13-01T18:00:00',
  '2026-09-00T18:00:00',
  '2026-09-03T24:00:00',
  '2026-09-03T18:60:00',
  '2026-09-03T18:00:60',
  '2026-09-03T18:00:00.1234567890',
  '2026-09-03T18:00:00Z',
  '2026-09-03T18:00:00+09:00',
  '2026-09-03T18:00:00-05:00',
  '2026-09-03 18:00:00',
  '2026-09-03T18:00:00\n',
  '0000-09-03T18:00:00',
]) {
  test(`TaxCheck: rejects datetime outside current contract ${value}`, async (t) => {
    const data = fixture();
    data.analyzedAt = value;
    respond(t, data);
    await assert.rejects(getTaxCheckApi(1), failure('response'));
  });
}
test('TaxCheck: invalid saved timestamp keeps save uncertainty and never auto-retries', async (t) => {
  const data = fixture();
  data.analyzedAt = '2026-02-31T25:99:99';
  const mock = respond(t, data);
  await assert.rejects(analyzeTaxCheckApi(input()), failure('response', true));
  assert.equal(mock.mock.callCount(), 1);
});
test('TaxCheck: analysis sends only manual input, not frontend salary totals or profile', async (t) => {
  const expected = fixture();
  const mock = respond(t, expected, (url, options) => {
    assert.equal(url, 'http://taxcheck.test/api/tax-checks/analyze?userId=1');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(options.body), input());
    assert.equal(options.credentials, 'omit');
  });
  assert.deepEqual(await analyzeTaxCheckApi(input()), expected);
  assert.equal(mock.mock.callCount(), 1);
});
test('TaxCheck: simulation uses source endpoint, preserves original, no analysis fallback', async (t) => {
  const original = fixture();
  const before = JSON.stringify(original);
  const scenario = simulated();
  const changes = { income: scenario.income, conditions: scenario.conditions };
  const mock = respond(t, scenario, (url, options) => {
    assert.equal(
      url,
      'http://taxcheck.test/api/tax-checks/1/simulate?userId=1',
    );
    assert.deepEqual(JSON.parse(options.body), changes);
    assert.equal(JSON.parse(options.body).taxYear, undefined);
  });
  assert.deepEqual(await simulateTaxCheckApi(original, changes), scenario);
  assert.equal(JSON.stringify(original), before);
  assert.equal(mock.mock.callCount(), 1);
});
for (const [label, mutate] of [
  [
    'wrong saved ID',
    (d) => {
      d.taxCheckId = 2;
    },
  ],
  [
    'simulation in saved response',
    (d) => {
      d.simulation = true;
      d.taxCheckId = null;
      d.sourceTaxCheckId = 1;
    },
  ],
  [
    'general tax calculated',
    (d) => {
      d.result.generalTaxEstimate = 0;
    },
  ],
  [
    'tax difference calculated',
    (d) => {
      d.result.taxDifference = 0;
    },
  ],
  [
    'eligibility claimed',
    (d) => {
      d.result.calculation.eligibilityConfirmed = true;
    },
  ],
  [
    'wrong rate',
    (d) => {
      d.result.calculation.rate = 0.2;
    },
  ],
  [
    'duplicate card',
    (d) => {
      d.result.cards.push(d.result.cards[0]);
    },
  ],
  [
    'unsafe evidence URL',
    (d) => {
      d.result.cards[0].evidence[0].url = 'javascript:alert(1)';
    },
  ],
  [
    'credentialed evidence URL',
    (d) => {
      d.result.cards[0].evidence[0].url = 'https://key:secret@example.com';
    },
  ],
  [
    'foreign-year pay period',
    (d) => {
      d.paySummary.recordedPeriods = ['2025-07'];
    },
  ],
  [
    'unknown amount counted as known',
    (d) => {
      d.paySummary.totalReceivedPay = null;
    },
  ],
  [
    'missing warnings',
    (d) => {
      delete d.result.calculation.warnings;
    },
  ],
  [
    'negative income',
    (d) => {
      d.income.annualIncome = -1;
    },
  ],
  [
    'malformed date',
    (d) => {
      d.analyzedAt = 'today';
    },
  ],
  [
    'inconsistent missing calculation',
    (d) => {
      d.result.calculation.incomeBase = null;
    },
  ],
]) {
  test(`TaxCheck: rejects ${label}`, async (t) => {
    const data = fixture();
    mutate(data);
    respond(t, data);
    await assert.rejects(getTaxCheckApi(1), failure('response'));
  });
}
for (const amount of [null, 0, 6080000]) {
  test(`TaxCheck: keeps flat estimate ${amount} without inventing comparison`, async (t) => {
    const data = fixture();
    data.result.flatTaxEstimate = amount;
    data.result.calculation.incomeBase =
      amount === null ? null : amount === 0 ? 0 : 32000000;
    respond(t, data);
    const result = await getTaxCheckApi(1);
    assert.equal(result.result.flatTaxEstimate, amount);
    assert.equal(result.result.generalTaxEstimate, null);
    assert.equal(result.result.taxDifference, null);
  });
}
test('TaxCheck: nullable old input and genuinely absent Paycheck records are valid', async (t) => {
  const data = fixture();
  data.income = null;
  data.conditions = null;
  data.paySummary = {
    totalReceivedPay: null,
    recordedMonths: 0,
    amountKnownMonths: 0,
    recordedPeriods: [],
    missingAmountPeriods: [],
  };
  respond(t, data);
  assert.deepEqual(await getTaxCheckApi(1), data);
});
test('TaxCheck: analysis response year must match input', async (t) => {
  respond(t, fixture());
  const request = input();
  request.taxYear = 2025;
  await assert.rejects(analyzeTaxCheckApi(request), failure('response', true));
});
for (const [label, mutate] of [
  [
    'source',
    (d) => {
      d.sourceTaxCheckId = 2;
    },
  ],
  [
    'saved flag',
    (d) => {
      d.simulation = false;
      d.taxCheckId = 1;
      d.sourceTaxCheckId = null;
    },
  ],
  [
    'year',
    (d) => {
      d.taxYear = 2025;
      d.paySummary.recordedPeriods = ['2025-07'];
    },
  ],
]) {
  test(`TaxCheck: simulation rejects wrong ${label}`, async (t) => {
    const data = simulated();
    mutate(data);
    respond(t, data);
    await assert.rejects(
      simulateTaxCheckApi(fixture(), input()),
      failure('response'),
    );
  });
}
for (const status of [400, 404, 500, 503]) {
  test(`TaxCheck: HTTP ${status}, saved POST ambiguity differs from GET/simulation`, async (t) => {
    const mock = t.mock.method(
      globalThis,
      'fetch',
      async () => new Response('', { status }),
    );
    await assert.rejects(getTaxCheckApi(1), failure('http'));
    await assert.rejects(
      analyzeTaxCheckApi(input()),
      failure('http', status >= 500),
    );
    await assert.rejects(
      simulateTaxCheckApi(fixture(), input()),
      failure('http'),
    );
    assert.equal(mock.mock.callCount(), 3); // No automatic retries.
  });
}
test('TaxCheck: malformed success JSON may already have saved; never auto-retry', async (t) => {
  const mock = t.mock.method(
    globalThis,
    'fetch',
    async () => new Response('broken json', { status: 200 }),
  );
  await assert.rejects(analyzeTaxCheckApi(input()), failure('response', true));
  assert.equal(mock.mock.callCount(), 1);
});
test('TaxCheck: application failure envelope is not a successful save', async (t) => {
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ success: false, data: fixture() }),
  );
  await assert.rejects(analyzeTaxCheckApi(input()), failure('response', true));
});
test('TaxCheck: network failure is uncertain only for saving analysis', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => {
    throw new TypeError('offline');
  });
  await assert.rejects(analyzeTaxCheckApi(input()), failure('network', true));
  await assert.rejects(
    simulateTaxCheckApi(fixture(), input()),
    failure('network'),
  );
});
test('TaxCheck: timeout stops waiting without retrying or claiming a save was rolled back', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const mock = t.mock.method(
    globalThis,
    'fetch',
    (_url, options) =>
      new Promise((_resolve, reject) => {
        options.signal.addEventListener(
          'abort',
          () => reject(new DOMException('Aborted', 'AbortError')),
          { once: true },
        );
      }),
  );
  const promise = analyzeTaxCheckApi(input());
  const check = assert.rejects(promise, failure('timeout', true));
  t.mock.timers.tick(15000);
  await check;
  assert.equal(mock.mock.callCount(), 1);
});
test('TaxCheck: pre-aborted caller never sends a POST', async (t) => {
  const mock = respond(t, fixture());
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(analyzeTaxCheckApi(input(), controller.signal));
  assert.equal(mock.mock.callCount(), 0);
});
test('TaxCheck: invalid IDs, simulation sources and inputs never send requests', async (t) => {
  const mock = respond(t, fixture());
  for (const id of [0, -1, 1.2, Number.MAX_SAFE_INTEGER + 1])
    await assert.rejects(getTaxCheckApi(id), failure('input'));
  await assert.rejects(
    simulateTaxCheckApi(simulated(), input()),
    failure('input'),
  );
  const invalid = input();
  invalid.taxDocumentId = 1;
  await assert.rejects(analyzeTaxCheckApi(invalid), failure('input'));
  const incomplete = input();
  delete incomplete.conditions.isHomeless;
  await assert.rejects(analyzeTaxCheckApi(incomplete), failure('input'));
  assert.equal(mock.mock.callCount(), 0);
});
