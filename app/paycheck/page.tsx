"use client";

import { useEffect, useMemo, useState } from "react";
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
import { formatKDate, monthLabel, periodOf, uid, won } from "@/lib/paycycle/format";
import { readDocument } from "@/services/ocr";
import { analyzePaycheckApi } from "@/services/api";
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

const FIELD_LABEL: Record<keyof Omit<DocFields, "period">, string> = {
  basePay: "기본급",
  allowances: "수당 합계",
  deductions: "공제 합계",
  netPay: "실지급액 / 입금액",
  payDay: "계약상 급여일(일)",
  payDate: "지급·입금일",
};

/** 백엔드 미동작 시 제공할 명시적 최근 2개월치 Fallback Mock 급여 확인 기록 */
const MOCK_FALLBACK_RECORDS: PayRecord[] = [
  {
    id: "pay-mock-2025-03",
    period: "2025-03",
    workplace: "(주)페이사이클 제이이노베이션",
    checkedAt: "2025-03-25",
    paidAmount: 2050000,
    documents: {
      contract: {
        kind: "contract",
        source: "sample",
        fileName: "contract-sample.png",
        fields: { period: "2025-03", basePay: 2100000, allowances: null, deductions: null, netPay: 2100000, payDay: 25, payDate: null },
        confirmed: true,
        masked: false,
        note: "계약 기본급 2,100,000원 확인",
      },
      statement: {
        kind: "statement",
        source: "sample",
        fileName: "statement-sample.png",
        fields: { period: "2025-03", basePay: 2100000, allowances: null, deductions: null, netPay: 2100000, payDay: null, payDate: "2025-03-25" },
        confirmed: true,
        masked: false,
        note: "명세서 실지급액 2,100,000원 확인",
      },
      deposit: {
        kind: "deposit",
        source: "sample",
        fileName: "deposit-sample.png",
        fields: { period: "2025-03", basePay: null, allowances: null, deductions: null, netPay: 2050000, payDay: null, payDate: "2025-03-25" },
        confirmed: true,
        masked: false,
        note: "실지급 입금액 2,050,000원 확인",
      },
    },
    analysis: {
      overallStatus: "EXPLANATION_REQUIRED",
      headline: "명세서 실지급액과 입금액 간 50,000원 차이 발생",
      detail: "근로기준법 기준 3중 대조 결과 차액 50,000원에 대한 설명이 필요합니다.",
      steps: [
        { label: "근로계약서 확인", ok: true, detail: "기본급 2,100,000원 대조 완료" },
        { label: "임금명세서 판독", ok: true, detail: "실지급액 2,100,000원 대조 완료" },
        { label: "실입금액 대조", ok: false, detail: "통장 실입금액 2,050,000원 (50,000원 차이)" },
      ],
      findings: [
        {
          id: "net",
          status: "EXPLANATION_REQUIRED",
          title: "명세서와 실제 입금액 차이",
          fact: "임금명세서의 실지급액은 2,100,000원인데 실제 입금액은 2,050,000원으로 50,000원의 차액이 발생했습니다.",
          standard: "근로기준법 제43조(임금 지급)",
          limitation: "별도 차액 공제 항목이 명세서에 기록되어 있지 않습니다.",
          nextActions: ["사업주에게 차액 산정 근거 확인 요청", "추가 공제 내역 서면 요청"],
          comparison: "EXPLANATION_REQUIRED",
          left: { label: "임금명세서 실지급액", amount: 2100000 },
          right: { label: "통장 실입금액", amount: 2050000 },
          difference: -50000,
          requiredEvidence: ["임금명세서", "통장 거래내역"],
          sources: ["statement", "deposit"],
          evidence: [],
        },
      ],
      rows: [
        { item: "기본급", contract: "2,100,000원", statement: "2,100,000원", deposit: "—", result: "2,100,000원 일치", status: "MATCH" },
        { item: "실지급액", contract: "—", statement: "2,100,000원", deposit: "2,050,000원", result: "50,000원 차이 발생", status: "EXPLANATION_REQUIRED" },
      ],
    },
  },
  {
    id: "pay-mock-2025-02",
    period: "2025-02",
    workplace: "(주)페이사이클 제이이노베이션",
    checkedAt: "2025-02-25",
    paidAmount: 2100000,
    documents: {
      contract: {
        kind: "contract",
        source: "sample",
        fileName: "contract-sample.png",
        fields: { period: "2025-02", basePay: 2100000, allowances: null, deductions: null, netPay: 2100000, payDay: 25, payDate: null },
        confirmed: true,
        masked: false,
        note: "계약 기본급 2,100,000원 확인",
      },
      statement: {
        kind: "statement",
        source: "sample",
        fileName: "statement-sample.png",
        fields: { period: "2025-02", basePay: 2100000, allowances: null, deductions: null, netPay: 2100000, payDay: null, payDate: "2025-02-25" },
        confirmed: true,
        masked: false,
        note: "명세서 실지급액 2,100,000원 확인",
      },
      deposit: {
        kind: "deposit",
        source: "sample",
        fileName: "deposit-sample.png",
        fields: { period: "2025-02", basePay: null, allowances: null, deductions: null, netPay: 2100000, payDay: null, payDate: "2025-02-25" },
        confirmed: true,
        masked: false,
        note: "실지급 입금액 2,100,000원 확인",
      },
    },
    analysis: {
      overallStatus: "MATCH",
      headline: "2025년 2월 급여 100% 정상 대조 완수",
      detail: "계약서 및 명세서, 실제 입금액이 완벽히 일치하여 정상 지급되었습니다.",
      steps: [
        { label: "근로계약서 확인", ok: true, detail: "기본급 2,100,000원 일치" },
        { label: "임금명세서 판독", ok: true, detail: "실지급액 2,100,000원 일치" },
        { label: "실입금액 대조", ok: true, detail: "통장 실입금액 2,100,000원 100% 일치" },
      ],
      findings: [
        {
          id: "base",
          status: "MATCH",
          title: "계약서, 명세서, 입금액 100% 일치",
          fact: "2025년 2월 급여가 계약서 및 임금명세서 기준과 정확히 일치하여 정상 지급되었습니다.",
          standard: "근로기준법 준수",
          limitation: "이상 특이사항 없음",
          nextActions: ["정상 확인 저장 완료"],
          comparison: "MATCH",
          left: { label: "계약 기본급", amount: 2100000 },
          right: { label: "통장 실입금액", amount: 2100000 },
          difference: 0,
          requiredEvidence: [],
          sources: ["contract", "statement", "deposit"],
          evidence: [],
        },
      ],
      rows: [
        { item: "기본급", contract: "2,100,000원", statement: "2,100,000원", deposit: "2,100,000원", result: "정상 일치", status: "MATCH" },
        { item: "실지급액", contract: "2,100,000원", statement: "2,100,000원", deposit: "2,100,000원", result: "정상 일치", status: "MATCH" },
      ],
    },
  },
];

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

