import assert from 'node:assert/strict';
import test from 'node:test';
import {
  copyTools,
  formTools as f,
  fixture,
  plain,
} from './taxcheck-test-helpers.mjs';

const now = new Date('2026-09-03T00:00:00Z');
test('Tax form: defaults to previous completed Korean year with unknown amounts and answers', () => {
  const form = f.emptyTaxForm(now);
  assert.equal(form.taxYear, '2025');
  assert.equal(form.annualIncome, '');
  assert.equal(form.nonTaxableIncome, '');
  assert.equal(form.confirmed, false);
  assert.deepEqual(Object.values(form.conditions), [null, null, null, null]);
  assert.equal(f.koreaYear(new Date('2025-12-31T15:00:00Z')), 2026);
  assert.equal(
    f.emptyTaxForm(new Date('2025-12-31T14:59:59Z')).taxYear,
    '2024',
  );
});
test('Tax form: blank/null differs from a confirmed zero and decimal values', () => {
  const form = f.emptyTaxForm(now);
  let request = f.taxRequest(form, now);
  assert.equal(request.income.annualIncome, null);
  assert.equal(request.income.nonTaxableIncome, null);
  form.annualIncome = '0';
  form.nonTaxableIncome = '12.34';
  form.confirmed = true;
  request = f.taxRequest(form, now);
  assert.deepEqual(plain(request.income), {
    annualIncome: 0,
    nonTaxableIncome: 12.34,
    confirmed: true,
  });
  assert.equal(request.taxDocumentId, null);
  assert.equal(request.paySummary, undefined);
});
for (const amount of [
  '-1',
  '1,000',
  '1e3',
  'NaN',
  'Infinity',
  '1.001',
  '10000000000000',
  '.5',
  '+5',
]) {
  test(`Tax form: rejects malformed/out-of-range amount ${amount}`, () => {
    const form = { ...f.emptyTaxForm(now), annualIncome: amount };
    assert.equal(f.validateTaxForm(form, now), 'annualIncome');
    assert.throws(() => f.taxRequest(form, now));
  });
}
test('Tax form: exact decimal combined limit does not depend on float rounding', () => {
  const form = {
    ...f.emptyTaxForm(now),
    annualIncome: '9999999999999.98',
    nonTaxableIncome: '0.01',
    confirmed: true,
  };
  assert.equal(f.validateTaxForm(form, now), null);
  form.nonTaxableIncome = '0.02';
  assert.equal(f.validateTaxForm(form, now), 'total');
  form.confirmed = false;
  assert.equal(f.validateTaxForm(form, now), null);
});
for (const year of ['2000', '2024', '2025', '2026', '2027']) {
  test(`Tax form: confirmed sum limit applies to allowed year ${year}`, () => {
    const futureNow = new Date('2027-06-01T00:00:00Z');
    const form = {
      ...f.emptyTaxForm(futureNow),
      taxYear: year,
      annualIncome: '9999999999999.98',
      nonTaxableIncome: '0.01',
      confirmed: true,
    };
    assert.equal(f.validateTaxForm(form, futureNow), null);
    form.nonTaxableIncome = '0.02';
    assert.equal(f.validateTaxForm(form, futureNow), 'total');
    assert.throws(() => f.taxRequest(form, futureNow), /total/);
    form.confirmed = false;
    assert.equal(f.validateTaxForm(form, futureNow), null);
    form.confirmed = true;
    form.nonTaxableIncome = '';
    assert.equal(f.validateTaxForm(form, futureNow), null);
  });
}
for (const year of ['1999', '2027', '2101', '20e2', ' 2026', '2026.0', '']) {
  test(`Tax form: rejects invalid or future year ${year}`, () => {
    assert.equal(
      f.validateTaxForm({ ...f.emptyTaxForm(now), taxYear: year }, now),
      'year',
    );
  });
}
test('Tax form: unsupported past rule year is sent, not calculated by the frontend', () => {
  const form = { ...f.emptyTaxForm(now), taxYear: '2024' };
  assert.equal(f.taxRequest(form, now).taxYear, 2024);
});
test('Tax form: restoring an original preserves income, not Paycheck total, and clones answers', () => {
  const original = fixture();
  const form = f.formFromTax(original);
  assert.equal(form.annualIncome, '30000000');
  assert.equal(form.nonTaxableIncome, '2000000');
  form.conditions.housingSaving = true;
  assert.equal(original.conditions.housingSaving, null);
  original.income = null;
  original.conditions = null;
  assert.equal(f.formFromTax(original).annualIncome, '');
});
test('Tax form: money null is unavailable, real zero remains zero', () => {
  assert.equal(f.taxMoney(null, 'ko', '미계산'), '미계산');
  assert.match(f.taxMoney(0, 'ko', '미계산'), /0/);
  assert.match(f.taxMoney(6080000, 'ko', '미계산'), /6,080,000/);
});
for (const query of [
  '?taxCheckId=0',
  '?taxCheckId=-1',
  '?taxCheckId=1.2',
  '?taxCheckId=01',
  '?taxCheckId=',
  '?taxCheckId=1&taxCheckId=2',
  '?taxCheckId=9007199254740992',
]) {
  test(`Tax form: rejects invalid saved-result URL ${query}`, () => {
    assert.throws(() =>
      f.taxIdFromUrl(`http://localhost:3000/taxcheck${query}`),
    );
  });
}
test('Tax form: saved-result ID parsing and no-ID landing page', () => {
  assert.equal(f.taxIdFromUrl('http://localhost:3000/taxcheck'), null);
  assert.equal(
    f.taxIdFromUrl('http://localhost:3000/taxcheck?taxCheckId=1'),
    1,
  );
});
test('Tax copy: every supported locale supplies every nonempty UI label', () => {
  const copies = copyTools.TAX_COPY;
  for (const locale of ['ko', 'en', 'vi', 'zh']) {
    assert.deepEqual(
      Object.keys(copies[locale]).sort(),
      Object.keys(copies.ko).sort(),
    );
    assert.ok(
      Object.values(copies[locale]).every(
        (value) => typeof value === 'string' && value.trim().length > 0,
      ),
    );
  }
});
