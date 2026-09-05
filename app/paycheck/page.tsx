'use client';

import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Eye,
  FileText,
  History,
  Landmark,
  Loader2,
  Receipt,
  ShieldCheck,
  Sparkles,
  Upload,
  Wallet,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { AppShell } from '@/components/app-shell';
import { AnalysisReport } from '@/components/paycheck/analysis-report';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { WizardStart, WizardStep } from '@/components/wizard';
import { useT } from '@/i18n';
import {
  daysBetween,
  formatKDate,
  isoDate,
  monthLabel,
  payDayIso,
  uid,
  won,
} from '@/lib/paycycle/format';
import { analyzePaycheck } from '@/lib/paycycle/rule-engine';
import type {
  DocFields,
  DocKind,
  PaycheckAnalysis,
  PayDocument,
  PayDocuments,
  PayFinding,
  PayRecord,
} from '@/lib/paycycle/types';
import { emptyFields } from '@/lib/paycycle/types';
import {
  analyzePaycheckApi,
  type CandidateAmountDto,
  getMockBankTransactionsApi,
  type MockBankTransactionDto,
  updateDocumentExtractedDataApi,
} from '@/services/api';
import { readDocument } from '@/services/ocr';
import { usePayCycle } from '@/state/paycycle-context';

const DOC_ORDER: DocKind[] = ['contract', 'statement', 'deposit'];

const DOC_META: Record<
  DocKind,
  { labelKey: string; hintKey: string; stepKey: string; icon: typeof FileText }
> = {
  contract: {
    labelKey: 'pay.doc.contract',
    hintKey: 'pay.doc.contract.h',
    stepKey: 'pay.step1',
    icon: FileText,
  },
  statement: {
    labelKey: 'pay.doc.statement',
    hintKey: 'pay.doc.statement.h',
    stepKey: 'pay.step2',
    icon: Receipt,
  },
  deposit: {
    labelKey: 'pay.doc.deposit',
    hintKey: 'pay.doc.deposit.h',
    stepKey: 'pay.step3',
    icon: Landmark,
  },
};

const FIELD_LABEL_KEYS: Record<keyof Omit<DocFields, 'period'>, string> = {
  basePay: 'pay.field.basePay',
  allowances: 'pay.field.allowances',
  deductions: 'pay.field.deductions',
  netPay: 'pay.field.netPay',
  payDay: 'pay.field.payDay',
  payDate: 'pay.field.payDate',
};

function translateCandidateLabel(
  rawLabel: string,
  t: (key: string) => string,
): string {
  const norm = rawLabel.trim();
  if (norm.includes('기본급') || norm.toLowerCase().includes('base'))
    return t('pay.field.basePay');
  if (
    norm.includes('실지급') ||
    norm.includes('실수령') ||
    norm.includes('차인지급') ||
    norm.toLowerCase().includes('net')
  )
    return t('pay.field.netPay');
  if (norm.includes('실입금') || norm.includes('입금액'))
    return t('pay.field.netPay');
  if (norm.includes('연장') || norm.toLowerCase().includes('overtime'))
    return t('pay.field.overtimeAllowance');
  if (
    norm.includes('지급총액') ||
    norm.includes('총지급') ||
    norm.toLowerCase().includes('gross') ||
    norm.includes('월급여총액')
  )
    return t('pay.field.totalPayment');
  if (norm.includes('공제') || norm.toLowerCase().includes('deduction'))
    return t('pay.field.deductions');
  if (norm.includes('식대') || norm.toLowerCase().includes('meal'))
    return t('pay.field.allowances');
  if (norm.includes('수당') || norm.toLowerCase().includes('allowance'))
    return t('pay.field.allowances');
  if (norm.includes('잔액') || norm.toLowerCase().includes('balance'))
    return t('pay.field.afterBalance');
  return rawLabel;
}

function isCandidateRecommended(kind: DocKind, label: string): boolean {
  const norm = label.trim().toLowerCase();
  if (kind === 'contract') {
    return (
      norm.includes('기본급') || norm.includes('base') || norm.includes('월급')
    );
  }
  if (kind === 'statement') {
    return (
      norm.includes('실지급') ||
      norm.includes('실수령') ||
      norm.includes('차인지급') ||
      norm.includes('net')
    );
  }
  if (kind === 'deposit') {
    return (
      norm.includes('실입금') ||
      norm.includes('입금액') ||
      norm.includes('급여') ||
      norm.includes('net')
    );
  }
  return false;
}

