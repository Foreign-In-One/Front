import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const require = createRequire(import.meta.url);
export async function compile(path, module = ts.ModuleKind.CommonJS) {
  return ts.transpileModule(
    await readFile(new URL(path, import.meta.url), 'utf8'),
    {
      fileName: path,
      compilerOptions: {
        module,
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    },
  ).outputText;
}
export function evaluate(code, dependencies = {}, globals = {}) {
  const module = { exports: {} };
  runInNewContext(code, {
    module,
    exports: module.exports,
    URL,
    Date,
    Intl,
    BigInt,
    AbortController,
    require: (name) => dependencies[name] ?? require(name),
    ...globals,
  });
  return module.exports;
}
const dataUrl = (code) =>
  `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
const records = dataUrl(
  await compile('../services/records-api.ts', ts.ModuleKind.ESNext),
);
const source = await compile(
  '../services/taxcheck-api.ts',
  ts.ModuleKind.ESNext,
);
const priorBase = process.env.NEXT_PUBLIC_API_BASE_URL;
process.env.NEXT_PUBLIC_API_BASE_URL = 'http://taxcheck.test/';
export const api = await import(
  dataUrl(source.replace(/(['"])\.\/records-api\1/, JSON.stringify(records)))
);
if (priorBase === undefined) delete process.env.NEXT_PUBLIC_API_BASE_URL;
else process.env.NEXT_PUBLIC_API_BASE_URL = priorBase;
export const formTools = evaluate(
  await compile('../app/taxcheck/taxcheck-form.ts'),
);
export const copyTools = evaluate(
  await compile('../app/taxcheck/taxcheck-copy.ts'),
);
export const plain = (value) => JSON.parse(JSON.stringify(value));
export const fixture = () => ({
  taxCheckId: 1,
  sourceTaxCheckId: null,
  simulation: false,
  taxYear: 2026,
  taxDocumentId: null,
  income: {
    annualIncome: 30000000,
    nonTaxableIncome: 2000000,
    confirmed: true,
  },
  conditions: {
    housingSaving: null,
    isHomeless: null,
    housingSavingProof: null,
    usesDeductions: false,
  },
  paySummary: {
    totalReceivedPay: 2380000,
    recordedMonths: 1,
    amountKnownMonths: 1,
    recordedPeriods: ['2026-07'],
    missingAmountPeriods: [],
  },
  analyzedAt: '2026-09-02T15:00:00',
  result: {
    annualIncome: 30000000,
    flatTaxEstimate: 6080000,
    generalTaxEstimate: null,
    taxDifference: null,
    residentStatus: 'REVIEW_REQUIRED',
    elapsedDaysReference: 200,
    status: 'REVIEW_REQUIRED',
    cards: [
      {
        id: 'flat',
        title: '단일세율',
        status: 'REVIEW_REQUIRED',
        tone: 'need',
        summary: '서버 분석 원문',
        confirmed: [],
        missing: ['자격 확인'],
        nextActions: ['자료 확인'],
        evidence: [{ title: '국세청 자료', url: 'https://www.nts.go.kr/' }],
      },
    ],
    requiredDocuments: ['근로소득 원천징수영수증'],
    analysisSummary: '19% 적용 가정 참고값입니다.',
    nextAction: '자료와 적용 자격을 확인하세요.',
    calculation: {
      mode: 'FLAT_19_ASSUMPTION',
      ruleVersion: 'taxcheck-manual-reference-v1',
      rate: 0.19,
      incomeBase: 32000000,
      eligibilityConfirmed: false,
      missingFields: [],
      warnings: ['일반세율 비교·지방소득세는 계산하지 않습니다.'],
    },
  },
});
export const input = () => {
  const data = fixture();
  return {
    taxYear: data.taxYear,
    taxDocumentId: null,
    income: data.income,
    conditions: data.conditions,
  };
};
export const simulated = () => {
  const data = fixture();
  data.taxCheckId = null;
  data.sourceTaxCheckId = 1;
  data.simulation = true;
  data.income.annualIncome = 40000000;
  data.result.annualIncome = 40000000;
  data.result.flatTaxEstimate = 7980000;
  data.result.calculation.incomeBase = 42000000;
  return data;
};
