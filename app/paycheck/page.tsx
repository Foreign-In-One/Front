"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  FileText,
  Landmark,
  Loader2,
  Receipt,
  Sparkles,
  Upload,
  Wallet,
  ArrowRight,
  ShieldCheck,
  History,
  Eye,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { LevelCard, WizardStart, WizardStep } from "@/components/wizard";
import { AnalysisReport } from "@/components/paycheck/analysis-report";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePayCycle } from "@/state/paycycle-context";
import { analyzePaycheck } from "@/lib/paycycle/rule-engine";
import { emptyFields } from "@/lib/paycycle/types";
import type {
  DocFields,
  DocKind,
  PayDocument,
  PayDocuments,
  PayRecord,
  PaycheckAnalysis,
  PayFinding,
} from "@/lib/paycycle/types";
import {
  daysBetween,
  formatKDate,
  isoDate,
  monthLabel,
  payDayIso,
  periodOf,
  uid,
  won,
} from "@/lib/paycycle/format";
import { readDocument } from "@/services/ocr";
import {
  analyzePaycheckApi,
  getMockBankTransactionsApi,
  updateDocumentExtractedDataApi,
  type CandidateAmountDto,
  type MockBankTransactionDto,
} from "@/services/api";
import { useT } from "@/i18n";

const DOC_ORDER: DocKind[] = ["contract", "statement", "deposit"];

const DOC_META: Record<
  DocKind,
  { labelKey: string; hintKey: string; stepKey: string; icon: typeof FileText }
> = {
  contract: {
    labelKey: "pay.doc.contract",
    hintKey: "pay.doc.contract.h",
    stepKey: "pay.step1",
    icon: FileText,
  },
  statement: {
    labelKey: "pay.doc.statement",
    hintKey: "pay.doc.statement.h",
    stepKey: "pay.step2",
    icon: Receipt,
  },
  deposit: {
    labelKey: "pay.doc.deposit",
    hintKey: "pay.doc.deposit.h",
    stepKey: "pay.step3",
    icon: Landmark,
  },
};

const FIELD_LABEL_KEYS: Record<keyof Omit<DocFields, "period">, string> = {
  basePay: "pay.field.basePay",
  allowances: "pay.field.allowances",
  deductions: "pay.field.deductions",
  netPay: "pay.field.netPay",
  payDay: "pay.field.payDay",
  payDate: "pay.field.payDate",
};

function translateCandidateLabel(rawLabel: string, t: (key: string) => string): string {
  const norm = rawLabel.trim();
  if (norm.includes("기본급") || norm.toLowerCase().includes("base")) return t("pay.field.basePay");
  if (norm.includes("실지급") || norm.includes("실수령") || norm.includes("차인지급") || norm.toLowerCase().includes("net")) return t("pay.field.netPay");
  if (norm.includes("실입금") || norm.includes("입금액")) return t("pay.field.netPay");
  if (norm.includes("연장") || norm.toLowerCase().includes("overtime")) return t("pay.field.overtimeAllowance");
  if (norm.includes("지급총액") || norm.includes("총지급") || norm.toLowerCase().includes("gross") || norm.includes("월급여총액")) return t("pay.field.totalPayment");
  if (norm.includes("공제") || norm.toLowerCase().includes("deduction")) return t("pay.field.deductions");
  if (norm.includes("식대") || norm.toLowerCase().includes("meal")) return t("pay.field.allowances");
  if (norm.includes("수당") || norm.toLowerCase().includes("allowance")) return t("pay.field.allowances");
  if (norm.includes("잔액") || norm.toLowerCase().includes("balance")) return t("pay.field.afterBalance");
  return rawLabel;
}

function isCandidateRecommended(kind: DocKind, label: string): boolean {
  const norm = label.trim().toLowerCase();
  if (kind === "contract") {
    return norm.includes("기본급") || norm.includes("base") || norm.includes("월급");
  }
  if (kind === "statement") {
    return norm.includes("실지급") || norm.includes("실수령") || norm.includes("차인지급") || norm.includes("net");
  }
  if (kind === "deposit") {
    return norm.includes("실입금") || norm.includes("입금액") || norm.includes("급여") || norm.includes("net");
  }
  return false;
}

function getCandidateTargetField(kind: DocKind, label: string): keyof DocFields {
  const norm = (label || "").trim().toLowerCase();
  if (norm.includes("기본급") || norm.includes("base") || norm.includes("월급")) return "basePay";
  if (norm.includes("실지급") || norm.includes("실수령") || norm.includes("차인지급") || norm.includes("net") || norm.includes("입금")) return "netPay";
  if (norm.includes("수당") || norm.includes("연장") || norm.includes("식대")) return "allowances";
  if (norm.includes("공제")) return "deductions";
  return kind === "contract" ? "basePay" : "netPay";
}