/** 백엔드 미동작 시 제공할 명시적 최근 2개월치 Fallback Mock 급여 확인 기록 */
const MOCK_FALLBACK_RECORDS: PayRecord[] = [
  {
    id: 'pay-mock-2025-03',
    period: '2025-03',
    workplace: '(주)페이사이클 제이이노베이션',
    checkedAt: '2025-03-25',
    paidAmount: 2050000,
    documents: {
      contract: {
        kind: 'contract',
        source: 'sample',
        fileName: 'contract-sample.png',
        fields: {
          period: '2025-03',
          basePay: 2100000,
          allowances: null,
          deductions: null,
          netPay: 2100000,
          payDay: 25,
          payDate: null,
        },
        confirmed: true,
        masked: false,
        note: '계약 기본급 2,100,000원 확인',
      },
      statement: {
        kind: 'statement',
        source: 'sample',
        fileName: 'statement-sample.png',
        fields: {
          period: '2025-03',
          basePay: 2100000,
          allowances: null,
          deductions: null,
          netPay: 2100000,
          payDay: null,
          payDate: '2025-03-25',
        },
        confirmed: true,
        masked: false,
        note: '명세서 실지급액 2,100,000원 확인',
      },
      deposit: {
        kind: 'deposit',
        source: 'sample',
        fileName: 'deposit-sample.png',
        fields: {
          period: '2025-03',
          basePay: null,
          allowances: null,
          deductions: null,
          netPay: 2050000,
          payDay: null,
          payDate: '2025-03-25',
        },
        confirmed: true,
        masked: false,
        note: '실지급 입금액 2,050,000원 확인',
      },
    },
    analysis: {
      overallStatus: 'EXPLANATION_REQUIRED',
      headline: '명세서 실지급액과 입금액 간 50,000원 차이 발생',
      detail:
        '근로기준법 기준 3중 대조 결과 차액 50,000원에 대한 설명이 필요합니다.',
      steps: [
        {
          label: '근로계약서 확인',
          ok: true,
          detail: '기본급 2,100,000원 대조 완료',
        },
        {
          label: '임금명세서 판독',
          ok: true,
          detail: '실지급액 2,100,000원 대조 완료',
        },
        {
          label: '실입금액 대조',
          ok: false,
          detail: '통장 실입금액 2,050,000원 (50,000원 차이)',
        },
      ],
      findings: [
        {
          id: 'net',
          status: 'EXPLANATION_REQUIRED',
          title: '명세서와 실제 입금액 차이',
          fact: '임금명세서의 실지급액은 2,100,000원인데 실제 입금액은 2,050,000원으로 50,000원의 차액이 발생했습니다.',
          standard: '근로기준법 제43조(임금 지급)',
          limitation: '별도 차액 공제 항목이 명세서에 기록되어 있지 않습니다.',
          nextActions: [
            '사업주에게 차액 산정 근거 확인 요청',
            '추가 공제 내역 서면 요청',
          ],
          comparison: 'EXPLANATION_REQUIRED',
          left: { label: '임금명세서 실지급액', amount: 2100000 },
          right: { label: '통장 실입금액', amount: 2050000 },
          difference: -50000,
          requiredEvidence: ['임금명세서', '통장 거래내역'],
          sources: ['statement', 'deposit'],
          evidence: [],
        },
      ],
      rows: [
        {
          item: '기본급',
          contract: '2,100,000원',
          statement: '2,100,000원',
          deposit: '—',
          result: '2,100,000원 일치',
          status: 'MATCH',
        },
        {
          item: '실지급액',
          contract: '—',
          statement: '2,100,000원',
          deposit: '2,050,000원',
          result: '50,000원 차이 발생',
          status: 'EXPLANATION_REQUIRED',
        },
      ],
    },
  },
  {
    id: 'pay-mock-2025-02',
    period: '2025-02',
    workplace: '(주)페이사이클 제이이노베이션',
    checkedAt: '2025-02-25',
    paidAmount: 2100000,
    documents: {
      contract: {
        kind: 'contract',
        source: 'sample',
        fileName: 'contract-sample.png',
        fields: {
          period: '2025-02',
          basePay: 2100000,
          allowances: null,
          deductions: null,
          netPay: 2100000,
          payDay: 25,
          payDate: null,
        },
        confirmed: true,
        masked: false,
        note: '계약 기본급 2,100,000원 확인',
      },
      statement: {
        kind: 'statement',
        source: 'sample',
        fileName: 'statement-sample.png',
        fields: {
          period: '2025-02',
          basePay: 2100000,
          allowances: null,
          deductions: null,
          netPay: 2100000,
          payDay: null,
          payDate: '2025-02-25',
        },
        confirmed: true,
        masked: false,
        note: '명세서 실지급액 2,100,000원 확인',
      },
      deposit: {
        kind: 'deposit',
        source: 'sample',
        fileName: 'deposit-sample.png',
        fields: {
          period: '2025-02',
          basePay: null,
          allowances: null,
          deductions: null,
          netPay: 2100000,
          payDay: null,
          payDate: '2025-02-25',
        },
        confirmed: true,
        masked: false,
        note: '실지급 입금액 2,100,000원 확인',
      },
    },
    analysis: {
      overallStatus: 'MATCH',
      headline: '2025년 2월 급여 100% 정상 대조 완수',
      detail:
        '계약서 및 명세서, 실제 입금액이 완벽히 일치하여 정상 지급되었습니다.',
      steps: [
        {
          label: '근로계약서 확인',
          ok: true,
          detail: '기본급 2,100,000원 일치',
        },
        {
          label: '임금명세서 판독',
          ok: true,
          detail: '실지급액 2,100,000원 일치',
        },
        {
          label: '실입금액 대조',
          ok: true,
          detail: '통장 실입금액 2,100,000원 100% 일치',
        },
      ],
      findings: [
        {
          id: 'base',
          status: 'MATCH',
          title: '계약서, 명세서, 입금액 100% 일치',
          fact: '2025년 2월 급여가 계약서 및 임금명세서 기준과 정확히 일치하여 정상 지급되었습니다.',
          standard: '근로기준법 준수',
          limitation: '이상 특이사항 없음',
          nextActions: ['정상 확인 저장 완료'],
          comparison: 'MATCH',
          left: { label: '계약 기본급', amount: 2100000 },
          right: { label: '통장 실입금액', amount: 2100000 },
          difference: 0,
          requiredEvidence: [],
          sources: ['contract', 'statement', 'deposit'],
          evidence: [],
        },
      ],
      rows: [
        {
          item: '기본급',
          contract: '2,100,000원',
          statement: '2,100,000원',
          deposit: '2,100,000원',
          result: '정상 일치',
          status: 'MATCH',
        },
        {
          item: '실지급액',
          contract: '2,100,000원',
          statement: '2,100,000원',
          deposit: '2,100,000원',
          result: '정상 일치',
          status: 'MATCH',
        },
      ],
    },
  },
];

function defaultDoc(kind: DocKind, period: string): PayDocument {
  return {
    kind,
    source: 'manual',
    fileName: '',
    fields: emptyFields(period),
    confirmed: false,
    masked: false,
    note: '',
  };
}

