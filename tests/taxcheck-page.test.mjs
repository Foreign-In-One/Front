import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  api,
  compile,
  copyTools,
  evaluate,
  fixture,
  formTools,
  plain,
  simulated,
} from './taxcheck-test-helpers.mjs';

const pageCode = await compile('../app/taxcheck/page.tsx');
const resultCode = await compile('../app/taxcheck/taxcheck-result.tsx');
const icons = Object.fromEntries(
  ['ArrowLeft', 'ArrowRight', 'Receipt', 'RotateCcw', 'ExternalLink'].map(
    (name) => [name, () => null],
  ),
);
const { TaxResultView } = evaluate(resultCode, {
  'lucide-react': icons,
  './taxcheck-form': formTools,
});
const copy = copyTools.TAX_COPY.ko;
const settle = () => new Promise((resolve) => setImmediate(resolve));
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
function text(node) {
  if (node === null || node === undefined || typeof node === 'boolean')
    return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(text).join('');
  return text(node.props?.children).trim();
}
function flatten(node) {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(flatten);
  if (typeof node.type === 'function') return flatten(node.type(node.props));
  return [node, ...flatten(node.props?.children)];
}

// Small isolated hook harness: exercises actual page handlers/effects with mocked
// API calls. Not a real browser, React scheduler, CSS layout or backend E2E test.
function mount({
  url = 'http://localhost:3000/taxcheck',
  overrides = {},
} = {}) {
  const slots = [];
  let cursor = 0;
  let effects = [];
  let locale = 'ko';
  let disposed = false;
  let lateUpdates = 0;
  const calls = { get: [], analyze: [], simulate: [] };
  const win = {
    location: { href: url },
    history: {
      state: { preserved: true },
      replaceState(state, _unused, next) {
        this.state = state;
        win.location.href = String(next);
      },
    },
  };
  const same = (a, b) =>
    a &&
    b &&
    a.length === b.length &&
    a.every((value, index) => Object.is(value, b[index]));
  const hooks = {
    ...React,
    useState(initial) {
      const index = cursor++;
      if (!(index in slots))
        slots[index] = typeof initial === 'function' ? initial() : initial;
      return [
        slots[index],
        (next) => {
          if (disposed) lateUpdates++;
          slots[index] = typeof next === 'function' ? next(slots[index]) : next;
        },
      ];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useCallback(callback, deps) {
      const index = cursor++;
      if (!slots[index] || !same(slots[index].deps, deps))
        slots[index] = { value: callback, deps };
      return slots[index].value;
    },
    useEffect(callback, deps) {
      const index = cursor++;
      if (!slots[index] || !same(slots[index].deps, deps)) {
        effects.push(() => {
          slots[index]?.cleanup?.();
          slots[index] = { deps, callback, cleanup: callback() };
        });
      }
    },
  };
  const service = { TaxApiError: api.TaxApiError };
  for (const [name, kind, value] of [
    ['getTaxCheckApi', 'get', fixture],
    ['analyzeTaxCheckApi', 'analyze', fixture],
    ['simulateTaxCheckApi', 'simulate', simulated],
  ])
    service[name] = (...args) => {
      calls[kind].push(args);
      return overrides[kind]
        ? overrides[kind](...args)
        : Promise.resolve(value());
    };
  const { default: Page } = evaluate(
    pageCode,
    {
      react: hooks,
      'lucide-react': icons,
      'next/link': ({ children, ...props }) =>
        React.createElement('a', props, children),
      '@/components/app-shell': {
        AppShell: ({ children }) => React.createElement('main', null, children),
      },
      '@/components/ui/button': {
        Button: ({ children, variant: _variant, ...props }) =>
          React.createElement('button', { type: 'button', ...props }, children),
      },
      '@/i18n': { useT: () => ({ locale, t: (key) => key }) },
      '@/services/taxcheck-api': service,
      './taxcheck-form': formTools,
      './taxcheck-copy': copyTools,
      './taxcheck-result': { TaxResultView },
    },
    { window: win },
  );
  function tree() {
    cursor = 0;
    return Page();
  }
  function nodes() {
    return flatten(tree());
  }
  function find(predicate) {
    const found = nodes().find(predicate);
    assert.ok(found, 'Expected page control to exist');
    return found;
  }
  function click(label) {
    const button = find(
      (node) => node.type === 'button' && text(node) === label,
    );
    assert.ok(!button.props.disabled, `Button disabled: ${label}`);
    button.props.onClick();
  }
  function change(id, value) {
    const control = find((node) => node.props?.id === id);
    assert.ok(!control.props.disabled, `Control disabled: ${id}`);
    control.props.onChange({ target: { value, checked: value } });
  }
  function flush() {
    const pending = effects;
    effects = [];
    for (const effect of pending) effect();
  }
  tree();
  flush();
  return {
    calls,
    win,
    tree,
    nodes,
    find,
    click,
    change,
    flush,
    html: () => renderToStaticMarkup(tree()),
    setLocale: (next) => {
      locale = next;
      tree();
      flush();
    },
    unmount: () => {
      disposed = true;
      for (const slot of slots) slot?.cleanup?.();
    },
    lateUpdates: () => lateUpdates,
    // Models Strict Mode's initial effect cleanup/setup, without a second POST.
    replayEffects: () => {
      for (const slot of slots)
        if (slot?.callback) {
          slot.cleanup?.();
          slot.cleanup = slot.callback();
        }
    },
  };
}
function enterReview(page) {
  page.click('common.start');
  page.change('tax-year', '2026');
  page.change('annual-income', '30000000');
  page.change('non-taxable-income', '2000000');
  page.change('income-confirmed', true);
  page.click('common.next');
  page.click('common.next');
}

test('Tax page: entering, advancing and changing language never auto-analyze', () => {
  const page = mount();
  enterReview(page);
  page.setLocale('en');
  assert.equal(page.calls.analyze.length, 0);
  assert.equal(page.calls.simulate.length, 0);
  assert.equal(page.calls.get.length, 0);
  assert.match(page.html(), /Analyze and save to server/);
});
test('Tax page: explicit save locks same-tick double clicks and writes a reload URL', async () => {
  const pending = deferred();
  const page = mount({ overrides: { analyze: () => pending.promise } });
  enterReview(page);
  const save = page.find(
    (node) => node.type === 'button' && text(node) === copy.save,
  );
  save.props.onClick();
  save.props.onClick();
  assert.equal(page.calls.analyze.length, 1);
  assert.deepEqual(plain(page.calls.analyze[0][0].income), fixture().income);
  assert.match(page.html(), /서버에 분석 요청 중/);
  pending.resolve(fixture());
  await settle();
  assert.match(page.win.location.href, /taxCheckId=1/);
  assert.deepEqual(page.win.history.state, { preserved: true });
  assert.match(page.html(), /6,080,000/);
  assert.match(page.html(), /2,380,000/);
  page.setLocale('vi');
  page.tree();
  page.flush();
  assert.equal(page.calls.analyze.length, 1);
});
test('Tax page: saved URL refresh performs GET only, including effect replay', async () => {
  const page = mount({ url: 'http://localhost:3000/taxcheck?taxCheckId=1' });
  page.replayEffects();
  await settle();
  assert.equal(page.calls.get.length, 2);
  assert.equal(page.calls.get[0][1].aborted, true);
  assert.equal(page.calls.analyze.length, 0);
  assert.match(page.html(), /서버에 저장된 분석/);
});
test('Tax page: invalid URL never fetches or auto-creates a result', () => {
  const page = mount({ url: 'http://localhost:3000/taxcheck?taxCheckId=0' });
  assert.match(page.html(), /분석 ID가 올바르지/);
  assert.deepEqual(page.calls, { get: [], analyze: [], simulate: [] });
});
test('Tax page: read error has GET retry and no local fallback', async () => {
  let attempt = 0;
  const page = mount({
    url: 'http://localhost:3000/taxcheck?taxCheckId=1',
    overrides: {
      get: () =>
        ++attempt === 1
          ? Promise.reject(new Error('offline'))
          : Promise.resolve(fixture()),
    },
  });
  await settle();
  assert.match(page.html(), /저장된 분석을 불러오지 못했습니다/);
  assert.doesNotMatch(page.html(), /6,080,000/);
  page.click(copy.retry);
  await settle();
  assert.equal(page.calls.get.length, 2);
  assert.equal(page.calls.analyze.length, 0);
  assert.match(page.html(), /6,080,000/);
});
test('Tax page: income edits clear confirmation and unknown housing clears proof', () => {
  const page = mount();
  page.click('common.start');
  page.change('income-confirmed', true);
  page.change('annual-income', '100');
  assert.equal(
    page.find((node) => node.props?.id === 'income-confirmed').props.checked,
    false,
  );
  page.change('income-confirmed', true);
  page.change('tax-year', '2025');
  assert.equal(
    page.find((node) => node.props?.id === 'income-confirmed').props.checked,
    false,
  );
  page.click('common.next');
  page.change('housingSaving', 'true');
  page.change('housingSavingProof', 'true');
  page.change('housingSaving', '');
  page.click('common.next');
  page.click(copy.save);
  assert.equal(page.calls.analyze[0][0].conditions.housingSavingProof, null);
  assert.equal(page.calls.analyze[0][0].conditions.housingSaving, null);
});
test('Tax page: malformed amount blocks advancement and requests', () => {
  const page = mount();
  page.click('common.start');
  page.change('annual-income', '1,000');
  page.click('common.next');
  assert.match(page.html(), /쉼표·음수·지수/);
  assert.equal(page.calls.analyze.length, 0);
});
test('Tax page: simulation uses original year, never saves and restores original amount', async () => {
  const page = mount({ url: 'http://localhost:3000/taxcheck?taxCheckId=1' });
  await settle();
  page.click(copy.simulate);
  assert.equal(
    page.find((node) => node.props?.id === 'tax-year').props.disabled,
    true,
  );
  assert.equal(
    page.find((node) => node.props?.id === 'income-confirmed').props.checked,
    false,
  );
  page.change('annual-income', '40000000');
  page.change('income-confirmed', true);
  page.click('common.next');
  page.click('common.next');
  page.click(copy.runSimulation);
  await settle();
  assert.equal(page.calls.simulate.length, 1);
  assert.equal(page.calls.analyze.length, 0);
  assert.equal(page.calls.simulate[0][0].taxCheckId, 1);
  assert.equal(page.calls.simulate[0][1].taxYear, undefined);
  assert.match(page.html(), /7,980,000/);
  assert.match(page.html(), /저장하지 않은 시뮬레이션/);
  assert.match(page.win.location.href, /taxCheckId=1/);
  page.click(copy.restore);
  assert.match(page.html(), /6,080,000/);
  assert.doesNotMatch(page.html(), /7,980,000/);
  assert.equal(page.calls.analyze.length, 0);
});
test('Tax page: simulation failure does not fall back to saved analysis', async () => {
  const page = mount({
    url: 'http://localhost:3000/taxcheck?taxCheckId=1',
    overrides: {
      simulate: () => Promise.reject(new api.TaxApiError('network')),
    },
  });
  await settle();
  page.click(copy.simulate);
  page.click('common.next');
  page.click('common.next');
  page.click(copy.runSimulation);
  await settle();
  assert.equal(page.calls.analyze.length, 0);
  assert.equal(page.calls.simulate.length, 1);
  assert.match(page.html(), /요청을 처리하지 못했습니다/);
  page.click(copy.restore);
  assert.match(page.html(), /6,080,000/);
});
test('Tax page: uncertain save blocks duplicate retry until records-risk acknowledgement', async () => {
  const page = mount({
    overrides: {
      analyze: () =>
        Promise.reject(new api.TaxApiError('network', undefined, true)),
    },
  });
  enterReview(page);
  page.click(copy.save);
  await settle();
  assert.match(page.html(), /서버에는 이미 저장됐을 수 있습니다/);
  const save = page.find(
    (node) => node.type === 'button' && text(node) === copy.save,
  );
  assert.equal(save.props.disabled, true);
  save.props.onClick();
  assert.equal(page.calls.analyze.length, 1);
  const acknowledgement = page.find(
    (node) => node.type === 'input' && node.props.type === 'checkbox',
  );
  acknowledgement.props.onChange({ target: { checked: true } });
  page.click(copy.save);
  await settle();
  assert.equal(page.calls.analyze.length, 2);
});
test('Tax page: navigating back and invalid input cannot erase uncertain-save warning', async () => {
  const page = mount({
    overrides: {
      analyze: () =>
        Promise.reject(new api.TaxApiError('network', undefined, true)),
    },
  });
  enterReview(page);
  page.click(copy.save);
  await settle();
  page.click('common.prev');
  page.click('common.prev');
  page.change('annual-income', '-1');
  page.click('common.next');
  assert.match(page.html(), /서버에는 이미 저장됐을 수 있습니다/);
  page.change('annual-income', '30000000');
  page.click('common.next');
  assert.equal(page.calls.analyze.length, 1);
  assert.match(page.html(), /서버에는 이미 저장됐을 수 있습니다/);
});
test('Tax page: unmount aborts waiting and ignores a late save response', async () => {
  const pending = deferred();
  const page = mount({ overrides: { analyze: () => pending.promise } });
  enterReview(page);
  page.click(copy.save);
  const signal = page.calls.analyze[0][1];
  page.unmount();
  assert.equal(signal.aborted, true);
  pending.resolve(fixture());
  await settle();
  assert.equal(page.lateUpdates(), 0);
  assert.doesNotMatch(page.win.location.href, /taxCheckId/);
});
test('Tax page: starting new analysis clears URL but never deletes saved records', async () => {
  const page = mount({ url: 'http://localhost:3000/taxcheck?taxCheckId=1' });
  await settle();
  page.click(copy.newAnalysis);
  assert.doesNotMatch(page.win.location.href, /taxCheckId/);
  assert.equal(page.calls.analyze.length, 0);
  assert.equal(page.calls.simulate.length, 0);
});
test('Tax result: null is not zero, raw text is escaped, simulation date remains source date', () => {
  const data = simulated();
  data.result.flatTaxEstimate = null;
  data.result.calculation.incomeBase = null;
  data.result.cards[0].summary = '<script>alert(1)</script>';
  data.paySummary = {
    totalReceivedPay: null,
    recordedMonths: 1,
    amountKnownMonths: 0,
    recordedPeriods: ['2026-07'],
    missingAmountPeriods: ['2026-07'],
  };
  const html = renderToStaticMarkup(
    React.createElement(TaxResultView, { data, copy, locale: 'ko' }),
  );
  assert.match(html, /계산하지 않음/);
  assert.match(html, /입금액 미확인/);
  assert.match(html, /원본 분석일/);
  assert.match(html, /2026-09-02 15:00:00/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /noopener noreferrer/);
  data.result.flatTaxEstimate = 0;
  const zero = renderToStaticMarkup(
    React.createElement(TaxResultView, { data, copy, locale: 'ko' }),
  );
  assert.match(zero, /₩0/);
});
test('Tax page: no local rule-engine, browser result storage, financial annualization or OCR', async () => {
  const source = await readFile(
    new URL('../app/taxcheck/page.tsx', import.meta.url),
    'utf8',
  );
  assert.doesNotMatch(
    source,
    /evaluateTax|saveTaxCheckResult|localStorage|usePayCycle|yearlyPay|fetch\(/,
  );
  assert.match(source, /analyzeTaxCheckApi/);
  assert.match(source, /simulateTaxCheckApi/);
});