function defaultDoc(kind: DocKind, period: string): PayDocument {
  return {
    kind,
    source: "manual",
    fileName: "",
    fields: emptyFields(period),
    confirmed: false,
    masked: false,
    note: "",
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
  return `${targetYear}-${String(targetMonth).padStart(2, "0")}`;
}

export default function PayCheckPage() {
  const { state, hydrated, upsertPayRecord, saveResult, addEvent, refreshFromBackend } = usePayCycle();
  const { t, locale } = useT();

  const userPayDay = state.employment?.payDay || 25;

  const [step, setStep] = useState<number>(-1);
  const [period, setPeriod] = useState(() => getInitialPayPeriod(25));
  const [editingKind, setEditingKind] = useState<DocKind | null>(null);
  const [activePaycheckId, setActivePaycheckId] = useState<number | string | undefined>(undefined);

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
    if (!isBeforePayday || !targetPayDate) return "";
    const [y, m, d] = targetPayDate.split("-").map(Number);
    const targetDt = new Date(y, m - 1, d);
    const diff = daysBetween(new Date(), targetDt);
    if (diff <= 0) return "D-Day";
    return `D-${diff}`;
  }, [isBeforePayday, targetPayDate]);

  // 이전 기록 상세 보기 다이얼로그 모달 상태
  const [selectedRecord, setSelectedRecord] = useState<PayRecord | null>(null);

  // 감지된 금액 항목 설정 다이얼로그 모달 상태
  const [selectedCandidate, setSelectedCandidate] = useState<{
    kind: DocKind;
    cand: CandidateAmountDto;
    targetField: keyof DocFields;
    amount: number;
  } | null>(null);

  // 이전에 저장되거나 확인된 근로계약서 자동 탐색
  const savedContract = useMemo(() => {
    const recWithContract = state.payRecords.find(
      (r) => r.documents?.contract && (r.documents.contract.fields.basePay || r.documents.contract.confirmed)
    );
    return recWithContract?.documents?.contract || null;
  }, [state.payRecords]);

  const resolveContractDoc = useCallback(
    (targetPeriod: string, currentContract?: PayDocument | null): PayDocument => {
      if (currentContract && (currentContract.fields.basePay || currentContract.confirmed)) {
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
      return defaultDoc("contract", targetPeriod);
    },
    [savedContract]
  );

  const [docs, setDocs] = useState<PayDocuments>(() => ({
    contract: defaultDoc("contract", period),
    statement: defaultDoc("statement", period),
    deposit: defaultDoc("deposit", period),
  }));

  const [reading, setReading] = useState<Record<DocKind, boolean>>({
    contract: false,
    statement: false,
    deposit: false,
  });

  const [candidates, setCandidates] = useState<Record<DocKind, CandidateAmountDto[]>>({
    contract: [],
    statement: [],
    deposit: [],
  });

  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<PaycheckAnalysis | null>(null);
  const [comparisonViewMode, setComparisonViewMode] = useState<"table" | "tabs">("table");
  const [activeDocTab, setActiveDocTab] = useState<DocKind>("contract");

  const [bankTx, setBankTx] = useState<MockBankTransactionDto | null>(null);
  const [syncingBank, setSyncingBank] = useState(false);
  const bankReqSeqRef = useRef(0);

  const fetchBankSalary = useCallback(async (targetPeriod: string) => {
    setSyncingBank(true);
    const currentSeq = ++bankReqSeqRef.current;
    try {
      const [yearStr, monthStr] = targetPeriod.split("-");
      const year = Number(yearStr);
      const month = Number(monthStr);
      const lastDay = new Date(year, month, 0).getDate();
      const from = `${targetPeriod}-01`;
      const to = `${targetPeriod}-${String(lastDay).padStart(2, "0")}`;
      const res = await getMockBankTransactionsApi(from, to);
      if (currentSeq !== bankReqSeqRef.current) return;

      const txs = res.transactions.resList || [];
      const periodCompact = targetPeriod.replace(/[^0-9]/g, "");

      const matched = txs.find((t) => {
        const isSalary =
          t.tranType === "급여" ||
          (t.inoutType === "입금" && (t.printedContent?.includes("급여") || t.printedContent?.includes("월급")));
        const isPeriodMatch = t.bankTranDate
          ? t.bankTranDate.startsWith(periodCompact)
          : true;
        return isSalary && isPeriodMatch;
      });

      if (matched) {
        setBankTx(matched);
        const amt = Number(matched.tranAmt.replace(/[^0-9.-]+/g, "")) || 2300000;
        const dateIso =
          matched.bankTranDate && matched.bankTranDate.length === 8
            ? `${matched.bankTranDate.slice(0, 4)}-${matched.bankTranDate.slice(4, 6)}-${matched.bankTranDate.slice(6, 8)}`
            : `${targetPeriod}-25`;

        setDocs((prev) => ({
          ...prev,
          deposit: {
            kind: "deposit",
            source: "bank_auto",
            fileName: `${matched.bankName || "하나은행"} (${matched.printedContent || "급여 입금"})`,
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
            note: `${matched.bankName || "하나은행"} · ${matched.printedContent || "급여 입금"} (${won(amt)})`,
          },
        }));

        setCandidates((prev) => ({
          ...prev,
          deposit: [{ label: "실입금액", amount: amt, targetField: "netPay" }],
        }));
      } else {
        setBankTx(null);
        setCandidates((prev) => ({
          ...prev,
          deposit: [],
        }));
        setDocs((prev) => {
          if (prev.deposit?.source === "bank_auto") {
            return {
              ...prev,
              deposit: defaultDoc("deposit", targetPeriod),
            };
          }
          return prev;
        });
      }
    } catch (err) {
      console.warn("Failed to fetch bank transactions:", err);
      if (currentSeq === bankReqSeqRef.current) {
        setBankTx(null);
        setCandidates((prev) => ({
          ...prev,
          deposit: [],
        }));
        setDocs((prev) => {
          if (prev.deposit?.source === "bank_auto") {
            return {
              ...prev,
              deposit: defaultDoc("deposit", targetPeriod),
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
      const s = prev.statement ?? defaultDoc("statement", period);
      const d = prev.deposit ?? defaultDoc("deposit", period);
      return {
        contract: { ...c, fields: { ...c.fields, period } },
        statement: { ...s, fields: { ...s.fields, period } },
        deposit: { ...d, fields: { ...d.fields, period } },
      };
    });
    if (savedContract?.fields.basePay) {
      setCandidates((prev) => ({
        ...prev,
        contract: [{ label: "기본급", amount: savedContract.fields.basePay! }],
      }));
    }
    void fetchBankSalary(period);
  }, [period, fetchBankSalary, resolveContractDoc, savedContract]);

  const [documentIds, setDocumentIds] = useState<Record<DocKind, number | undefined>>({
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
      statement: defaultDoc("statement", period),
      deposit: defaultDoc("deposit", period),
    });
    setCandidates({
      contract: cDoc.fields.basePay ? [{ label: "기본급", amount: cDoc.fields.basePay }] : [],
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
      return [...state.payRecords].sort((a, b) => (b.period || "").localeCompare(a.period || ""));
    }
    return [];
  }, [state.payRecords]);

  const finding: PayFinding | null = useMemo(() => {
    if (analysis && analysis.findings && analysis.findings.length > 0) {
      return analysis.findings[0];
    }
    return null;
  }, [analysis]);

  const dialogFinding: PayFinding | null = useMemo(() => {
    if (!selectedRecord || !selectedRecord.analysis) return null;
    return (
      selectedRecord.analysis.findings?.[0] ?? {
        id: "match",
        status: selectedRecord.analysis.overallStatus,
        title: `${monthLabel(selectedRecord.period)} 급여 3중 대조 완료`,
        fact: `실입금액 ${selectedRecord.paidAmount ? won(selectedRecord.paidAmount) : "정상"} 확인`,
        standard: "",
        limitation: "",
        nextActions: [],
        comparison: "",
        left: { label: "", amount: 0 },
        right: { label: "", amount: 0 },
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
      id: "match",
      status: analysis.overallStatus,
      title: `${monthLabel(period)} 급여 3중 대조 완료`,
      fact: `실입금액 ${depositNetPay ? won(depositNetPay) : "정상"} 확인`,
      standard: "",
      limitation: "",
      nextActions: [],
      comparison: "",
      left: { label: "", amount: 0 },
      right: { label: "", amount: 0 },
      difference: 0,
      requiredEvidence: [],
      sources: [],
      evidence: [],
      };
  }, [finding, analysis, period, depositNetPay]);

  const currentPaycheckId = useMemo(() => {
    if (activePaycheckId !== undefined) return activePaycheckId;
    if (rec?.id && rec.id.startsWith("be-pay-")) {
      const num = Number(rec.id.replace("be-pay-", ""));
      if (!isNaN(num)) return num;
    }
    return undefined;
  }, [activePaycheckId, rec]);

  const syncDocumentExtractedData = useCallback((kind: DocKind, fields: DocFields) => {
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
  }, [documentIds]);

  const updateField = useCallback(
    (kind: DocKind, key: keyof DocFields, val: any) => {
      setDocs((prev) => {
        const current = prev[kind] ?? defaultDoc(kind, period);
        const nextFields: DocFields = { ...current.fields, [key]: val };
        syncDocumentExtractedData(kind, nextFields);
        return {
          ...prev,
          [kind]: {
            ...current,
            fields: nextFields,
          },
        };
      });
    },
    [period, syncDocumentExtractedData]
  );

  const applyCandidateToField = useCallback(
    (kind: DocKind, field: keyof DocFields, amount: number, label: string) => {
      const fieldName = t(FIELD_LABEL_KEYS[field as keyof typeof FIELD_LABEL_KEYS] || "pay.field.basePay");

      // 1. docs 상태 업데이트: 최신 fields 계산 및 note 갱신
      setDocs((prev) => {
        const current = prev[kind] ?? defaultDoc(kind, period);
        const nextFields: DocFields = { ...current.fields, [field]: amount };

        // 스마트 보정: 명세서인데 실지급액을 넣었고 기본급이 비어있으면 기본급도 같이 채워줌
        if (kind === "statement" && field === "netPay" && (nextFields.basePay === null || nextFields.basePay === undefined)) {
          nextFields.basePay = amount;
        }

        syncDocumentExtractedData(kind, nextFields);

        return {
          ...prev,
          [kind]: {
            ...current,
            fields: nextFields,
            confirmed: true,
            note: `${label} (${fieldName}) 금액이 ${won(amount)}으로 변경되었습니다.`,
          },
        };
      });

      // 2. candidates 칩 상태 동기화: 화면의 칩 금액도 수정한 금액으로 즉시 갱신
      setCandidates((prev) => {
        const list = prev[kind] ?? [];
        const exists = list.some((c) => c.label === label);
        const updatedList = exists
          ? list.map((c) => (c.label === label ? { ...c, amount } : c))
          : [...list, { label, amount }];
        return {
          ...prev,
          [kind]: updatedList,
        };
      });

      toast.success(
        t("pay.candidate.appliedToast", {
          field: `${label} (${fieldName})`,
          amount: won(amount),
        })
      );
    },
    [period, syncDocumentExtractedData, t]
  );

  const openCandidateModal = useCallback(
    (kind: DocKind, cand: CandidateAmountDto) => {
      const defaultTarget = getCandidateTargetField(kind, cand.label);
      setSelectedCandidate({
        kind,
        cand,
        targetField: defaultTarget,
        amount: cand.amount,
      });
    },
    []
  );

  const applyCandidate = useCallback(
    (kind: DocKind, cand: CandidateAmountDto) => {
      openCandidateModal(kind, cand);
    },
    [openCandidateModal]
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
          source: "upload",
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
        toast.success(t("pay.readDone", { name: file.name }));
      } else {
        toast.error(t("pay.readFail", { name: file.name }));
      }
    };
    reader.readAsDataURL(file);
  };

  if (!hydrated) {
    return (
      <AppShell title={t("pay.title")}>
        <p className="text-sm text-muted-foreground">…</p>
      </AppShell>
    );
  }

  const candidateModal = (
    <Dialog
      open={selectedCandidate !== null}
      onOpenChange={(open) => !open && setSelectedCandidate(null)}
    >
      <DialogContent className="sm:max-w-md rounded-3xl p-6 border border-border bg-card text-card-foreground shadow-2xl z-[100]">
        <DialogHeader>
          <DialogTitle className="text-base font-extrabold text-foreground flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            {t("pay.candidate.modalTitle")}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {t("pay.candidate.modalDesc")}
          </DialogDescription>
        </DialogHeader>

        {selectedCandidate && (
          <div className="space-y-4 pt-2">
            {/* 1. 금액 확인 및 직접 수정 */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-muted-foreground">
                  {t("pay.candidate.modalAmountLabel")}
                </label>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  {translateCandidateLabel(selectedCandidate.cand.label, t)}
                </span>
              </div>
              <div className="relative">
                <Input
                  type="number"
                  value={selectedCandidate.amount || ""}
                  onChange={(e) => {
                    const val = Number(e.target.value) || 0;
                    setSelectedCandidate((prev) => (prev ? { ...prev, amount: val } : null));
                  }}
                  className="h-11 rounded-2xl text-sm font-black pr-10 border border-input bg-background"
                />
                <span className="absolute right-3.5 top-3 text-xs font-bold text-muted-foreground">
                  원
                </span>
              </div>
              <p className="text-[11px] font-medium text-primary text-right">
                {won(selectedCandidate.amount)}
              </p>
            </div>

            {/* 2. 적용할 급여 요소 선택 */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground">
                {t("pay.candidate.modalTargetLabel")}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { field: "basePay", label: t("pay.field.basePay"), desc: "세전 기본 급여" },
                  { field: "netPay", label: t("pay.field.netPay"), desc: "통장 실수령액" },
                  { field: "allowances", label: t("pay.field.allowances"), desc: "연장·휴일 수당" },
                  { field: "deductions", label: t("pay.field.deductions"), desc: "4대보험·세금 공제" },
                ].map(({ field, label, desc }) => {
                  const isSelected = selectedCandidate.targetField === field;
                  return (
                    <button
                      key={field}
                      type="button"
                      onClick={() =>
                        setSelectedCandidate((prev) =>
                          prev ? { ...prev, targetField: field as keyof DocFields } : null
                        )
                      }
                      className={`flex flex-col items-start p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary shadow-xs ring-2 ring-primary/20"
                          : "bg-muted/40 hover:bg-muted border-border/70 text-foreground"
                      }`}
                    >
                      <span className="text-xs font-extrabold">{label}</span>
                      <span
                        className={`text-[10px] mt-0.5 ${
                          isSelected ? "text-primary-foreground/80" : "text-muted-foreground"
                        }`}
                      >
                        {desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. 취소 및 적용 버튼 */}
            <div className="flex items-center gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setSelectedCandidate(null)}
                className="flex-1 rounded-2xl h-11 text-xs font-bold border-input"
              >
                {t("common.cancel")}
              </Button>
              <Button
                onClick={() => {
                  applyCandidateToField(
                    selectedCandidate.kind,
                    selectedCandidate.targetField,
                    selectedCandidate.amount,
                    selectedCandidate.cand.label
                  );
                  setSelectedCandidate(null);
                }}
                className="flex-1 rounded-2xl h-11 text-xs font-bold bg-gradient-to-r from-primary to-[#1D4A88] text-primary-foreground shadow-md shadow-primary/20"
              >
                {t("pay.candidate.modalApplyBtn")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );

  const manualDrawer = (
    <Drawer open={editingKind !== null} onOpenChange={(open) => !open && setEditingKind(null)}>
      <DrawerContent className="p-5">
        <DrawerHeader>
          <DrawerTitle>{editingKind && t(DOC_META[editingKind].labelKey)}</DrawerTitle>
          <DrawerDescription>{t("common.manualInput")}</DrawerDescription>
        </DrawerHeader>
        {editingKind && (
          <div className="space-y-4 pt-2">
            {/* 금액 후보군(candidateAmounts) 선택 칩 영역 */}
            {candidates[editingKind] && candidates[editingKind].length > 0 && (
              <div className="rounded-2xl bg-primary/5 border border-primary/20 p-3.5 space-y-2">
                <span className="text-[11px] font-extrabold text-primary flex items-center gap-1.5">
                  <Sparkles className="size-3.5" /> {t("pay.candidate.title")}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {candidates[editingKind].map((cand, idx) => {
                    const isRec = isCandidateRecommended(editingKind, cand.label);
                    const translatedLabel = translateCandidateLabel(cand.label, t);
                    const targetField = getCandidateTargetField(editingKind, cand.label);
                    const isCurrentVal = docs[editingKind]?.fields[targetField] === cand.amount;

                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => applyCandidate(editingKind, cand)}
                        className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold shadow-2xs transition-all active:scale-95 cursor-pointer ${
                          isCurrentVal
                            ? "bg-primary text-primary-foreground border-primary shadow-xs"
                            : isRec
                            ? "bg-primary/10 text-primary border-primary/40 hover:bg-primary/20"
                            : "bg-card hover:bg-muted text-foreground border-border/80"
                        }`}
                      >
                        {isRec && (
                          <span
                            className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${
                              isCurrentVal ? "bg-white/25 text-white" : "bg-primary/20 text-primary"
                            }`}
                          >
                            ✨ {t("pay.candidate.aiRecommended")}
                          </span>
                        )}
                        <span
                          className={
                            isCurrentVal
                              ? "text-primary-foreground/90 text-[10px]"
                              : "text-muted-foreground text-[10px]"
                          }
                        >
                          {translatedLabel}:
                        </span>
                        <span
                          className={
                            isCurrentVal ? "font-black text-primary-foreground" : "font-extrabold text-primary"
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

            <div className="space-y-3">
              {(Object.keys(FIELD_LABEL_KEYS) as (keyof Omit<DocFields, "period">)[]).map((k) => {
                const val = docs[editingKind]?.fields[k];
                return (
                  <div key={k} className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-muted-foreground">
                      {t(FIELD_LABEL_KEYS[k])}
                    </span>
                    <Input
                      type={k === "payDate" ? "date" : k === "payDay" ? "number" : "number"}
                      min={k === "payDay" ? 1 : undefined}
                      max={k === "payDay" ? 31 : undefined}
                      value={
                        k === "payDate"
                          ? typeof val === "string" && val.includes("T")
                            ? val.split("T")[0]
                            : (val ?? "")
                          : (val ?? "")
                      }
                      onChange={(e) =>
                        updateField(
                          editingKind,
                          k,
                          e.target.value
                            ? k === "payDate"
                              ? e.target.value
                              : Number(e.target.value)
                            : null
                        )
                      }
                      className="w-48 text-right text-xs font-bold rounded-2xl border border-input bg-background shadow-xs focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </div>
                );
              })}
            </div>

            <Button
              className="mt-4 w-full rounded-2xl bg-gradient-to-r from-primary to-[#1D4A88] text-primary-foreground font-bold shadow-md shadow-primary/20"
              onClick={() => setEditingKind(null)}
            >
              {t("common.done")}
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
        row.item === "기본급"
          ? t("pay.field.basePay")
          : row.item === "실지급액"
          ? t("pay.field.netPay")
          : row.item,
    }));
    const localizedResult = { ...result, rows: localizedRows };
    setAnalysis(localizedResult);

    const contractBase =
      typeof docs.contract?.fields.basePay === "number"
        ? docs.contract.fields.basePay
        : docs.contract?.fields.basePay
        ? Number(String(docs.contract.fields.basePay).replace(/[^0-9.-]+/g, "")) || undefined
        : undefined;

    const statementBase =
      typeof docs.statement?.fields.basePay === "number"
        ? docs.statement.fields.basePay
        : docs.statement?.fields.basePay
        ? Number(String(docs.statement.fields.basePay).replace(/[^0-9.-]+/g, "")) || undefined
        : undefined;

    const statementNet =
      typeof docs.statement?.fields.netPay === "number"
        ? docs.statement.fields.netPay
        : docs.statement?.fields.netPay
        ? Number(String(docs.statement.fields.netPay).replace(/[^0-9.-]+/g, "")) || undefined
        : undefined;

    const depositNet =
      typeof docs.deposit?.fields.netPay === "number"
        ? docs.deposit.fields.netPay
        : docs.deposit?.fields.netPay
        ? Number(String(docs.deposit.fields.netPay).replace(/[^0-9.-]+/g, "")) || undefined
        : undefined;

    // 1. 프론트엔드 룰 엔진이 발견한 핵심 불일치 finding의 차액
    const primaryFinding = result.findings[0];
    const findingDiff = primaryFinding?.difference != null ? primaryFinding.difference : undefined;

    // 2. 기본급 차액 (명세서 기본급 - 계약서 기본급: 음수면 삭감)
    const baseDiff =
      contractBase !== undefined && statementBase !== undefined
        ? statementBase - contractBase
        : undefined;

    // 3. 실지급액 차액 (입금액 - 명세서 실지급액: 음수면 부족)
    const netDiff =
      statementNet !== undefined && depositNet !== undefined
        ? depositNet - statementNet
        : undefined;

    // 백엔드로 보낼 대표 금액 차액 (통화 단위):
    // 1순위: 기본급 차액 (명세 기본급 vs 계약 기본급 불일치)
    // 2순위: 실지급액 차액 (통장 입금액 vs 명세 실지급액 불일치)
    // 그 외(지연 일수, 누락 문서 수 등)는 금액 차액이 아니므로 0
    const effectiveDifference =
      baseDiff !== undefined && Math.abs(baseDiff) > 0
        ? baseDiff
        : netDiff !== undefined && Math.abs(netDiff) > 0
        ? netDiff
        : 0;

    const rawExpected = docs.statement?.fields.payDate || `${period}-25`;
    const expectedDate = rawExpected.includes("T") ? rawExpected.split("T")[0] : rawExpected.slice(0, 10);

    const rawActual = docs.deposit?.fields.payDate;
    const actualDate = rawActual
      ? (rawActual.includes("T") ? rawActual : `${rawActual.slice(0, 10)}T09:14:00`)
      : `${period}-25T09:14:00`;

    let backendPaycheckId: number | undefined;
    try {
      const beRes = await analyzePaycheckApi({
        payPeriod: period,
        contractAmount: contractBase,
        payslipAmount: statementNet ?? statementBase,
        actualAmount: depositNet,
        differenceAmount: effectiveDifference,
        expectedPaymentDate: expectedDate,
        paymentDate: actualDate,
      });
      if (beRes?.paycheck?.paycheckId) {
        backendPaycheckId = beRes.paycheck.paycheckId;
      }
    } catch (err) {
      console.warn("analyzePaycheckApi call failed:", err);
    }

    const assignedId = backendPaycheckId
      ? `be-pay-${backendPaycheckId}`
      : rec?.id ?? uid("pay");

    setActivePaycheckId(backendPaycheckId);

    const newRec: PayRecord = {
      id: assignedId,
      period,
      workplace: state.employment?.workplace ?? "",
      checkedAt: new Date().toISOString().slice(0, 10),
      paidAmount: docs.deposit?.fields.netPay ?? null,
      documents: docs,
      analysis: localizedResult,
    };

    upsertPayRecord(newRec);

    void saveResult({
      kind: "pay",
      payPeriod: period,
      workplace: state.employment?.workplace ?? "",
      status: result.overallStatus,
      differenceAmount: result.findings[0]?.difference ?? null,
      paidAmount: docs.deposit?.fields.netPay ?? null,
      findingCount: result.findings.length,
      documents: docs,
      employment: state.employment,
    });

    // 캘린더에 급여 확인 일정 등록
    const eventDate = docs.deposit?.fields.payDate?.slice(0, 10) || `${period}-25`;
    const todayStr = new Date().toISOString().slice(0, 10);
    const isNormal = result.overallStatus === "MATCH";

    // 1. 분석 당일(오늘) 점검 완료 핀
    addEvent({
      title: `${monthLabel(period, locale)} 급여 점검 완료 (${won(depositNet)})`,
      type: "PAYCHECK",
      date: todayStr,
      time: "09:00",
      description: `${state.employment?.workplace || "근무지"} ${period} 급여 ${
        isNormal ? "정상 입금 확인" : "차액 확인 필요"
      }`,
      completed: false,
      auto: true,
    });

    // 2. 급여 입금일 일정 유지
    if (eventDate !== todayStr) {
      addEvent({
        title: `${monthLabel(period, locale)} 급여 입금 (${won(depositNet)})`,
        type: "PAYCHECK",
        date: eventDate,
        time: "09:00",
        description: `${state.employment?.workplace || "근무지"} ${period} 정기 급여 입금`,
        completed: false,
        auto: true,
      });
    }

    // 백엔드 생성 캘린더 일정 및 분석 결과 동기화
    void refreshFromBackend();

    setAnalyzing(false);
    toast.success(t("pay.savedToast"));
    setStep(5);
  };

  /* ---------------- Step -1: 시작 화면 (WizardStart) + 이전 급여 내역 리스트 ---------------- */
  if (step < 0) {
    return (
      <AppShell title={t("pay.title")} subtitle={t("pay.subtitle")}>
        <WizardStart
          icon={<Wallet className="size-7 text-primary" />}
          title={t("pay.startTitle")}
          description={t("pay.startDesc")}
          cta={t("pay.startCta")}
          onStart={handleStartNewCheck}
          disabled={isBeforePayday}
        >
          <div className="rounded-3xl bg-card border border-border/70 p-5 shadow-xs backdrop-blur-md">
            <label className="text-xs font-bold text-muted-foreground" htmlFor="period">
              {t("pay.month")}
            </label>
            <div className="mt-2.5 flex items-center gap-3">
              <Input
                id="period"
                type="month"
                value={period}
                onChange={(e) => {
                  hasUserChangedPeriodRef.current = true;
                  const next = e.target.value || getInitialPayPeriod(userPayDay);
                  setPeriod(next);
                }}
                className="h-12 flex-1 rounded-2xl text-sm font-bold border border-input bg-background shadow-xs focus-visible:ring-2 focus-visible:ring-ring"
              />
              <span className="text-sm font-black text-primary">
                {monthLabel(period, locale)}
              </span>
            </div>

            {/* 미도래 월(급여일 전)인 경우 안내 카드 및 D-Day 배지 노출 */}
            {isBeforePayday && (
              <div className="mt-4 rounded-2xl bg-warn/10 border border-warn/30 p-4 text-xs font-semibold text-warn-foreground space-y-2 pc-rise">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-warn flex items-center gap-1.5">
                    <AlertTriangle className="size-4 shrink-0 text-warn" />
                    아직 {Number(period.split("-")[1])}월 급여일({Number(period.split("-")[1])}월 {userPayDay}일) 전입니다
                  </span>
                  <span className="rounded-full bg-warn/25 px-2.5 py-0.5 text-[11px] font-black text-warn">
                    {dDayText}
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  급여 입금 후 대조할 수 있습니다. 이미 완료된 지난달 급여를 확인하시려면 이전 월을 선택해 주세요.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    hasUserChangedPeriodRef.current = true;
                    setPeriod(getInitialPayPeriod(userPayDay));
                  }}
                  className="mt-1 h-8 rounded-xl text-xs font-bold border-warn/40 bg-background text-foreground hover:bg-warn/15 shadow-2xs"
                >
                  직전 완료 월({monthLabel(getInitialPayPeriod(userPayDay), locale)}) 선택하기
                </Button>
              </div>
            )}

            <p className="mt-3.5 flex items-center gap-1.5 text-[11px] font-medium leading-relaxed text-muted-foreground">
              <ShieldCheck className="size-4 text-primary shrink-0" />
              {t("pay.privacy")}
            </p>
          </div>
        </WizardStart>

        {/* 이전 급여 확인 기록 섹션 (백엔드 API 연동) */}
        <section className="mt-8 space-y-3 pc-rise">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="size-4 text-primary" />
              <h3 className="text-sm font-extrabold text-foreground">{t("pay.history.title")}</h3>
            </div>
          </div>

          <div className="space-y-2.5">
            {historyRecords.length === 0 ? (
              <div className="rounded-3xl bg-card border border-border/70 p-8 text-center text-xs font-semibold text-muted-foreground shadow-xs backdrop-blur-md">
                {t("pay.history.empty")}
              </div>
            ) : (
              historyRecords.map((r) => {
                const status = r.analysis?.overallStatus ?? "MATCH";
                const isMatch = status === "MATCH";
                const isEx = status === "EXPLANATION_REQUIRED";

                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelectedRecord(r)}
                    className="flex w-full items-center justify-between rounded-3xl bg-card border border-border/70 p-4 shadow-xs backdrop-blur-md transition-all hover:scale-[1.01] hover:border-primary/40 text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-xs">
                        <Receipt className="size-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-foreground">
                            {monthLabel(r.period, locale)}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                              isMatch
                                ? "bg-info-soft text-info-foreground dark:text-info"
                                : isEx
                                ? "bg-warn-soft text-warn-foreground dark:text-warn"
                                : "bg-destructive/15 text-destructive"
                            }`}
                          >
                            {status}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {r.workplace || t("pay.history.noWorkplace")} · {t("pay.history.checkedDate", { date: formatKDate(r.checkedAt) })}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-primary">
                        {r.paidAmount ? won(r.paidAmount) : t("pay.history.noAmount")}
                      </span>
                      <Eye className="size-4 text-muted-foreground" />
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        {/* 이전 기록 상세 다이얼로그 모달 */}
        <Dialog open={selectedRecord !== null} onOpenChange={(open) => !open && setSelectedRecord(null)}>
          <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-3xl p-6 border border-border bg-card text-card-foreground shadow-2xl z-[100]">
            <DialogHeader>
              <DialogTitle className="text-base font-extrabold text-foreground flex items-center gap-2">
                <Receipt className="size-5 text-primary" />
                {selectedRecord &&
                  t("pay.report.historyDetail", {
                    month: monthLabel(selectedRecord.period, locale),
                  })}
              </DialogTitle>
            </DialogHeader>

            {selectedRecord && selectedRecord.analysis && (
              <div className="space-y-4 pt-2">
                <AnalysisReport
                  paycheckId={
                    selectedRecord.id.startsWith("be-pay-")
                      ? Number(selectedRecord.id.replace("be-pay-", ""))
                      : !isNaN(Number(selectedRecord.id))
                      ? Number(selectedRecord.id)
                      : undefined
                  }
                  finding={dialogFinding}
                  period={selectedRecord.period}
                  workplace={selectedRecord.workplace}
                />

                {/* 3중 대조표 */}
                {selectedRecord.analysis.rows && selectedRecord.analysis.rows.length > 0 && (
                  <div className="rounded-2xl bg-muted/60 p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-extrabold text-foreground">{t("pay.report.tableTitle")}</h4>
                      <span className="text-[10px] font-semibold text-muted-foreground">{t("pay.report.tableSub")}</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead>
                          <tr className="border-b border-border/50 text-[11px] font-bold text-muted-foreground">
                            <th className="pb-2 font-extrabold">{t("pay.report.thItem")}</th>
                            <th className="pb-2 text-center">{t("rule.doc.contract")}</th>
                            <th className="pb-2 text-center">{t("rule.doc.statement")}</th>
                            <th className="pb-2 text-right">{t("rule.doc.deposit")}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30">
                          {selectedRecord.analysis.rows.map((row, idx) => (
                            <tr key={idx} className="py-1.5">
                              <td className="py-2 font-bold text-muted-foreground">{row.item}</td>
                              <td className="py-2 text-center font-medium text-foreground">{row.contract}</td>
                              <td className="py-2 text-center font-medium text-foreground">{row.statement}</td>
                              <td className="py-2 text-right font-extrabold text-primary">{row.deposit}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <Button
                    onClick={() => setSelectedRecord(null)}
                    className="rounded-2xl bg-gradient-to-r from-primary to-[#1D4A88] text-primary-foreground text-xs font-bold shadow-md shadow-primary/20"
                  >
                    {t("common.close")}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
        {manualDrawer}
        {candidateModal}
      </AppShell>
    );
  }

  /* ---------------- Step 0, 1, 2: 직관성이 강화된 서류별 단계 플로우 ---------------- */
  if (step <= 2) {
    const currentKind = DOC_ORDER[step];
    const meta = DOC_META[currentKind];
    const currentDoc = docs[currentKind];
    const isReading = reading[currentKind];
    const isDone = Boolean(currentDoc?.fields.basePay || currentDoc?.fields.netPay);
    const Icon = meta.icon;
    const isBankAutoDeposit = currentKind === "deposit" && currentDoc?.source === "bank_auto";

    return (
      <AppShell title={t("pay.title")} subtitle={monthLabel(period, locale)}>
        {/* 상단 서류 준비 상태 직관 가이드 칩 */}
        <div className="mb-4 flex items-center justify-between rounded-3xl bg-card border border-border/70 p-4 shadow-xs backdrop-blur-md">
          {DOC_ORDER.map((k, idx) => {
            const done = Boolean(docs[k]?.fields.basePay || docs[k]?.fields.netPay);
            const isCurrent = step === idx;
            return (
              <div
                key={k}
                className={`flex items-center gap-1.5 text-xs font-bold ${
                  isCurrent
                    ? "text-primary font-black scale-105"
                    : done
                    ? "text-primary dark:text-primary-foreground opacity-90"
                    : "text-muted-foreground opacity-50"
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
          nextLabel={t("common.next")}
        >
          <div className="rounded-3xl bg-card border border-border/70 p-6 shadow-xs backdrop-blur-md space-y-4">
            <div className="flex items-center gap-3 border-b border-border/40 pb-4">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-xs">
                <Icon className="size-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-foreground">{t(meta.labelKey)}</h3>
                <p className="text-xs font-semibold text-muted-foreground">{t(meta.hintKey)}</p>
              </div>
            </div>

            {/* Step 2 입금내역 자동 연동 카드 또는 일반 서류 액션 버튼 */}
            {isBankAutoDeposit ? (
              <div className="rounded-3xl bg-gradient-to-br from-primary/10 via-[#1D4A88]/10 to-info/10 border border-primary/30 p-5 shadow-xs backdrop-blur-md space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-xs">
                      <Landmark className="size-5" />
                    </div>
                    <div>
                      <span className="text-xs font-black text-foreground">{currentDoc?.fileName || "하나은행"}</span>
                      <p className="text-[11px] font-semibold text-muted-foreground">{currentDoc?.note}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-[10px] font-black text-primary border border-primary/20">
                    ✨ {t("pay.bank.autoBadge")}
                  </span>
                </div>

                <div className="rounded-2xl bg-background/80 border border-border/60 p-3.5 flex items-center justify-between">
                  <span className="text-xs font-bold text-muted-foreground">{t("pay.field.netPay")}</span>
                  <span className="text-base font-black text-primary">{won(currentDoc?.fields.netPay ?? 0)}</span>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingKind("deposit")}
                    className="flex-1 rounded-xl text-xs font-bold border border-input bg-card shadow-xs hover:bg-accent"
                  >
                    {t("pay.bank.changeManually")}
                  </Button>
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-input bg-card px-3 py-2 text-xs font-bold text-foreground shadow-xs hover:bg-accent transition-all">
                    <Upload className="size-3.5" />
                    {t("common.upload")}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void handleUpload("deposit", file);
                      }}
                    />
                  </label>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={syncingBank}
                    onClick={() => void fetchBankSalary(period)}
                    className="rounded-xl text-xs font-bold text-muted-foreground hover:text-primary"
                  >
                    {syncingBank ? <Loader2 className="size-3.5 animate-spin" /> : t("pay.bank.syncAgain")}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2.5 pt-2">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-[#1D4A88] px-5 py-3 text-xs font-bold text-primary-foreground shadow-md shadow-primary/20 hover:scale-[1.01] active:scale-[0.99] transition-all">
                  <Upload className="size-4" />
                  {t("common.upload")}
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
                  className="h-11 rounded-2xl text-xs font-bold border border-input bg-card shadow-xs hover:bg-accent hover:text-accent-foreground"
                  onClick={() => setEditingKind(currentKind)}
                >
                  {t("common.manualInput")}
                </Button>
              </div>
            )}

            {!isDone && !isReading && (
              <div className="rounded-2xl bg-warn/10 border border-warn/20 p-3.5 text-xs font-semibold text-warn-foreground">
                ⚠️ {t("pay.step.uploadNotice")}
              </div>
            )}

            {isReading && (
              <div className="flex items-center gap-2.5 rounded-2xl bg-primary/10 p-4 text-xs font-bold text-primary shadow-xs">
                <Loader2 className="size-4 animate-spin text-primary" />
                {t("pay.readingDoc", { doc: t(meta.labelKey) })}
              </div>
            )}

            {isDone && !isReading && !isBankAutoDeposit && (
              <div className="space-y-3 pt-1">
                {/* 1. 업로드된 문서 요약 카드 및 실시간 반영 급여 상세 */}
                <div className="rounded-2xl bg-primary/5 border border-primary/20 p-4 text-xs font-semibold leading-relaxed text-foreground shadow-xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <p className="font-extrabold text-primary flex items-center gap-1.5">
                      <CheckCircle2 className="size-4 text-primary" />
                      {currentKind === "contract" &&
                        t("pay.doc.extractedContract", {
                          amount: won(currentDoc?.fields.basePay ?? 0),
                        })}
                      {currentKind === "statement" &&
                        t("pay.doc.extractedStatement", {
                          amount: won(currentDoc?.fields.netPay ?? currentDoc?.fields.basePay ?? 0),
                        })}
                      {currentKind === "deposit" &&
                        t("pay.doc.extractedDeposit", {
                          amount: won(currentDoc?.fields.netPay ?? 0),
                        })}
                    </p>
                    {currentDoc?.fileName && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-primary/10 text-primary truncate max-w-[140px]">
                        📄 {currentDoc.fileName}
                      </span>
                    )}
                  </div>
                  {currentDoc?.note && (
                    <p className="text-[11px] text-muted-foreground pt-0.5">{currentDoc.note}</p>
                  )}

                  {/* 현재 문서에 반영된 급여 세부 내역 실시간 표시 카드 그리드 */}
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-primary/10">
                    {currentDoc?.fields.basePay !== null && currentDoc?.fields.basePay !== undefined && (
                      <div className="rounded-xl border border-border/70 bg-card/90 p-2.5 flex items-center justify-between shadow-2xs">
                        <span className="text-[10px] font-bold text-muted-foreground">{t("pay.field.basePay")}</span>
                        <span className="text-xs font-black text-foreground">{won(currentDoc.fields.basePay)}</span>
                      </div>
                    )}
                    {currentDoc?.fields.netPay !== null && currentDoc?.fields.netPay !== undefined && (
                      <div className="rounded-xl border border-primary/30 bg-primary/10 p-2.5 flex items-center justify-between shadow-2xs">
                        <span className="text-[10px] font-bold text-primary">{t("pay.field.netPay")}</span>
                        <span className="text-xs font-black text-primary">{won(currentDoc.fields.netPay)}</span>
                      </div>
                    )}
                    {currentDoc?.fields.allowances !== null && currentDoc?.fields.allowances !== undefined && currentDoc.fields.allowances > 0 && (
                      <div className="rounded-xl border border-border/70 bg-card/90 p-2.5 flex items-center justify-between shadow-2xs">
                        <span className="text-[10px] font-bold text-muted-foreground">{t("pay.field.allowances")}</span>
                        <span className="text-xs font-black text-foreground">{won(currentDoc.fields.allowances)}</span>
                      </div>
                    )}
                    {currentDoc?.fields.deductions !== null && currentDoc?.fields.deductions !== undefined && currentDoc.fields.deductions > 0 && (
                      <div className="rounded-xl border border-border/70 bg-card/90 p-2.5 flex items-center justify-between shadow-2xs">
                        <span className="text-[10px] font-bold text-muted-foreground">{t("pay.field.deductions")}</span>
                        <span className="text-xs font-black text-foreground">{won(currentDoc.fields.deductions)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. 문서에서 감지된 금액 후보군 칩 UI (AI 스마트 추천 포함) */}
                {candidates[currentKind] && candidates[currentKind].length > 0 && (
                  <div className="rounded-2xl bg-muted/50 border border-border/70 p-3.5 space-y-2">
                    <span className="text-[11px] font-extrabold text-foreground flex items-center gap-1.5">
                      <Sparkles className="size-3.5 text-primary" />
                      {t("pay.candidate.title")}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {candidates[currentKind].map((cand, idx) => {
                        const isRec = isCandidateRecommended(currentKind, cand.label);
                        const translatedLabel = translateCandidateLabel(cand.label, t);
                        const targetField = getCandidateTargetField(currentKind, cand.label);
                        const isCurrentVal = currentDoc?.fields[targetField] === cand.amount;

                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => applyCandidate(currentKind, cand)}
                            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold shadow-2xs transition-all active:scale-95 cursor-pointer ${
                              isCurrentVal
                                ? "bg-primary text-primary-foreground border-primary shadow-xs"
                                : isRec
                                ? "bg-primary/10 text-primary border-primary/40 hover:bg-primary/20"
                                : "bg-card hover:bg-muted text-foreground border-border/80"
                            }`}
                          >
                            {isRec && (
                              <span
                                className={`text-[9px] font-black px-1.5 py-0.5 rounded-md ${
                                  isCurrentVal ? "bg-white/25 text-white" : "bg-primary/20 text-primary"
                                }`}
                              >
                                ✨ {t("pay.candidate.aiRecommended")}
                              </span>
                            )}
                            <span
                              className={
                                isCurrentVal
                                  ? "text-primary-foreground/90 text-[10px]"
                                  : "text-muted-foreground text-[10px]"
                              }
                            >
                              {translatedLabel}:
                            </span>
                            <span
                              className={
                                isCurrentVal ? "font-black text-primary-foreground" : "font-extrabold text-primary"
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
        {candidateModal}
      </AppShell>
    );
  }

  /* ---------------- Step 3: 추출된 3개 서류 요약 확인 ---------------- */
  if (step === 3) {
    const confirmedCount = DOC_ORDER.filter(
      (k) => Boolean(docs[k]?.fields.basePay || docs[k]?.fields.netPay)
    ).length;

    return (
      <AppShell title={t("pay.title")} subtitle={monthLabel(period, locale)}>
        <WizardStep
          index={3}
          total={6}
          title={t("pay.step4")}
          hint={t("pay.startDesc")}
          onPrev={() => setStep(2)}
        >
          {confirmedCount === 0 ? (
            /* 서류가 3개 모두 없을 때 표시하는 전용 빈 화면 */
            <div className="rounded-3xl bg-card border border-destructive/20 p-6 shadow-xs backdrop-blur-md text-center space-y-4">
              <div className="mx-auto flex size-14 items-center justify-center rounded-3xl bg-destructive/10 text-destructive">
                <FileText className="size-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-foreground">{t("pay.noDocs.title")}</h3>
                <p className="text-xs leading-relaxed text-muted-foreground max-w-sm mx-auto">
                  {t("pay.noDocs.desc")}
                </p>
              </div>

              <div className="space-y-2.5 pt-3">
                <Button
                  onClick={() => setStep(0)}
                  className="w-full h-12 rounded-2xl bg-gradient-to-r from-primary to-[#1D4A88] text-primary-foreground font-bold shadow-md shadow-primary/20"
                >
                  <Upload className="mr-2 size-4" />
                  {t("pay.noDocs.uploadFirst")}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => setEditingKind("contract")}
                  className="w-full h-12 rounded-2xl border border-input bg-card font-bold shadow-xs hover:bg-accent"
                >
                  {t("common.manualInput")}
                </Button>
              </div>

              <p className="text-[11px] font-bold text-destructive pt-1">
                ⚠️ {t("pay.noDocs.warning")}
              </p>
            </div>
          ) : (
            <div className="space-y-3.5">
              <div className="rounded-2xl bg-muted/60 p-3.5 text-[11px] font-semibold text-muted-foreground">
                {t("pay.doc.monthlyNotice")}
              </div>

              {DOC_ORDER.map((kind) => {
                const meta = DOC_META[kind];
                const doc = docs[kind];
                const Icon = meta.icon;
                const val =
                  kind === "contract"
                    ? doc?.fields.basePay
                    : kind === "statement"
                    ? doc?.fields.netPay ?? doc?.fields.basePay
                    : doc?.fields.netPay;

                return (
                  <div
                    key={kind}
                    className="flex items-center justify-between rounded-3xl bg-card border border-border/70 p-4.5 shadow-xs backdrop-blur-md"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary shadow-xs">
                        <Icon className="size-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-foreground">{t(meta.labelKey)}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {doc?.confirmed ? t("pay.confirmed") : t("pay.unconfirmed")}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-sm font-black text-primary">
                          {val ? won(val) : "-"}
                        </span>
                        {kind === "statement" && doc?.fields.basePay && doc?.fields.netPay && doc.fields.basePay !== doc.fields.netPay && (
                          <p className="text-[10px] font-semibold text-muted-foreground">
                            {t("pay.field.basePay")}: {won(doc.fields.basePay)}
                          </p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 rounded-xl px-2 text-[11px] font-bold text-muted-foreground hover:text-primary hover:bg-accent"
                        onClick={() => setEditingKind(kind)}
                      >
                        {t("common.edit")}
                      </Button>
                    </div>
                  </div>
                );
              })}

              <Button
                onClick={runAnalysis}
                className="mt-6 h-14 w-full rounded-2xl bg-gradient-to-r from-primary to-[#1D4A88] text-primary-foreground text-base font-bold shadow-lg shadow-primary/20 hover:scale-[1.01] transition-all"
              >
                {t("pay.analyzeCta")}
                <ArrowRight className="ml-2 size-5" />
              </Button>
            </div>
          )}
        </WizardStep>
        {manualDrawer}
        {candidateModal}
      </AppShell>
    );
  }

  /* ---------------- Step 4: 세 자료 대조 분석 진행 중 (AI 체킹) ---------------- */
  if (step === 4 || analyzing) {
    return (
      <AppShell title={t("pay.title")} subtitle={monthLabel(period, locale)}>
        <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
          <div className="relative flex size-20 items-center justify-center rounded-3xl bg-primary/10 text-primary shadow-xs">
            <Loader2 className="size-10 animate-spin text-primary" />
          </div>
          <h3 className="mt-6 text-xl font-black text-foreground">{t("pay.analyzing")}</h3>
          <p className="mt-2 text-xs font-semibold text-muted-foreground">
            {t("pay.analyzingDesc")}
          </p>
        </div>
        {manualDrawer}
        {candidateModal}
      </AppShell>
    );
  }

  /* ---------------- Step 5: 최종 3중 대조 분석 결과 레포트 ---------------- */
  return (
    <AppShell title={t("pay.title")} subtitle={monthLabel(period, locale)}>
      <div className="space-y-5 pc-rise">
        <div className="flex items-center justify-between rounded-3xl bg-card border border-border/70 p-4 shadow-xs backdrop-blur-md">
          <span className="text-xs font-bold text-muted-foreground">
            {t("pay.report.periodLabel", { month: monthLabel(period, locale) })}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-2xl text-xs font-bold shadow-xs border border-input bg-card"
              onClick={() => setStep(-1)}
            >
              {t("pay.history.title")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-2xl text-xs font-bold shadow-xs"
              onClick={() => setStep(0)}
            >
              {t("common.again")}
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
          <div className="rounded-3xl bg-card border border-border/70 p-5 shadow-xs backdrop-blur-md space-y-4">
            {/* 상단 헤더 및 뷰 전환 탭 */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-3">
              <div>
                <h4 className="text-sm font-extrabold text-foreground flex items-center gap-1.5">
                  ✨ {t("pay.table")}
                  <span className="text-[11px] font-medium text-muted-foreground">{t("pay.report.tableSub")}</span>
                </h4>
                <p className="text-[11px] font-medium text-muted-foreground mt-0.5">
                  {t("pay.report.tableHint")}
                </p>
              </div>

              {/* 보기 방식 전환 (3중 대조표 vs 서류별 보기) */}
              <div className="flex items-center rounded-xl bg-muted/80 p-1 border border-border/60 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setComparisonViewMode("table")}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                    comparisonViewMode === "table"
                      ? "bg-card text-primary shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t("pay.report.tabTable")}
                </button>
                <button
                  type="button"
                  onClick={() => setComparisonViewMode("tabs")}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                    comparisonViewMode === "tabs"
                      ? "bg-card text-primary shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t("pay.report.tabDocs")}
                </button>
              </div>
            </div>

            {/* 빠른 서류 확인·수정 바로가기 버튼 3종 */}
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <button
                type="button"
                onClick={() => setEditingKind("contract")}
                className="inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary transition-all shadow-2xs cursor-pointer active:scale-95"
              >
                <FileText className="size-3.5" />
                <span>{t("pay.report.btnCheckContract")}</span>
                <span className="text-[10px] opacity-75">({docs.contract?.fields.basePay ? won(docs.contract.fields.basePay, locale) : t("common.unknown")})</span>
              </button>

              <button
                type="button"
                onClick={() => setEditingKind("statement")}
                className="inline-flex items-center gap-1.5 rounded-xl border border-info/30 bg-info/5 hover:bg-info/10 px-3 py-1.5 text-xs font-bold text-info-foreground dark:text-info transition-all shadow-2xs cursor-pointer active:scale-95"
              >
                <Receipt className="size-3.5" />
                <span>{t("pay.report.btnCheckStatement")}</span>
                <span className="text-[10px] opacity-75">({docs.statement?.fields.netPay ? won(docs.statement.fields.netPay, locale) : t("common.unknown")})</span>
              </button>

              <button
                type="button"
                onClick={() => setEditingKind("deposit")}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-muted/60 hover:bg-muted px-3 py-1.5 text-xs font-bold text-foreground transition-all shadow-2xs cursor-pointer active:scale-95"
              >
                <Landmark className="size-3.5" />
                <span>{t("pay.report.btnCheckDeposit")}</span>
                <span className="text-[10px] opacity-75">({docs.deposit?.fields.netPay ? won(docs.deposit.fields.netPay, locale) : t("common.unknown")})</span>
              </button>
            </div>

            {/* 1. 전체 3중 대조 테이블 뷰 */}
            {comparisonViewMode === "table" && (
              <div className="overflow-x-auto pt-1">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-border/60 text-[11px] font-bold text-muted-foreground">
                      <th className="py-2.5 pr-3 font-extrabold">{t("pay.report.thItem")}</th>
                      <th className="py-2.5 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => setEditingKind("contract")}
                          className="hover:text-primary underline-offset-2 hover:underline inline-flex items-center gap-1"
                        >
                          {t("rule.doc.contract")} 📝
                        </button>
                      </th>
                      <th className="py-2.5 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => setEditingKind("statement")}
                          className="hover:text-primary underline-offset-2 hover:underline inline-flex items-center gap-1"
                        >
                          {t("rule.doc.statement")} 📑
                        </button>
                      </th>
                      <th className="py-2.5 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => setEditingKind("deposit")}
                          className="hover:text-primary underline-offset-2 hover:underline inline-flex items-center gap-1"
                        >
                          {t("rule.doc.deposit")} 🏦
                        </button>
                      </th>
                      <th className="py-2.5 pl-2 text-right">{t("pay.report.thResult")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {analysis.rows.map((row, idx) => {
                      const isMatch = row.status === "MATCH";
                      const isEx = row.status === "EXPLANATION_REQUIRED";
                      return (
                        <tr key={idx} className="hover:bg-muted/40 transition-colors">
                          <td className="py-3 pr-3 font-extrabold text-foreground">{row.item}</td>
                          <td
                            className="py-3 px-2 text-center text-muted-foreground font-semibold cursor-pointer hover:bg-primary/5 rounded-lg transition-colors"
                            onClick={() => setEditingKind("contract")}
                            title="클릭하여 근로계약서 수정"
                          >
                            {row.contract}
                          </td>
                          <td
                            className="py-3 px-2 text-center text-foreground font-bold cursor-pointer hover:bg-primary/5 rounded-lg transition-colors"
                            onClick={() => setEditingKind("statement")}
                            title="클릭하여 임금명세서 수정"
                          >
                            {row.statement}
                          </td>
                          <td
                            className="py-3 px-2 text-center text-primary font-black cursor-pointer hover:bg-primary/5 rounded-lg transition-colors"
                            onClick={() => setEditingKind("deposit")}
                            title="클릭하여 통장 입금내역 수정"
                          >
                            {row.deposit}
                          </td>
                          <td className="py-3 pl-2 text-right">
                            <span
                              className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-black ${
                                isMatch
                                  ? "bg-primary/10 text-primary border border-primary/20"
                                  : isEx
                                  ? "bg-warn/15 text-warn border border-warn/30"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {row.result || (isMatch ? "일치" : isEx ? "차액 확인" : "-")}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* 2. 서류별 탭 모아보기 뷰 (따로따로 클릭해서 보는 서류 전용 카드) */}
            {comparisonViewMode === "tabs" && (
              <div className="pt-1 space-y-3">
                <div className="flex items-center gap-1.5 rounded-2xl bg-muted/60 p-1.5">
                  <button
                    type="button"
                    onClick={() => setActiveDocTab("contract")}
                    className={`flex-1 rounded-xl py-2 text-xs font-black transition-all ${
                      activeDocTab === "contract"
                        ? "bg-card text-primary shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t("rule.doc.contract")} 📝
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveDocTab("statement")}
                    className={`flex-1 rounded-xl py-2 text-xs font-black transition-all ${
                      activeDocTab === "statement"
                        ? "bg-card text-primary shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t("rule.doc.statement")} 📑
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveDocTab("deposit")}
                    className={`flex-1 rounded-xl py-2 text-xs font-black transition-all ${
                      activeDocTab === "deposit"
                        ? "bg-card text-primary shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t("rule.doc.deposit")} 🏦
                  </button>
                </div>

                {/* 선택된 서류 상세 카드 */}
                {activeDocTab === "contract" && (
                  <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 space-y-3 pc-rise">
                    <div className="flex items-center justify-between border-b border-primary/15 pb-2.5">
                      <div className="flex items-center gap-2">
                        <FileText className="size-4 text-primary" />
                        <span className="text-xs font-black text-foreground">{t("pay.docTab.contractTitle")}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingKind("contract")}
                        className="h-7 rounded-lg text-[11px] font-bold border-primary/30 text-primary hover:bg-primary/10"
                      >
                        {t("pay.docTab.contractEdit")}
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="rounded-xl bg-background/80 p-3 border border-border/60">
                        <span className="text-muted-foreground text-[11px] font-medium">{t("pay.docTab.agreedBasePay")}</span>
                        <p className="text-sm font-black text-foreground mt-0.5">
                          {docs.contract?.fields.basePay ? won(docs.contract.fields.basePay, locale) : "-"}
                        </p>
                      </div>
                      <div className="rounded-xl bg-background/80 p-3 border border-border/60">
                        <span className="text-muted-foreground text-[11px] font-medium">{t("pay.docTab.agreedPayDay")}</span>
                        <p className="text-sm font-black text-primary mt-0.5">
                          {docs.contract?.fields.payDay
                            ? t("pay.docTab.monthlyDay", { day: String(docs.contract.fields.payDay) })
                            : (userPayDay ? t("pay.docTab.monthlyDay", { day: String(userPayDay) }) : "-")}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {activeDocTab === "statement" && (
                  <div className="rounded-2xl border border-info/25 bg-info/5 p-4 space-y-3 pc-rise">
                    <div className="flex items-center justify-between border-b border-info/20 pb-2.5">
                      <div className="flex items-center gap-2">
                        <Receipt className="size-4 text-info-foreground dark:text-info" />
                        <span className="text-xs font-black text-foreground">{t("pay.docTab.statementTitle")}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingKind("statement")}
                        className="h-7 rounded-lg text-[11px] font-bold border-info/30 text-info-foreground hover:bg-info/10"
                      >
                        {t("pay.docTab.statementEdit")}
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="rounded-xl bg-background/80 p-3 border border-border/60">
                        <span className="text-muted-foreground text-[11px] font-medium">{t("pay.docTab.statementBasePay")}</span>
                        <p className="text-sm font-black text-foreground mt-0.5">
                          {docs.statement?.fields.basePay ? won(docs.statement.fields.basePay, locale) : "-"}
                        </p>
                      </div>
                      <div className="rounded-xl bg-background/80 p-3 border border-border/60">
                        <span className="text-muted-foreground text-[11px] font-medium">{t("pay.docTab.allowances")}</span>
                        <p className="text-sm font-black text-foreground mt-0.5">
                          {docs.statement?.fields.allowances ? won(docs.statement.fields.allowances, locale) : "-"}
                        </p>
                      </div>
                      <div className="rounded-xl bg-background/80 p-3 border border-border/60">
                        <span className="text-muted-foreground text-[11px] font-medium">{t("pay.docTab.deductions")}</span>
                        <p className="text-sm font-black text-destructive mt-0.5">
                          {docs.statement?.fields.deductions ? won(docs.statement.fields.deductions, locale) : "-"}
                        </p>
                      </div>
                      <div className="rounded-xl bg-background/80 p-3 border border-border/60">
                        <span className="text-muted-foreground text-[11px] font-medium">{t("pay.docTab.netPay")}</span>
                        <p className="text-sm font-black text-primary mt-0.5">
                          {docs.statement?.fields.netPay ? won(docs.statement.fields.netPay, locale) : "-"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {activeDocTab === "deposit" && (
                  <div className="rounded-2xl border border-border/80 bg-muted/30 p-4 space-y-3 pc-rise">
                    <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
                      <div className="flex items-center gap-2">
                        <Landmark className="size-4 text-primary" />
                        <span className="text-xs font-black text-foreground">{t("pay.docTab.depositTitle")}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingKind("deposit")}
                        className="h-7 rounded-lg text-[11px] font-bold border-input text-foreground hover:bg-muted"
                      >
                        {t("pay.docTab.depositEdit")}
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="rounded-xl bg-background/80 p-3 border border-border/60">
                        <span className="text-muted-foreground text-[11px] font-medium">{t("pay.docTab.depositNetPay")}</span>
                        <p className="text-sm font-black text-primary mt-0.5">
                          {docs.deposit?.fields.netPay ? won(docs.deposit.fields.netPay, locale) : "-"}
                        </p>
                      </div>
                      <div className="rounded-xl bg-background/80 p-3 border border-border/60">
                        <span className="text-muted-foreground text-[11px] font-medium">{t("pay.docTab.actualDepositDate")}</span>
                        <p className="text-sm font-black text-foreground mt-0.5">
                          {docs.deposit?.fields.payDate || "-"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <Button
            onClick={() => setStep(-1)}
            className="flex-1 h-12 rounded-2xl bg-gradient-to-r from-primary to-[#1D4A88] text-primary-foreground text-xs font-bold shadow-md shadow-primary/20 hover:scale-[1.01] transition-all"
          >
            {t("pay.history.title")}
          </Button>
          <Button
            onClick={() => setStep(0)}
            variant="outline"
            className="flex-1 h-12 rounded-2xl border border-input bg-card text-foreground text-xs font-bold shadow-xs hover:bg-accent"
          >
            {t("common.again")}
          </Button>
        </div>
      </div>

      {manualDrawer}
      {candidateModal}
    </AppShell>
  );
}
