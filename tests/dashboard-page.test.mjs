import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
async function compile(path) {
  return ts.transpileModule(
    await readFile(new URL(path, import.meta.url), 'utf8'),
    {
      fileName: path,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    },
  ).outputText;
}
function evaluate(code, dependencies = {}) {
  const module = { exports: {} };
  runInNewContext(code, {
    module,
    exports: module.exports,
    require: (name) => dependencies[name] ?? require(name),
  });
  return module.exports;
}
const pageCode = await compile('../app/dashboard/page.tsx');
const copy = evaluate(await compile('../app/dashboard/dashboard-copy.ts'));
const format = evaluate(await compile('../lib/paycycle/format.ts'));

// Isolated markup tests, not browser/E2E tests. Supply the two page hook states;
// React's server renderer does not execute effects or make backend requests.
function render(load, revision = 0) {
  let hookIndex = 0;
  const states = [revision, load];
  const state = {
    profile: { nickname: 'demo' },
    employment: null,
    events: [],
    payRecords: [{ period: 'LOCAL-ONLY-RECORD' }],
  };
  const { default: Page } = evaluate(pageCode, {
    react: { ...React, useState: () => [states[hookIndex++], () => {}] },
    'lucide-react': Object.fromEntries(
      [
        'CalendarClock',
        'ChevronRight',
        'History',
        'Plane',
        'Receipt',
        'Wallet',
      ].map((name) => [name, () => null]),
    ),
    'next/link': ({ href, children, ...props }) =>
      React.createElement('a', { href, ...props }, children),
    '@/components/app-shell': {
      AppShell: ({ children }) => React.createElement('main', null, children),
    },
    '@/components/ui/button': {
      Button: ({ children, variant: _variant, size: _size, ...props }) =>
        React.createElement('button', { ...props, type: 'button' }, children),
    },
    '@/i18n': { useT: () => ({ locale: 'ko', t: (key) => key }) },
    '@/lib/paycycle/format': format,
    '@/lib/paycycle/rule-engine': { dDay: () => 0 },
    '@/services/records-api': {
      getDashboardApi: () => {
        throw new Error('Unexpected API call during markup test');
      },
    },
    '@/state/paycycle-context': {
      usePayCycle: () => ({
        state,
        hydrated: true,
        yearlyPay: 999999999,
        monthsRecorded: 12,
      }),
    },
    './dashboard-copy': copy,
  });
  return renderToStaticMarkup(React.createElement(Page));
}

function ready(summary = {}, overrides = {}) {
  return {
    revision: 0,
    phase: 'ready',
    data: {
      year: 2026,
      paySummary: {
        totalReceivedPay: 2380000,
        recordedMonths: 1,
        amountKnownMonths: 1,
        recordedPeriods: ['2026-07'],
        missingAmountPeriods: [],
        ...summary,
      },
      latestPaycheck: null,
      latestTaxCheck: null,
      latestExitCheck: null,
      recentRecords: [],
      ...overrides,
    },
  };
}

test('render server total and server year, never the context pay total', () => {
  const html = render(ready());
  assert.ok(html.includes('2026 · 기록된 실입금 합계'));
  assert.ok(html.includes(copy.dashboardMoney(2380000, 'ko')));
  assert.ok(!html.includes('999,999,999'));
  assert.ok(!html.includes('LOCAL-ONLY-RECORD'));
});

test('render a confirmed zero as money rather than an empty state', () => {
  const html = render(ready({ totalReceivedPay: 0 }));
  assert.ok(html.includes(copy.dashboardMoney(0, 'ko')));
  assert.ok(!html.includes('home.noSalaryRecorded'));
});

test('render unknown amounts and registered missing months explicitly', () => {
  const html = render(
    ready({
      totalReceivedPay: null,
      amountKnownMonths: 0,
      missingAmountPeriods: ['2026-07'],
    }),
  );
  assert.ok(html.includes(copy.DASHBOARD_COPY.ko.unknownAmount));
  assert.ok(html.includes('2026-07'));
  assert.ok(!html.includes('home.noSalaryRecorded'));
});

test('render genuinely empty salary and history independently', () => {
  const html = render(
    ready({
      totalReceivedPay: null,
      recordedMonths: 0,
      amountKnownMonths: 0,
      recordedPeriods: [],
    }),
  );
  assert.ok(html.includes('home.noSalaryRecorded'));
  assert.ok(html.includes(copy.DASHBOARD_COPY.ko.emptyRecent));
  assert.ok(html.includes(copy.DASHBOARD_COPY.ko.noExit));
});

test('render loading and errors separately from empty records', () => {
  const loading = render(null);
  assert.ok(loading.includes('<output'));
  assert.ok(!loading.includes(copy.DASHBOARD_COPY.ko.emptyRecent));
  const error = render({ revision: 0, phase: 'error' });
  assert.ok(error.includes('role="alert"'));
  assert.ok(error.includes(copy.DASHBOARD_COPY.ko.retry));
  assert.ok(!error.includes('dashboard-pay-title'));
  assert.ok(!error.includes(copy.DASHBOARD_COPY.ko.emptyRecent));
});

test('refresh hides the previous request result while loading', () => {
  const html = render(ready(), 1);
  assert.ok(html.includes('<output'));
  assert.ok(!html.includes('dashboard-pay-title'));
});

test('render original record year, saved text and escaped HTML', () => {
  const tax = {
    recordKey: 'TAX_CHECK:1',
    type: 'TAX_CHECK',
    sourceId: 1,
    taxYear: 2025,
    recordedAt: '2026-09-02T13:00:00',
    status: 'REVIEW_REQUIRED',
    analysisSummary: '<script>alert(1)</script>',
    nextAction: '저장된 다음 행동',
  };
  const html = render(ready({}, { latestTaxCheck: tax, recentRecords: [tax] }));
  assert.ok(html.includes('귀속연도: 2025'));
  assert.ok(html.includes('2026.09.02'));
  assert.ok(html.includes('TAX_CHECK:1'));
  assert.ok(html.includes('저장된 다음 행동'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('<script>'));
});