/** 사용자 급여일 기준, 오늘 날짜가 이번 달 급여일 이전이면 직전 완료 월(지난달)을 기본값으로 반환 */
function getInitialPayPeriod(payDay: number = 25): string {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
  const currentDate = today.getDate();

  let targetYear = currentYear;
  let targetMonth = currentMonth;

  if (currentDate < payDay) {
    targetMonth -= 1;
    if (targetMonth === 0) {
      targetMonth = 12;
      targetYear -= 1;
    }
  }
  return `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
}

export default function PayCheckPage() {
  const {
    state,
    hydrated,
    upsertPayRecord,
    saveResult,
    addEvent,
    refreshFromBackend,
  } = usePayCycle();
  const { t } = useT();

  const userPayDay = state.employment?.payDay || 25;

  const [step, setStep] = useState<number>(-1);
  const [period, setPeriod] = useState(() => getInitialPayPeriod(25));
  const [editingKind, setEditingKind] = useState<DocKind | null>(null);
  const [activePaycheckId, setActivePaycheckId] = useState<
    number | string | undefined
  >(undefined);

  // 프로필의 급여일(payday)이 로드되었을 때, 초기 상태(기본값)이면 사용자 실제 급여일에 맞춰 재조정
  const hasUserChangedPeriodRef = useRef(false);
  useEffect(() => {
    if (!hasUserChangedPeriodRef.current && userPayDay) {
      setPeriod(getInitialPayPeriod(userPayDay));
    }
  }, [userPayDay]);

  // 선택한 월의 급여일이 오늘보다 미래인지(미도래/미입금 월인지) 판별
  const targetPayDate = payDayIso(period, userPayDay);
  const todayIso = isoDate(new Date());
  const isBeforePayday = Boolean(targetPayDate && targetPayDate > todayIso);

  // 급여일까지 남은 D-Day 계산
  const dDayText = useMemo(() => {
    if (!isBeforePayday || !targetPayDate) return '';
    const [y, m, d] = targetPayDate.split('-').map(Number);
    const targetDt = new Date(y, m - 1, d);
    const diff = daysBetween(new Date(), targetDt);
    if (diff <= 0) return 'D-Day';
    return `D-${diff}`;
  }, [isBeforePayday, targetPayDate]);

  // 이전 기록 상세 보기 다이얼로그 모달 상태
  const [selectedRecord, setSelectedRecord] = useState<PayRecord | null>(null);

  // 이전에 저장되거나 확인된 근로계약서 자동 탐색
  const savedContract = useMemo(() => {
    const recWithContract = state.payRecords.find(
      (r) =>
        r.documents?.contract &&
        (r.documents.contract.fields.basePay || r.documents.contract.confirmed),
    );
    return recWithContract?.documents?.contract || null;
  }, [state.payRecords]);

  const resolveContractDoc = useCallback(
    (
      targetPeriod: string,
      currentContract?: PayDocument | null,
    ): PayDocument => {
      if (
        currentContract &&
        (currentContract.fields.basePay || currentContract.confirmed)
      ) {
        return {
          ...currentContract,
          fields: { ...currentContract.fields, period: targetPeriod },
        };
      }
      if (savedContract) {
        return {
          ...savedContract,
          fields: { ...savedContract.fields, period: targetPeriod },
        };
      }
      return defaultDoc('contract', targetPeriod);
    },
    [savedContract],
  );

  const [docs, setDocs] = useState<PayDocuments>(() => ({
    contract: defaultDoc('contract', period),
    statement: defaultDoc('statement', period),
    deposit: defaultDoc('deposit', period),
  }));

  const [reading, setReading] = useState<Record<DocKind, boolean>>({
    contract: false,
    statement: false,
    deposit: false,
  });

  const [candidates, setCandidates] = useState<
    Record<DocKind, CandidateAmountDto[]>
  >({
    contract: [],
    statement: [],
    deposit: [],
  });

  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<PaycheckAnalysis | null>(null);

  const [_bankTx, setBankTx] = useState<MockBankTransactionDto | null>(null);
  const [syncingBank, setSyncingBank] = useState(false);
  const bankReqSeqRef = useRef(0);

  const fetchBankSalary = useCallback(async (targetPeriod: string) => {
    setSyncingBank(true);
    const currentSeq = ++bankReqSeqRef.current;
    try {
      const [yearStr, monthStr] = targetPeriod.split('-');
      const year = Number(yearStr);
      const month = Number(monthStr);
      const lastDay = new Date(year, month, 0).getDate();
      const from = `${targetPeriod}-01`;
      const to = `${targetPeriod}-${String(lastDay).padStart(2, '0')}`;
      const res = await getMockBankTransactionsApi(from, to);
      if (currentSeq !== bankReqSeqRef.current) return;

      const txs = res.transactions.resList || [];
      const periodCompact = targetPeriod.replace(/[^0-9]/g, '');

      const matched = txs.find((t) => {
        const isSalary =
          t.tranType === '급여' ||
          (t.inoutType === '입금' &&
            (t.printedContent?.includes('급여') ||
              t.printedContent?.includes('월급')));
        const isPeriodMatch = t.bankTranDate
          ? t.bankTranDate.startsWith(periodCompact)
          : true;
        return isSalary && isPeriodMatch;
      });

      if (matched) {
        setBankTx(matched);
        const amt =
          Number(matched.tranAmt.replace(/[^0-9.-]+/g, '')) || 2260000;
        const dateIso =
          matched.bankTranDate && matched.bankTranDate.length === 8
            ? `${matched.bankTranDate.slice(0, 4)}-${matched.bankTranDate.slice(4, 6)}-${matched.bankTranDate.slice(6, 8)}`
            : `${targetPeriod}-25`;

        setDocs((prev) => ({
          ...prev,
          deposit: {
            kind: 'deposit',
            source: 'bank_auto',
            fileName: `${matched.bankName || '하나은행'} (${matched.printedContent || '급여 입금'})`,
            fields: {
              period: targetPeriod,
              basePay: null,
              allowances: null,
              deductions: null,
              netPay: amt,
              payDay: null,
              payDate: dateIso,
            },
            confirmed: true,
            masked: false,
            note: `${matched.bankName || '하나은행'} · ${matched.printedContent || '급여 입금'} (${won(amt)})`,
          },
        }));

        setCandidates((prev) => ({
          ...prev,
          deposit: [{ label: '실입금액', amount: amt, targetField: 'netPay' }],
        }));
      } else {
        setBankTx(null);
        setCandidates((prev) => ({
          ...prev,
          deposit: [],
        }));
        setDocs((prev) => {
          if (prev.deposit?.source === 'bank_auto') {
            return {
              ...prev,
              deposit: defaultDoc('deposit', targetPeriod),
            };
          }
          return prev;
        });
      }
    } catch (err) {
      console.warn('Failed to fetch bank transactions:', err);
      if (currentSeq === bankReqSeqRef.current) {
        setBankTx(null);
        setCandidates((prev) => ({
          ...prev,
          deposit: [],
        }));
        setDocs((prev) => {
          if (prev.deposit?.source === 'bank_auto') {
            return {
              ...prev,
              deposit: defaultDoc('deposit', targetPeriod),
            };
          }
          return prev;
        });
      }
    } finally {
      if (currentSeq === bankReqSeqRef.current) {
        setSyncingBank(false);
      }
    }
  }, []);

  useEffect(() => {
    setDocs((prev) => {
      const c = resolveContractDoc(period, prev.contract);
      const s = prev.statement ?? defaultDoc('statement', period);
      const d = prev.deposit ?? defaultDoc('deposit', period);
      return {
        contract: { ...c, fields: { ...c.fields, period } },
        statement: { ...s, fields: { ...s.fields, period } },
        deposit: { ...d, fields: { ...d.fields, period } },
      };
    });
    if (savedContract?.fields.basePay) {
      setCandidates((prev) => ({
        ...prev,
        contract: [{ label: '기본급', amount: savedContract.fields.basePay! }],
      }));
    }
    void fetchBankSalary(period);
  }, [period, fetchBankSalary, resolveContractDoc, savedContract]);

  const [documentIds, setDocumentIds] = useState<
    Record<DocKind, number | undefined>
  >({
    contract: undefined,
    statement: undefined,
    deposit: undefined,
  });

  const patchTimerRef = useRef<Record<DocKind, NodeJS.Timeout | undefined>>({
    contract: undefined,
    statement: undefined,
    deposit: undefined,
  });

  const handleStartNewCheck = useCallback(() => {
    // 모든 대기 중인 PATCH 타이머 취소
    (Object.keys(patchTimerRef.current) as DocKind[]).forEach((k) => {
      if (patchTimerRef.current[k]) {
        clearTimeout(patchTimerRef.current[k]);
        patchTimerRef.current[k] = undefined;
      }
    });

    // documentIds 초기화
    setDocumentIds({
      contract: undefined,
      statement: undefined,
      deposit: undefined,
    });

    const cDoc = resolveContractDoc(period, docs.contract);
    setDocs({
      contract: cDoc,
      statement: defaultDoc('statement', period),
      deposit: defaultDoc('deposit', period),
    });
    setCandidates({
      contract: cDoc.fields.basePay
        ? [{ label: '기본급', amount: cDoc.fields.basePay }]
        : [],
      statement: [],
      deposit: [],
    });
    setActivePaycheckId(undefined);
    setAnalysis(null);
    void fetchBankSalary(period);
    setStep(0);
  }, [docs.contract, fetchBankSalary, period, resolveContractDoc]);

  const rec = state.payRecords.find((r) => r.period === period);

  const historyRecords = useMemo(() => {
    if (state.payRecords && state.payRecords.length > 0) {
      return [...state.payRecords].sort((a, b) =>
        (b.period || '').localeCompare(a.period || ''),
      );
    }
    return MOCK_FALLBACK_RECORDS;
  }, [state.payRecords]);

  const finding: PayFinding | null = useMemo(() => {
    if (analysis?.findings && analysis.findings.length > 0) {
      return analysis.findings[0];
    }
    return null;
  }, [analysis]);

  const dialogFinding: PayFinding | null = useMemo(() => {
    if (!selectedRecord || !selectedRecord.analysis) return null;
    return (
      selectedRecord.analysis.findings?.[0] ?? {
        id: 'match',
        status: selectedRecord.analysis.overallStatus,
        title: `${monthLabel(selectedRecord.period)} 급여 3중 대조 완료`,
        fact: `실입금액 ${selectedRecord.paidAmount ? won(selectedRecord.paidAmount) : '정상'} 확인`,
        standard: '',
        limitation: '',
        nextActions: [],
        comparison: '',
        left: { label: '', amount: 0 },
        right: { label: '', amount: 0 },
        difference: 0,
        requiredEvidence: [],
        sources: [],
        evidence: [],
      }
    );
  }, [selectedRecord]);

  const depositNetPay = docs.deposit?.fields.netPay;
  const resultFinding: PayFinding | null = useMemo(() => {
    if (finding) return finding;
    if (!analysis) return null;
    return {
      id: 'match',
      status: analysis.overallStatus,
      title: `${monthLabel(period)} 급여 3중 대조 완료`,
      fact: `실입금액 ${depositNetPay ? won(depositNetPay) : '정상'} 확인`,
      standard: '',
      limitation: '',
      nextActions: [],
      comparison: '',
      left: { label: '', amount: 0 },
      right: { label: '', amount: 0 },
      difference: 0,
      requiredEvidence: [],
      sources: [],
      evidence: [],
    };
  }, [finding, analysis, period, depositNetPay]);

  const currentPaycheckId = useMemo(() => {
    if (activePaycheckId !== undefined) return activePaycheckId;
    if (rec?.id?.startsWith('be-pay-')) {
      const num = Number(rec.id.replace('be-pay-', ''));
      if (!Number.isNaN(num)) return num;
    }
    return undefined;
  }, [activePaycheckId, rec]);

  const syncDocumentExtractedData = useCallback(
    (kind: DocKind, fields: DocFields) => {
      const docId = documentIds[kind];
      if (!docId) return;

      if (patchTimerRef.current[kind]) {
        clearTimeout(patchTimerRef.current[kind]);
      }

      patchTimerRef.current[kind] = setTimeout(() => {
        void updateDocumentExtractedDataApi(docId, {
          payPeriod: fields.period,
          baseSalary: fields.basePay ?? undefined,
          overtimeAllowance: fields.allowances ?? undefined,
          deduction: fields.deductions ?? undefined,
          netPay: fields.netPay ?? undefined,
          paymentDate: fields.payDate ?? undefined,
          payday: fields.payDay ?? undefined,
        });
      }, 400);
    },
    [documentIds],
  );

  const updateField = useCallback(
    (kind: DocKind, key: keyof DocFields, val: string | number | null) => {
      const current = docs[kind] ?? defaultDoc(kind, period);
      const nextFields: DocFields = { ...current.fields, [key]: val };

      setDocs((prev) => ({
        ...prev,
        [kind]: {
          ...(prev[kind] ?? defaultDoc(kind, period)),
          fields: nextFields,
        },
      }));

      syncDocumentExtractedData(kind, nextFields);
    },
    [docs, period, syncDocumentExtractedData],
  );

  const applyCandidate = useCallback(
    (kind: DocKind, cand: CandidateAmountDto) => {
      const current = docs[kind] ?? defaultDoc(kind, period);
      const nextFields: DocFields = { ...current.fields };

      // 계약서는 기본급(basePay), 명세서 및 입금내역은 실지급/실입금액(netPay)이 핵심 검증 기준 금액입니다.
      const primaryField: keyof DocFields =
        kind === 'contract' ? 'basePay' : 'netPay';
      nextFields[primaryField] = cand.amount;

      // 라벨에 따라 세부 항목도 동기화
      const norm = (cand.label || '').trim().toLowerCase();
      if (
        norm.includes('기본급') ||
        norm.includes('base') ||
        norm.includes('월급')
      ) {
        nextFields.basePay = cand.amount;
      } else if (
        norm.includes('실지급') ||
        norm.includes('실수령') ||
        norm.includes('차인지급') ||
        norm.includes('net') ||
        norm.includes('입금')
      ) {
        nextFields.netPay = cand.amount;
      } else if (
        norm.includes('수당') ||
        norm.includes('연장') ||
        norm.includes('식대')
      ) {
        nextFields.allowances = cand.amount;
      } else if (norm.includes('공제')) {
        nextFields.deductions = cand.amount;
      }

      setDocs((prev) => ({
        ...prev,
        [kind]: {
          ...(prev[kind] ?? defaultDoc(kind, period)),
          fields: nextFields,
        },
      }));

      syncDocumentExtractedData(kind, nextFields);

      const fieldName =
        kind === 'contract' ? t('pay.field.basePay') : t('pay.field.netPay');
      toast.success(
        t('pay.candidate.appliedToast', {
          field: `${cand.label} (${fieldName})`,
          amount: won(cand.amount),
        }),
      );
    },
    [docs, period, syncDocumentExtractedData, t],
  );

  const handleUpload = async (kind: DocKind, file: File) => {
    // 재업로드 시 이전 타이머 및 documentId 초기화
    if (patchTimerRef.current[kind]) {
      clearTimeout(patchTimerRef.current[kind]);
      patchTimerRef.current[kind] = undefined;
    }
    setDocumentIds((prev) => ({ ...prev, [kind]: undefined }));

    setReading((p) => ({ ...p, [kind]: true }));
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      const res = await readDocument({ kind, file, dataUrl, period });
      if (res.documentId) {
        setDocumentIds((p) => ({ ...p, [kind]: res.documentId }));
      }
      setDocs((prev) => ({
        ...prev,
        [kind]: {
          kind,
          source: 'upload',
          fileName: file.name,
          fields: res.fields,
          confirmed: true,
          masked: false,
          note: res.message,
        },
      }));
      setCandidates((prev) => ({
        ...prev,
        [kind]: res.candidateAmounts ?? [],
      }));
      setReading((p) => ({ ...p, [kind]: false }));
      if (res.ok) {
        toast.success(t('pay.readDone', { name: file.name }));
      } else {
        toast.error(t('pay.readFail', { name: file.name }));
      }
    };
    reader.readAsDataURL(file);
  };

  if (!hydrated) {
    return (
      <AppShell title={t('pay.title')}>
        <p className="text-muted-foreground text-sm">…</p>
      </AppShell>
    );
  }

  const manualDrawer = (
    <Drawer
      open={editingKind !== null}
      onOpenChange={(open) => !open && setEditingKind(null)}
    >
      <DrawerContent className="p-5">
        <DrawerHeader>
          <DrawerTitle>
            {editingKind && t(DOC_META[editingKind].labelKey)}
          </DrawerTitle>
          <DrawerDescription>{t('common.manualInput')}</DrawerDescription>
        </DrawerHeader>
        {editingKind && (
          <div className="space-y-4 pt-2">
            {/* 금액 후보군(candidateAmounts) 선택 칩 영역 */}
            {candidates[editingKind] && candidates[editingKind].length > 0 && (
              <div className="space-y-2 rounded-2xl border border-primary/20 bg-primary/5 p-3.5">
                <span className="flex items-center gap-1.5 font-bold text-[11px] text-primary">
                  <Sparkles className="size-3.5" /> {t('pay.candidate.title')}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {candidates[editingKind].map((cand) => {
                    const isRec = isCandidateRecommended(
                      editingKind,
                      cand.label,
                    );
                    const translatedLabel = translateCandidateLabel(
                      cand.label,
                      t,
                    );
                    return (
                      <button
                        key={`${cand.label}-${cand.amount}`}
                        type="button"
                        onClick={() => applyCandidate(editingKind, cand)}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-border/80 bg-card px-3 py-1.5 font-bold text-foreground text-xs shadow-2xs transition-colors hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
                      >
                        {isRec && (
                          <span className="rounded-md bg-primary/15 px-1.5 py-0.5 font-bold text-[9px] text-primary">
                            ✨ {t('pay.candidate.aiRecommended')}
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          {translatedLabel}:
                        </span>
                        <span className="font-bold text-primary">
                          {won(cand.amount)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="space-y-3">
              {(
                Object.keys(FIELD_LABEL_KEYS) as (keyof Omit<
                  DocFields,
                  'period'
                >)[]
              ).map((k) => {
                const val = docs[editingKind]?.fields[k];
                return (
                  <div
                    key={k}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className="font-semibold text-muted-foreground text-xs">
                      {t(FIELD_LABEL_KEYS[k])}
                    </span>
                    <Input
                      type={
                        k.includes('Date') || k.includes('Day')
                          ? 'text'
                          : 'number'
                      }
                      value={val ?? ''}
                      onChange={(e) =>
                        updateField(
                          editingKind,
                          k,
                          e.target.value
                            ? k.includes('Date')
                              ? e.target.value
                              : Number(e.target.value)
                            : null,
                        )
                      }
                      className="w-48 rounded-2xl border border-input bg-background text-right font-bold text-xs shadow-xs focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                );
              })}
            </div>

            <Button
              className="mt-4 w-full rounded-2xl bg-primary font-bold text-primary-foreground"
              onClick={() => setEditingKind(null)}
            >
              {t('common.done')}
            </Button>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  );

  const runAnalysis = async () => {
    setAnalyzing(true);
    setStep(4);

    const result = analyzePaycheck(docs, state.employment, period);
    const localizedRows = (result.rows || []).map((row) => ({
      ...row,
      item:
        row.item === '기본급'
          ? t('pay.field.basePay')
          : row.item === '실지급액'
            ? t('pay.field.netPay')
            : row.item,
    }));
    const localizedResult = { ...result, rows: localizedRows };
    setAnalysis(localizedResult);

    const contractBase =
      typeof docs.contract?.fields.basePay === 'number'
        ? docs.contract.fields.basePay
        : docs.contract?.fields.basePay
          ? Number(
              String(docs.contract.fields.basePay).replace(/[^0-9.-]+/g, ''),
            ) || undefined
          : undefined;

    const statementNet =
      typeof docs.statement?.fields.netPay === 'number'
        ? docs.statement.fields.netPay
        : docs.statement?.fields.netPay
          ? Number(
              String(docs.statement.fields.netPay).replace(/[^0-9.-]+/g, ''),
            ) || undefined
          : undefined;

    const depositNet =
      typeof docs.deposit?.fields.netPay === 'number'
        ? docs.deposit.fields.netPay
        : docs.deposit?.fields.netPay
          ? Number(
              String(docs.deposit.fields.netPay).replace(/[^0-9.-]+/g, ''),
            ) || undefined
          : undefined;

    const diff =
      statementNet !== undefined && depositNet !== undefined
        ? depositNet - statementNet
        : undefined;
    const rawExpected = docs.statement?.fields.payDate || `${period}-25`;
    const expectedDate = rawExpected.includes('T')
      ? rawExpected.split('T')[0]
      : rawExpected.slice(0, 10);

    const rawActual = docs.deposit?.fields.payDate;
    const actualDate = rawActual
      ? rawActual.includes('T')
        ? rawActual
        : `${rawActual.slice(0, 10)}T09:14:00`
      : `${period}-25T09:14:00`;

    let backendPaycheckId: number | undefined;
    try {
      const beRes = await analyzePaycheckApi({
        payPeriod: period,
        contractAmount: contractBase,
        payslipAmount: statementNet,
        actualAmount: depositNet,
        differenceAmount: diff,
        expectedPaymentDate: expectedDate,
        paymentDate: actualDate,
      });
      if (beRes?.paycheck?.paycheckId) {
        backendPaycheckId = beRes.paycheck.paycheckId;
      }
    } catch (err) {
      console.warn('analyzePaycheckApi call failed:', err);
    }

    const assignedId = backendPaycheckId
      ? `be-pay-${backendPaycheckId}`
      : (rec?.id ?? uid('pay'));

    setActivePaycheckId(backendPaycheckId);

    const newRec: PayRecord = {
      id: assignedId,
      period,
      workplace: state.employment?.workplace ?? '',
      checkedAt: new Date().toISOString().slice(0, 10),
      paidAmount: docs.deposit?.fields.netPay ?? null,
      documents: docs,
      analysis: localizedResult,
    };

    upsertPayRecord(newRec);

    void saveResult({
      kind: 'pay',
      payPeriod: period,
      workplace: state.employment?.workplace ?? '',
      status: result.overallStatus,
      differenceAmount: result.findings[0]?.difference ?? null,
      paidAmount: docs.deposit?.fields.netPay ?? null,
      findingCount: result.findings.length,
      documents: docs,
      employment: state.employment,
    });

    // 캘린더에 급여 확인 일정 자동 등록
    const eventDate =
      docs.deposit?.fields.payDate?.slice(0, 10) || `${period}-25`;
    const isNormal = result.overallStatus === 'MATCH';
    addEvent({
      title: `${monthLabel(period)} 급여 확인 (${won(depositNet)})`,
      type: 'PAYCHECK',
      date: eventDate,
      time: '09:00',
      description: `${state.employment?.workplace || '근무지'} ${period} 급여 ${
        isNormal ? '정상 입금 확인' : '차액 확인 필요'
      }`,
      completed: true,
      auto: true,
    });

    // 백엔드 생성 캘린더 일정 및 분석 결과 동기화
    void refreshFromBackend();

    setAnalyzing(false);
    toast.success(t('pay.savedToast'));
    setStep(5);
  };

  /* ---------------- Step -1: 시작 화면 (WizardStart) + 이전 급여 내역 리스트 ---------------- */
  if (step < 0) {
    return (
      <AppShell title={t('pay.title')} subtitle={t('pay.subtitle')}>
        <WizardStart
          icon={<Wallet className="size-7 text-primary" />}
          title={t('pay.startTitle')}
          description={t('pay.startDesc')}
          cta={t('pay.startCta')}
          onStart={handleStartNewCheck}
          disabled={isBeforePayday}
        >
          <div className="rounded-3xl border border-border/70 bg-card p-5 shadow-xs backdrop-blur-md">
            <label
              className="font-bold text-muted-foreground text-xs"
              htmlFor="period"
            >
              {t('pay.month')}
            </label>
            <div className="mt-2.5 flex items-center gap-3">
              <Input
                id="period"
                type="month"
                value={period}
                onChange={(e) => {
                  hasUserChangedPeriodRef.current = true;
                  const next =
                    e.target.value || getInitialPayPeriod(userPayDay);
                  setPeriod(next);
                }}
                className="h-12 flex-1 rounded-2xl border border-input bg-background font-bold text-sm shadow-xs focus-visible:ring-2 focus-visible:ring-ring"
              />
              <span className="font-bold text-primary text-sm">
                {monthLabel(period)}
              </span>
            </div>

            {/* 미도래 월(급여일 전)인 경우 안내 카드 및 D-Day 배지 노출 */}
            {isBeforePayday && (
              <div className="pc-rise mt-4 space-y-2 rounded-2xl border border-warn/30 bg-warn/10 p-4 font-semibold text-warn-foreground text-xs">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-bold text-warn">
                    <AlertTriangle className="size-4 shrink-0 text-warn" />
                    아직 {Number(period.split('-')[1])}월 급여일(
                    {Number(period.split('-')[1])}월 {userPayDay}일) 전입니다
                  </span>
                  <span className="rounded-full bg-warn/25 px-2.5 py-0.5 font-bold text-[11px] text-warn">
                    {dDayText}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  급여 입금 후 대조할 수 있습니다. 이미 완료된 지난달 급여를
                  확인하시려면 이전 월을 선택해 주세요.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    hasUserChangedPeriodRef.current = true;
                    setPeriod(getInitialPayPeriod(userPayDay));
                  }}
                  className="mt-1 h-8 rounded-xl border-warn/40 bg-background font-bold text-foreground text-xs shadow-2xs hover:bg-warn/15"
                >
                  직전 완료 월({monthLabel(getInitialPayPeriod(userPayDay))})
                  선택하기
                </Button>
              </div>
            )}

            <p className="mt-3.5 flex items-start gap-1.5 font-medium text-[11px] text-muted-foreground leading-relaxed">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
              <span className="break-keep">{t('pay.privacy')}</span>
            </p>
          </div>
        </WizardStart>

        {/* 이전 급여 확인 기록 섹션 (백엔드 API 기본연동 + Mock Fallback) */}
        <section className="pc-rise mt-8 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="size-4 text-primary" />
              <h3 className="font-bold text-foreground text-sm">
                {t('pay.history.title')}
              </h3>
            </div>
            {state.payRecords.length === 0 && (
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 font-bold text-[10px] text-primary">
                {t('pay.history.mockBadge')}
              </span>
            )}
          </div>

          <div className="space-y-2.5">
            {historyRecords.map((r) => {
              const status = r.analysis?.overallStatus ?? 'MATCH';
              const isMatch = status === 'MATCH';
              const isEx = status === 'EXPLANATION_REQUIRED';

              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedRecord(r)}
                  className="flex w-full items-center justify-between rounded-3xl border border-border/70 bg-card p-4 text-left shadow-xs backdrop-blur-md transition-colors hover:border-primary/40"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-xs">
                      <Receipt className="size-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground text-xs">
                          {monthLabel(r.period)}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 font-bold text-[10px] ${
                            isMatch
                              ? 'bg-info-soft text-info-foreground dark:text-info'
                              : isEx
                                ? 'bg-warn-soft text-warn-foreground dark:text-warn'
                                : 'bg-destructive/15 text-destructive'
                          }`}
                        >
                          {status}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {r.workplace || t('pay.history.noWorkplace')} ·{' '}
                        {t('pay.history.checkedDate', {
                          date: formatKDate(r.checkedAt),
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-bold text-primary text-xs">
                      {r.paidAmount
                        ? won(r.paidAmount)
                        : t('pay.history.noAmount')}
                    </span>
                    <Eye className="size-4 text-muted-foreground" />
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* 이전 기록 상세 다이얼로그 모달 */}
        <Dialog
          open={selectedRecord !== null}
          onOpenChange={(open) => !open && setSelectedRecord(null)}
        >
          <DialogContent className="z-[100] max-h-[85vh] overflow-y-auto rounded-3xl border border-border bg-card p-6 text-card-foreground shadow-2xl sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-bold text-base text-foreground">
                <Receipt className="size-5 text-primary" />
                {selectedRecord &&
                  t('pay.report.historyDetail', {
                    month: monthLabel(selectedRecord.period),
                  })}
              </DialogTitle>
            </DialogHeader>

            {selectedRecord?.analysis && (
              <div className="space-y-4 pt-2">
                <AnalysisReport
                  paycheckId={
                    selectedRecord.id.startsWith('be-pay-')
                      ? Number(selectedRecord.id.replace('be-pay-', ''))
                      : !Number.isNaN(Number(selectedRecord.id))
                        ? Number(selectedRecord.id)
                        : undefined
                  }
                  finding={dialogFinding}
                  period={selectedRecord.period}
                  workplace={selectedRecord.workplace}
                />

                {/* 3중 대조표 */}
                {selectedRecord.analysis.rows &&
                  selectedRecord.analysis.rows.length > 0 && (
                    <div className="space-y-2 rounded-2xl bg-muted/60 p-4">
                      <h4 className="font-bold text-foreground text-xs">
                        {t('pay.report.tableTitle')}
                      </h4>
                      <div className="divide-y divide-border/40 text-xs">
                        {selectedRecord.analysis.rows.map((row) => (
                          <div
                            key={row.item}
                            className="flex items-center justify-between py-2"
                          >
                            <span className="font-bold text-muted-foreground">
                              {row.item}
                            </span>
                            <div className="flex items-center gap-2 font-semibold text-foreground">
                              <span>{row.statement}</span>
                              <ArrowRight className="size-3 text-muted-foreground" />
                              <span className="font-bold text-primary">
                                {row.deposit}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                <div className="flex justify-end pt-2">
                  <Button
                    onClick={() => setSelectedRecord(null)}
                    className="rounded-2xl bg-primary font-bold text-primary-foreground text-xs"
                  >
                    {t('common.close')}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
        {manualDrawer}
      </AppShell>
    );
  }

  /* ---------------- Step 0, 1, 2: 직관성이 강화된 서류별 단계 플로우 ---------------- */
  if (step <= 2) {
    const currentKind = DOC_ORDER[step];
    const meta = DOC_META[currentKind];
    const currentDoc = docs[currentKind];
    const isReading = reading[currentKind];
    const isDone = Boolean(
      currentDoc?.fields.basePay || currentDoc?.fields.netPay,
    );
    const Icon = meta.icon;
    const isBankAutoDeposit =
      currentKind === 'deposit' && currentDoc?.source === 'bank_auto';

    return (
      <AppShell title={t('pay.title')} subtitle={monthLabel(period)}>
        {/* 상단 서류 준비 상태 직관 가이드 칩 */}
        <div className="mb-4 flex items-center justify-between rounded-3xl border border-border/70 bg-card p-4 shadow-xs backdrop-blur-md">
          {DOC_ORDER.map((k, idx) => {
            const done = Boolean(
              docs[k]?.fields.basePay || docs[k]?.fields.netPay,
            );
            const isCurrent = step === idx;
            return (
              <div
                key={k}
                className={`flex items-center gap-1.5 font-bold text-xs ${
                  isCurrent
                    ? 'scale-105 font-bold text-primary'
                    : done
                      ? 'text-primary opacity-90 dark:text-primary-foreground'
                      : 'text-muted-foreground opacity-50'
                }`}
              >
                {done ? (
                  <CheckCircle2 className="size-4 text-primary" />
                ) : (
                  <span className="flex size-4 items-center justify-center rounded-full bg-muted text-[10px]">
                    {idx + 1}
                  </span>
                )}
                <span>{t(DOC_META[k].labelKey)}</span>
              </div>
            );
          })}
        </div>

        <WizardStep
          index={step}
          total={6}
          title={t(meta.stepKey)}
          hint={t(meta.hintKey)}
          onPrev={() => setStep(step === 0 ? -1 : step - 1)}
          onNext={() => setStep(step + 1)}
          nextDisabled={!isDone}
          nextLabel={t('common.next')}
        >
          <div className="space-y-4 rounded-3xl border border-border/70 bg-card p-6 shadow-xs backdrop-blur-md">
            <div className="flex items-center gap-3 border-border/40 border-b pb-4">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-xs">
                <Icon className="size-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-foreground">
                  {t(meta.labelKey)}
                </h3>
                <p className="font-semibold text-muted-foreground text-xs">
                  {t(meta.hintKey)}
                </p>
              </div>
            </div>

            {/* Step 2 입금내역 자동 연동 카드 또는 일반 서류 액션 버튼 */}
            {isBankAutoDeposit ? (
              <div className="space-y-3 rounded-3xl bg-secondary p-5 shadow-xs backdrop-blur-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-xs">
                      <Landmark className="size-5" />
                    </div>
                    <div>
                      <span className="font-bold text-foreground text-xs">
                        {currentDoc?.fileName || '하나은행'}
                      </span>
                      <p className="font-semibold text-[11px] text-muted-foreground">
                        {currentDoc?.note}
                      </p>
                    </div>
                  </div>
                  <span className="rounded-full border border-primary/20 bg-primary/15 px-2.5 py-0.5 font-bold text-[10px] text-primary">
                    ✨ {t('pay.bank.autoBadge')}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/80 p-3.5">
                  <span className="font-bold text-muted-foreground text-xs">
                    {t('pay.field.netPay')}
                  </span>
                  <span className="font-bold text-base text-primary">
                    {won(currentDoc?.fields.netPay ?? 0)}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingKind('deposit')}
                    className="flex-1 rounded-xl border border-input bg-card font-bold text-xs shadow-xs hover:bg-accent"
                  >
                    {t('pay.bank.changeManually')}
                  </Button>
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-input bg-card px-3 py-2 font-bold text-foreground text-xs shadow-xs transition-all hover:bg-accent">
                    <Upload className="size-3.5" />
                    {t('common.upload')}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleUpload('deposit', file);
                      }}
                    />
                  </label>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={syncingBank}
                    onClick={() => void fetchBankSalary(period)}
                    className="rounded-xl font-bold text-muted-foreground text-xs hover:text-primary"
                  >
                    {syncingBank ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      t('pay.bank.syncAgain')
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2.5 pt-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-primary px-5 py-3 font-bold text-primary-foreground text-xs transition-colors hover:bg-primary/90">
                  <Upload className="size-4" />
                  {t('common.upload')}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleUpload(currentKind, file);
                    }}
                  />
                </label>

                <Button
                  variant="outline"
                  className="h-11 rounded-2xl border border-input bg-card font-bold text-xs shadow-xs hover:bg-accent hover:text-accent-foreground"
                  onClick={() => setEditingKind(currentKind)}
                >
                  {t('common.manualInput')}
                </Button>
              </div>
            )}

            {!isDone && !isReading && (
              <div className="rounded-2xl border border-warn/20 bg-warn/10 p-3.5 font-semibold text-warn-foreground text-xs">
                ⚠️ {t('pay.step.uploadNotice')}
              </div>
            )}

            {isReading && (
              <div className="flex items-center gap-2.5 rounded-2xl bg-primary/10 p-4 font-bold text-primary text-xs shadow-xs">
                <Loader2 className="size-4 animate-spin text-primary" />
                {t('pay.readingDoc', { doc: t(meta.labelKey) })}
              </div>
            )}

            {isDone && !isReading && !isBankAutoDeposit && (
              <div className="space-y-3 pt-1">
                {/* 1. 업로드된 문서 요약 카드 */}
                <div className="space-y-1.5 rounded-2xl border border-primary/20 bg-primary/5 p-4 font-semibold text-foreground text-xs leading-relaxed shadow-xs">
                  <div className="flex items-center justify-between">
                    <p className="flex items-center gap-1.5 font-bold text-primary">
                      <CheckCircle2 className="size-4 text-primary" />
                      {currentKind === 'contract' &&
                        t('pay.doc.extractedContract', {
                          amount: won(currentDoc?.fields.basePay ?? 0),
                        })}
                      {currentKind === 'statement' &&
                        t('pay.doc.extractedStatement', {
                          amount: won(
                            currentDoc?.fields.netPay ??
                              currentDoc?.fields.basePay ??
                              0,
                          ),
                        })}
                      {currentKind === 'deposit' &&
                        t('pay.doc.extractedDeposit', {
                          amount: won(currentDoc?.fields.netPay ?? 0),
                        })}
                    </p>
                    {currentDoc?.fileName && (
                      <span className="max-w-[140px] truncate rounded-lg bg-primary/10 px-2 py-0.5 font-bold text-[10px] text-primary">
                        📄 {currentDoc.fileName}
                      </span>
                    )}
                  </div>
                  {currentDoc?.note && (
                    <p className="pt-0.5 text-[11px] text-muted-foreground">
                      {currentDoc.note}
                    </p>
                  )}
                </div>

                {/* 2. 문서에서 감지된 금액 후보군 칩 UI (AI 스마트 추천 포함) */}
                {candidates[currentKind] &&
                  candidates[currentKind].length > 0 && (
                    <div className="space-y-2 rounded-2xl border border-border/70 bg-muted/50 p-3.5">
                      <span className="flex items-center gap-1.5 font-bold text-[11px] text-foreground">
                        <Sparkles className="size-3.5 text-primary" />
                        {t('pay.candidate.title')}
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {candidates[currentKind].map((cand) => {
                          const isRec = isCandidateRecommended(
                            currentKind,
                            cand.label,
                          );
                          const translatedLabel = translateCandidateLabel(
                            cand.label,
                            t,
                          );
                          const primaryField: keyof DocFields =
                            currentKind === 'contract' ? 'basePay' : 'netPay';
                          const isCurrentVal =
                            currentDoc?.fields[primaryField] === cand.amount;

                          return (
                            <button
                              key={`${cand.label}-${cand.amount}`}
                              type="button"
                              onClick={() => applyCandidate(currentKind, cand)}
                              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl border px-3 py-1.5 font-bold text-xs shadow-2xs transition-colors ${
                                isCurrentVal
                                  ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                                  : isRec
                                    ? 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/20'
                                    : 'border-border/80 bg-card text-foreground hover:bg-muted'
                              }`}
                            >
                              {isRec && (
                                <span
                                  className={`rounded-md px-1.5 py-0.5 font-bold text-[9px] ${
                                    isCurrentVal
                                      ? 'bg-white/25 text-white'
                                      : 'bg-primary/20 text-primary'
                                  }`}
                                >
                                  ✨ {t('pay.candidate.aiRecommended')}
                                </span>
                              )}
                              <span
                                className={
                                  isCurrentVal
                                    ? 'text-[10px] text-primary-foreground/90'
                                    : 'text-[10px] text-muted-foreground'
                                }
                              >
                                {translatedLabel}:
                              </span>
                              <span
                                className={
                                  isCurrentVal
                                    ? 'font-bold text-primary-foreground'
                                    : 'font-bold text-primary'
                                }
                              >
                                {won(cand.amount)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
              </div>
            )}
          </div>
        </WizardStep>
        {manualDrawer}
      </AppShell>
    );
  }

  /* ---------------- Step 3: 추출된 3개 서류 요약 확인 ---------------- */
  if (step === 3) {
    const confirmedCount = DOC_ORDER.filter((k) =>
      Boolean(docs[k]?.fields.basePay || docs[k]?.fields.netPay),
    ).length;

    return (
      <AppShell title={t('pay.title')} subtitle={monthLabel(period)}>
        <WizardStep
          index={3}
          total={6}
          title={t('pay.step4')}
          hint={t('pay.startDesc')}
          onPrev={() => setStep(2)}
        >
          {confirmedCount === 0 ? (
            /* 서류가 3개 모두 없을 때 표시하는 전용 빈 화면 */
            <div className="space-y-4 rounded-3xl border border-destructive/20 bg-card p-6 text-center shadow-xs backdrop-blur-md">
              <div className="mx-auto flex size-14 items-center justify-center rounded-3xl bg-destructive/10 text-destructive">
                <FileText className="size-7" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-base text-foreground">
                  {t('pay.noDocs.title')}
                </h3>
                <p className="mx-auto max-w-sm text-muted-foreground text-xs leading-relaxed">
                  {t('pay.noDocs.desc')}
                </p>
              </div>

              <div className="space-y-2.5 pt-3">
                <Button
                  onClick={() => setStep(0)}
                  className="h-12 w-full rounded-2xl bg-primary font-bold text-primary-foreground"
                >
                  <Upload className="mr-2 size-4" />
                  {t('pay.noDocs.uploadFirst')}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => setEditingKind('contract')}
                  className="h-12 w-full rounded-2xl border border-input bg-card font-bold shadow-xs hover:bg-accent"
                >
                  {t('common.manualInput')}
                </Button>
              </div>

              <p className="pt-1 font-bold text-[11px] text-destructive">
                ⚠️ {t('pay.noDocs.warning')}
              </p>
            </div>
          ) : (
            <div className="space-y-3.5">
              <div className="rounded-2xl bg-muted/60 p-3.5 font-semibold text-[11px] text-muted-foreground">
                {t('pay.doc.monthlyNotice')}
              </div>

              {DOC_ORDER.map((kind) => {
                const meta = DOC_META[kind];
                const doc = docs[kind];
                const Icon = meta.icon;
                const val =
                  kind === 'contract'
                    ? doc?.fields.basePay
                    : kind === 'statement'
                      ? (doc?.fields.netPay ?? doc?.fields.basePay)
                      : doc?.fields.netPay;

                return (
                  <div
                    key={kind}
                    className="flex items-center justify-between rounded-3xl border border-border/70 bg-card p-4.5 shadow-xs backdrop-blur-md"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-xs">
                        <Icon className="size-5" />
                      </div>
                      <div>
                        <p className="font-bold text-foreground text-xs">
                          {t(meta.labelKey)}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {doc?.confirmed
                            ? t('pay.confirmed')
                            : t('pay.unconfirmed')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-bold text-primary text-sm">
                        {val ? won(val) : '-'}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 rounded-xl px-2 font-bold text-[11px] text-muted-foreground hover:bg-accent hover:text-primary"
                        onClick={() => setEditingKind(kind)}
                      >
                        {t('common.edit')}
                      </Button>
                    </div>
                  </div>
                );
              })}

              <Button
                onClick={runAnalysis}
                className="mt-6 h-14 w-full rounded-2xl bg-primary font-bold text-base text-primary-foreground"
              >
                {t('pay.analyzeCta')}
                <ArrowRight className="ml-2 size-5" />
              </Button>
            </div>
          )}
        </WizardStep>
        {manualDrawer}
      </AppShell>
    );
  }

  /* ---------------- Step 4: 세 자료 대조 분석 진행 중 (AI 체킹) ---------------- */
  if (step === 4 || analyzing) {
    return (
      <AppShell title={t('pay.title')} subtitle={monthLabel(period)}>
        <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
          <div className="relative flex size-20 items-center justify-center rounded-3xl bg-primary/10 text-primary shadow-xs">
            <Loader2 className="size-10 animate-spin text-primary" />
          </div>
          <h3 className="mt-6 font-bold text-foreground text-xl">
            {t('pay.analyzing')}
          </h3>
          <p className="mt-2 font-semibold text-muted-foreground text-xs">
            {t('pay.analyzingDesc')}
          </p>
        </div>
        {manualDrawer}
      </AppShell>
    );
  }

  /* ---------------- Step 5: 최종 3중 대조 분석 결과 레포트 ---------------- */
  return (
    <AppShell title={t('pay.title')} subtitle={monthLabel(period)}>
      <div className="pc-rise space-y-5">
        <div className="flex items-center justify-between rounded-3xl border border-border/70 bg-card p-4 shadow-xs backdrop-blur-md">
          <span className="font-bold text-muted-foreground text-xs">
            {t('pay.report.periodLabel', { month: monthLabel(period) })}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-2xl border border-input bg-card font-bold text-xs shadow-xs"
              onClick={() => setStep(-1)}
            >
              {t('pay.history.title')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-2xl font-bold text-xs shadow-xs"
              onClick={() => setStep(0)}
            >
              {t('common.again')}
            </Button>
          </div>
        </div>

        {/* AI 심층 분석 리포트 */}
        <AnalysisReport
          paycheckId={currentPaycheckId}
          finding={resultFinding}
          period={period}
          workplace={state.employment?.workplace}
        />

        {analysis?.rows && analysis.rows.length > 0 && (
          <div className="space-y-3 rounded-3xl border border-border/70 bg-card p-5 shadow-xs backdrop-blur-md">
            <h4 className="font-bold text-foreground text-xs">
              {t('pay.table')}
            </h4>
            <div className="divide-y divide-border/40 text-xs">
              {analysis.rows.map((row) => (
                <div
                  key={row.item}
                  className="flex items-center justify-between py-2.5"
                >
                  <span className="font-bold text-muted-foreground">
                    {row.item}
                  </span>
                  <div className="flex items-center gap-3 font-semibold text-foreground">
                    <span>{row.statement}</span>
                    <ArrowRight className="size-3 text-muted-foreground" />
                    <span className="font-bold text-primary">
                      {row.deposit}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <Button
            onClick={() => setStep(-1)}
            className="h-12 flex-1 rounded-2xl bg-primary font-bold text-primary-foreground text-xs"
          >
            {t('pay.history.title')}
          </Button>
          <Button
            onClick={() => setStep(0)}
            variant="outline"
            className="h-12 flex-1 rounded-2xl border border-input bg-card font-bold text-foreground text-xs shadow-xs hover:bg-accent"
          >
            {t('common.again')}
          </Button>
        </div>
      </div>

      {manualDrawer}
    </AppShell>
  );
}