export default function PayCheckPage() {
  const { state, hydrated, upsertPayRecord, saveResult } = usePayCycle();
  const { t, locale } = useT();

  const [step, setStep] = useState<number>(-1);
  const [period, setPeriod] = useState(() => periodOf(new Date()));
  const [editingKind, setEditingKind] = useState<DocKind | null>(null);

  // 이전 기록 상세 보기 다이얼로그 모달 상태
  const [selectedRecord, setSelectedRecord] = useState<PayRecord | null>(null);

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

  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<PaycheckAnalysis | null>(null);

  useEffect(() => {
    setDocs((prev) => {
      const c = prev.contract ?? defaultDoc("contract", period);
      const s = prev.statement ?? defaultDoc("statement", period);
      const d = prev.deposit ?? defaultDoc("deposit", period);
      return {
        contract: { ...c, fields: { ...c.fields, period } },
        statement: { ...s, fields: { ...s.fields, period } },
        deposit: { ...d, fields: { ...d.fields, period } },
      };
    });
  }, [period]);

  const rec = state.payRecords.find((r) => r.period === period);

  useEffect(() => {
    if (rec?.documents) {
      setDocs(rec.documents);
      if (rec.analysis) setAnalysis(rec.analysis);
    }
  }, [rec]);

  const historyRecords = useMemo(() => {
    if (state.payRecords && state.payRecords.length > 0) {
      return state.payRecords;
    }
    return MOCK_FALLBACK_RECORDS;
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

  if (!hydrated) {
    return (
      <AppShell title={t("pay.title")}>
        <p className="text-sm text-muted-foreground">…</p>
      </AppShell>
    );
  }

  const handleUpload = async (kind: DocKind, file: File) => {
    setReading((p) => ({ ...p, [kind]: true }));
    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      const res = await readDocument({ kind, file, dataUrl, period });
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
      setReading((p) => ({ ...p, [kind]: false }));
      if (res.ok) {
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    };
    reader.readAsDataURL(file);
  };

  const updateField = (kind: DocKind, key: keyof DocFields, val: any) => {
    setDocs((prev) => {
      const current = prev[kind] ?? defaultDoc(kind, period);
      return {
        ...prev,
        [kind]: {
          ...current,
          fields: { ...current.fields, [key]: val },
        },
      };
    });
  };

  const manualDrawer = (
    <Drawer open={editingKind !== null} onOpenChange={(open) => !open && setEditingKind(null)}>
      <DrawerContent className="p-5">
        <DrawerHeader>
          <DrawerTitle>{editingKind && t(DOC_META[editingKind].labelKey)}</DrawerTitle>
          <DrawerDescription>{t("common.manualInput")}</DrawerDescription>
        </DrawerHeader>
        {editingKind && (
          <div className="space-y-3 pt-2">
            {Object.keys(FIELD_LABEL).map((fKey) => {
              const k = fKey as keyof Omit<DocFields, "period">;
              const val = docs[editingKind]?.fields[k];
              return (
                <div key={k} className="flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold text-muted-foreground">
                    {FIELD_LABEL[k]}
                  </span>
                  <Input
                    type={k.includes("Date") || k.includes("Day") ? "text" : "number"}
                    value={val ?? ""}
                    onChange={(e) =>
                      updateField(
                        editingKind,
                        k,
                        e.target.value ? (k.includes("Date") ? e.target.value : Number(e.target.value)) : null
                      )
                    }
                    className="w-48 text-right text-xs font-bold rounded-2xl border border-input bg-background shadow-xs focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              );
            })}
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

  const runAnalysis = () => {
    setAnalyzing(true);
    setStep(4);
    setTimeout(() => {
      const result = analyzePaycheck(docs, state.employment, period);
      setAnalysis(result);
      setAnalyzing(false);

      const recordId = rec?.id ?? uid("pay");
      const newRec: PayRecord = {
        id: recordId,
        period,
        workplace: state.employment?.workplace ?? "",
        checkedAt: new Date().toISOString().slice(0, 10),
        paidAmount: docs.deposit?.fields.netPay ?? null,
        documents: docs,
        analysis: result,
      };

      upsertPayRecord(newRec);

      void analyzePaycheckApi({
        payPeriod: period,
      });

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

      toast.success(t("pay.savedToast"));
      setStep(5);
    }, 800);
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
          onStart={() => setStep(0)}
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
                  const next = e.target.value || periodOf(new Date());
                  setPeriod(next);
                }}
                className="h-12 flex-1 rounded-2xl text-sm font-bold border border-input bg-background shadow-xs focus-visible:ring-2 focus-visible:ring-ring"
              />
              <span className="text-sm font-black text-primary">
                {monthLabel(period)}
              </span>
            </div>
            <p className="mt-3.5 flex items-center gap-1.5 text-[11px] font-medium leading-relaxed text-muted-foreground">
              <ShieldCheck className="size-4 text-primary shrink-0" />
              {t("pay.privacy")}
            </p>
          </div>
        </WizardStart>

        {/* 이전 급여 확인 기록 섹션 (백엔드 API 기본연동 + Mock Fallback) */}
        <section className="mt-8 space-y-3 pc-rise">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="size-4 text-primary" />
              <h3 className="text-sm font-extrabold text-foreground">이전 급여 확인 내역</h3>
            </div>
            {state.payRecords.length === 0 && (
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-black text-primary">
                Mock 데이터 연동
              </span>
            )}
          </div>

          <div className="space-y-2.5">
            {historyRecords.map((r) => {
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
                          {monthLabel(r.period)}
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
                        {r.workplace || "사업주 미입력"} · 확인일: {formatKDate(r.checkedAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-primary">
                      {r.paidAmount ? won(r.paidAmount) : "내역 없음"}
                    </span>
                    <Eye className="size-4 text-muted-foreground" />
                  </div>
                </button>
              );
            })}
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
                    month: monthLabel(selectedRecord.period),
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
                  <div className="rounded-2xl bg-muted/60 p-4 space-y-2">
                    <h4 className="text-xs font-extrabold text-foreground">{t("pay.report.tableTitle")}</h4>
                    <div className="divide-y divide-border/40 text-xs">
                      {selectedRecord.analysis.rows.map((row, idx) => (
                        <div key={idx} className="flex items-center justify-between py-2">
                          <span className="font-bold text-muted-foreground">{row.item}</span>
                          <div className="flex items-center gap-2 font-semibold text-foreground">
                            <span>{row.statement}</span>
                            <ArrowRight className="size-3 text-muted-foreground" />
                            <span className="font-extrabold text-primary">{row.deposit}</span>
                          </div>
                        </div>
                      ))}
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

    return (
      <AppShell title={t("pay.title")} subtitle={monthLabel(period)}>
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

            {!isDone && !isReading && (
              <div className="rounded-2xl bg-warn/10 border border-warn/20 p-3.5 text-xs font-semibold text-warn-foreground">
                ⚠️ {t("pay.step.uploadNotice")}
              </div>
            )}

            {isReading && (
              <div className="flex items-center gap-2.5 rounded-2xl bg-primary/10 p-4 text-xs font-bold text-primary shadow-xs">
                <Loader2 className="size-4 animate-spin text-primary" />
                {t("common.reading")}
              </div>
            )}

            {isDone && !isReading && (
              <div className="rounded-2xl bg-primary/5 border border-primary/20 p-4 text-xs font-semibold leading-relaxed text-foreground shadow-xs space-y-1">
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
                {currentDoc?.note && (
                  <p className="text-[11px] text-muted-foreground pt-0.5">{currentDoc.note}</p>
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
    const confirmedCount = DOC_ORDER.filter(
      (k) => Boolean(docs[k]?.fields.basePay || docs[k]?.fields.netPay)
    ).length;

    return (
      <AppShell title={t("pay.title")} subtitle={monthLabel(period)}>
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
                      <span className="text-sm font-black text-primary">
                        {val ? won(val) : "-"}
                      </span>
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
      </AppShell>
    );
  }

  /* ---------------- Step 4: 세 자료 대조 분석 진행 중 (AI 체킹) ---------------- */
  if (step === 4 || analyzing) {
    return (
      <AppShell title={t("pay.title")} subtitle={monthLabel(period)}>
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
      </AppShell>
    );
  }

  /* ---------------- Step 5: 최종 3중 대조 분석 결과 레포트 ---------------- */
  return (
    <AppShell title={t("pay.title")} subtitle={monthLabel(period)}>
      <div className="space-y-5 pc-rise">
        <div className="flex items-center justify-between rounded-3xl bg-card border border-border/70 p-4 shadow-xs backdrop-blur-md">
          <span className="text-xs font-bold text-muted-foreground">
            {t("pay.report.periodLabel", { month: monthLabel(period) })}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-2xl text-xs font-bold shadow-xs"
            onClick={() => setStep(0)}
          >
            {t("common.again")}
          </Button>
        </div>

        {/* AI 심층 분석 리포트 */}
        <AnalysisReport
          finding={resultFinding}
          period={period}
          workplace={state.employment?.workplace}
        />

        {analysis?.rows && analysis.rows.length > 0 && (
          <div className="rounded-3xl bg-card border border-border/70 p-5 shadow-xs backdrop-blur-md space-y-3">
            <h4 className="text-xs font-extrabold text-foreground">{t("pay.table")}</h4>
            <div className="divide-y divide-border/40 text-xs">
              {analysis.rows.map((row, idx) => (
                <div key={idx} className="flex items-center justify-between py-2.5">
                  <span className="font-bold text-muted-foreground">{row.item}</span>
                  <div className="flex items-center gap-3 font-semibold text-foreground">
                    <span>{row.statement}</span>
                    <ArrowRight className="size-3 text-muted-foreground" />
                    <span className="font-extrabold text-primary">{row.deposit}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {manualDrawer}
    </AppShell>
  );
}
