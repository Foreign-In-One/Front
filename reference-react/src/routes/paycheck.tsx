import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Check,
  Copy,
  FileText,
  Landmark,
  Loader2,
  MessageSquareQuote,
  Receipt,
  Sparkles,
  Upload,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { StatusPill } from "@/components/status-pill";
import { LevelCard, WizardStart, WizardStep, type Level } from "@/components/wizard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { usePayCycle } from "@/state/paycycle-context";
import { analyzePaycheck, STATUS_LABEL, STATUS_TONE } from "@/lib/paycycle/rule-engine";
import { emptyFields } from "@/lib/paycycle/types";
import type {
  DocFields,
  DocKind,
  PayCheckStatus,
  PayDocument,
  PayDocuments,
  PayFinding,
} from "@/lib/paycycle/types";
import { formatKDate, monthLabel, periodOf, uid, won, wonOrDash } from "@/lib/paycycle/format";
import { readDocument } from "@/services/ocr";
import { translateForEmployer } from "@/services/ai";
import { buildKoreanQuestion } from "@/lib/paycycle/question-card";
import { LOCALES, useT, type DictKey } from "@/i18n";

export const Route = createFileRoute("/paycheck")({
  head: () => ({
    meta: [
      { title: "PayCheck · 이번 달 급여 3중 대조" },
      {
        name: "description",
        content:
          "근로계약서, 임금명세서, 입금내역을 한 화면에 하나씩 올려 AI가 읽은 값을 확인하고 세 자료를 대조해 설명이 필요한 차이를 찾습니다.",
      },
      { property: "og:title", content: "PayCheck · 이번 달 급여 3중 대조" },
      {
        property: "og:description",
        content: "계약서·명세서·입금내역을 대조해 급여 차이를 확인하세요.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PayCheck,
});

const DOC_ORDER: DocKind[] = ["contract", "statement", "deposit"];

const DOC_META: Record<
  DocKind,
  { label: DictKey; hint: DictKey; step: DictKey; icon: typeof FileText }
> = {
  contract: {
    label: "pay.doc.contract",
    hint: "pay.doc.contract.h",
    step: "pay.step1",
    icon: FileText,
  },
  statement: {
    label: "pay.doc.statement",
    hint: "pay.doc.statement.h",
    step: "pay.step2",
    icon: Receipt,
  },
  deposit: {
    label: "pay.doc.deposit",
    hint: "pay.doc.deposit.h",
    step: "pay.step3",
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

const FIELDS_BY_KIND: Record<DocKind, (keyof Omit<DocFields, "period">)[]> = {
  contract: ["basePay", "allowances", "payDay"],
  statement: ["basePay", "allowances", "deductions", "netPay", "payDate"],
  deposit: ["netPay", "payDate"],
};

const STATUS_LEVEL: Record<PayCheckStatus, Level> = {
  MATCH: "ok",
  EXPLANATION_REQUIRED: "critical",
  INSUFFICIENT_DATA: "warn",
  USER_CONFIRMATION: "info",
};

const STEP_TOTAL = 6;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("파일을 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });
}

function PayCheck() {
  const { state, upsertPayRecord, saveResult } = usePayCycle();
  const { locale, t } = useT();

  const [step, setStep] = useState(-1);
  const [period, setPeriod] = useState(periodOf(new Date()));
  const existing = state.payRecords.find((r) => r.period === period);

  const [documents, setDocuments] = useState<PayDocuments>(existing?.documents ?? {});
  const [busy, setBusy] = useState<DocKind | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(existing?.analysis ?? null);
  const [openFinding, setOpenFinding] = useState<PayFinding | null>(null);
  const [cardFinding, setCardFinding] = useState<PayFinding | null>(null);
  const [translated, setTranslated] = useState<string | null>(null);
  const [translating, setTranslating] = useState(false);
  const [loadedKey, setLoadedKey] = useState<string | null>(existing ? existing.id : null);

  /** 저장소 하이드레이션 이후 해당 월 기록을 화면에 불러온다. */
  useEffect(() => {
    if (existing && existing.id !== loadedKey) {
      setDocuments(existing.documents);
      setAnalysis(existing.analysis);
      setLoadedKey(existing.id);
    }
  }, [existing, loadedKey]);

  const filledCount = useMemo(() => Object.keys(documents).length, [documents]);
  const languageLabel = LOCALES.find((l) => l.code === locale)?.label ?? "한국어";

  const setDoc = (kind: DocKind, doc: PayDocument | undefined) =>
    setDocuments((prev) => {
      const next = { ...prev };
      if (doc) next[kind] = doc;
      else delete next[kind];
      return next;
    });

  const handleFile = async (kind: DocKind, file: File) => {
    setBusy(kind);
    setAnalysis(null);
    try {
      const dataUrl = await readAsDataUrl(file);
      const result = await readDocument({ kind, dataUrl, period, useMock: state.sampleMode });
      setDoc(kind, {
        kind,
        source: result.ok ? (result.mock ? "sample" : "upload") : "manual",
        fileName: file.name,
        fields: result.fields,
        confirmed: false,
        masked: true,
        note: result.message,
      });
      if (result.ok) toast.success(`${t(DOC_META[kind].label)} · ${t("pay.step4")}`);
      else toast.error(result.message);
    } catch {
      toast.error("파일을 읽지 못했습니다. 다시 시도해 주세요.");
    } finally {
      setBusy(null);
    }
  };

  const startManual = (kind: DocKind) => {
    setDoc(kind, {
      kind,
      source: "manual",
      fileName: t("common.manualInput"),
      fields: emptyFields(period),
      confirmed: false,
      masked: true,
      note: "값을 직접 입력하고 있습니다.",
    });
  };

  const runAnalysis = () => {
    setAnalyzing(true);
    setAnalysis(null);
    window.setTimeout(() => {
      const result = analyzePaycheck(documents, state.employment, period);
      setAnalysis(result);
      setAnalyzing(false);
      upsertPayRecord({
        id: existing?.id ?? uid("pay"),
        period,
        workplace: state.employment?.workplace ?? "",
        checkedAt: new Date().toISOString().slice(0, 10),
        paidAmount: documents.deposit?.fields.netPay ?? null,
        documents,
        analysis: result,
      });
      void saveResult({
        kind: "pay",
        payPeriod: period,
        workplace: state.employment?.workplace ?? "",
        status: result.overallStatus,
        differenceAmount: result.findings[0]?.difference ?? null,
        paidAmount: documents.deposit?.fields.netPay ?? null,
        findingCount: result.findings.length,
        documents,
        employment: state.employment,
      });
      toast.success(t("pay.savedToast"));
      setStep(5);
    }, 700);
  };

  const openQuestionCard = async (finding: PayFinding) => {
    setCardFinding(finding);
    setTranslated(null);
    setTranslating(true);
    const korean = buildKoreanQuestion(finding);
    const result = await translateForEmployer(korean, locale);
    setTranslated(result.text);
    setTranslating(false);
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("common.copied"));
    } catch {
      toast.error(t("common.copyFailed"));
    }
  };

  if (step < 0) {
    return (
      <AppShell title={t("pay.title")} subtitle={t("pay.subtitle")}>
        <WizardStart
          icon={<Wallet className="size-7" />}
          title={t("pay.startTitle")}
          description={t("pay.startDesc")}
          cta={t("pay.startCta")}
          onStart={() => setStep(0)}
        >
          <div className="rounded-2xl bg-card p-4 shadow-sm">
            <label className="text-xs font-semibold text-muted-foreground" htmlFor="period">
              {t("pay.month")}
            </label>
            <div className="mt-2 flex items-center gap-3">
              <Input
                id="period"
                type="month"
                value={period}
                onChange={(e) => {
                  const next = e.target.value || periodOf(new Date());
                  setPeriod(next);
                  const rec = state.payRecords.find((r) => r.period === next);
                  setDocuments(rec?.documents ?? {});
                  setAnalysis(rec?.analysis ?? null);
                  setLoadedKey(rec?.id ?? null);
                }}
                className="h-12 flex-1"
              />
              <span className="text-sm font-semibold text-foreground">{monthLabel(period)}</span>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              {t("pay.privacy")}
            </p>
          </div>
        </WizardStart>
      </AppShell>
    );
  }

  const docStep = step <= 2 ? DOC_ORDER[step]! : null;
  const titles: string[] = [
    t("pay.step1"),
    t("pay.step2"),
    t("pay.step3"),
    t("pay.step4"),
    t("pay.step5"),
    t("pay.step6"),
  ];

  return (
    <AppShell title={t("pay.title")} subtitle={monthLabel(period)}>
      <WizardStep
        index={step}
        total={STEP_TOTAL}
        title={titles[step] ?? ""}
        hint={docStep ? t(DOC_META[docStep].hint) : undefined}
        onPrev={() => setStep(step === 0 ? -1 : step - 1)}
        onNext={step >= 4 ? undefined : () => setStep(step + 1)}
        nextLabel={docStep && !documents[docStep] ? t("common.skip") : t("common.next")}
      >
        {docStep ? (
          <DocCard
            kind={docStep}
            doc={documents[docStep]}
            busy={busy === docStep}
            onFile={(file) => void handleFile(docStep, file)}
            onManual={() => startManual(docStep)}
            onChange={(fields) => {
              const current = documents[docStep];
              if (!current) return;
              setDoc(docStep, { ...current, fields, confirmed: false });
              setAnalysis(null);
            }}
            onConfirm={() => {
              const current = documents[docStep];
              if (!current) return;
              setDoc(docStep, { ...current, confirmed: true });
              toast.success(`${t(DOC_META[docStep].label)} · ${t("pay.confirmed")}`);
            }}
            onRemove={() => {
              setDoc(docStep, undefined);
              setAnalysis(null);
            }}
          />
        ) : null}

        {step === 3 ? (
          <div className="space-y-3">
            {DOC_ORDER.map((kind) => {
              const doc = documents[kind];
              return (
                <LevelCard key={kind} level={doc ? (doc.confirmed ? "ok" : "warn") : "info"}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-foreground">{t(DOC_META[kind].label)}</p>
                    {doc ? (
                      <StatusPill tone={doc.confirmed ? "ok" : "warn"}>
                        {doc.confirmed ? t("pay.confirmed") : t("pay.confirmValue")}
                      </StatusPill>
                    ) : (
                      <StatusPill tone="neutral">{t("pay.noDoc")}</StatusPill>
                    )}
                  </div>
                  {doc ? (
                    <>
                      <ul className="mt-2 space-y-1">
                        {FIELDS_BY_KIND[kind].map((f) => (
                          <li key={f} className="flex justify-between text-xs">
                            <span className="text-muted-foreground">{FIELD_LABEL[f]}</span>
                            <span className="font-semibold text-foreground">
                              {f === "payDate"
                                ? (formatKDate(doc.fields.payDate) || t("common.unknownValue"))
                                : doc.fields[f] === null
                                  ? t("common.unknownValue")
                                  : f === "payDay"
                                    ? `${doc.fields.payDay}일`
                                    : won(doc.fields[f] as number)}
                            </span>
                          </li>
                        ))}
                      </ul>
                      {!doc.confirmed ? (
                        <Button
                          size="sm"
                          className="mt-3 w-full"
                          onClick={() => setDoc(kind, { ...doc, confirmed: true })}
                        >
                          <Check className="size-4" /> {t("pay.confirmValue")}
                        </Button>
                      ) : null}
                    </>
                  ) : null}
                </LevelCard>
              );
            })}
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-4">
            <LevelCard level={filledCount >= 2 ? "info" : "warn"}>
              <p className="text-sm leading-relaxed text-foreground">
                {filledCount >= 2
                  ? `${filledCount}개 자료로 대조합니다. 없는 값은 추정하지 않고 "확인 불가"로 표시합니다.`
                  : t("pay.insufficient")}
              </p>
            </LevelCard>
            <Button
              onClick={runAnalysis}
              disabled={analyzing || filledCount === 0}
              className="h-14 w-full rounded-2xl text-base font-bold"
            >
              {analyzing ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> {t("pay.analyzing")}
                </>
              ) : (
                <>
                  <Sparkles className="size-4" /> {t("pay.analyzeCta")}
                </>
              )}
            </Button>
          </div>
        ) : null}

        {step === 5 && analysis ? (
          <div className="space-y-4">
            <LevelCard level={STATUS_LEVEL[analysis.overallStatus]}>
              <StatusPill tone={STATUS_TONE[analysis.overallStatus]}>
                {STATUS_LABEL[analysis.overallStatus]}
              </StatusPill>
              <h3 className="mt-3 text-lg leading-snug font-bold text-foreground">
                {analysis.headline}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {analysis.detail}
              </p>
              <ul className="mt-4 space-y-1.5 border-t border-border/60 pt-3">
                {analysis.steps.map((s) => (
                  <li key={s.label} className="flex gap-2 text-xs text-muted-foreground">
                    <span className={s.ok ? "text-signal-foreground" : "text-muted-foreground"}>
                      {s.ok ? "✓" : "—"}
                    </span>
                    <span className="font-semibold text-foreground">{s.label}</span>
                    <span>{s.detail}</span>
                  </li>
                ))}
              </ul>
            </LevelCard>

            <div className="overflow-hidden rounded-2xl bg-card shadow-sm">
              <div className="border-b border-border px-4 py-3">
                <h3 className="text-sm font-bold text-foreground">{t("pay.table")}</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[34rem] text-left text-xs">
                  <thead className="bg-secondary/60 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-semibold">{t("pay.col.item")}</th>
                      <th className="px-3 py-2 font-semibold">{t("pay.col.contract")}</th>
                      <th className="px-3 py-2 font-semibold">{t("pay.col.statement")}</th>
                      <th className="px-3 py-2 font-semibold">{t("pay.col.deposit")}</th>
                      <th className="px-3 py-2 font-semibold">{t("pay.col.result")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.rows.map((row) => (
                      <tr key={row.item} className="border-t border-border/70">
                        <td className="px-3 py-2.5 font-semibold text-foreground">{row.item}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{row.contract}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{row.statement}</td>
                        <td className="px-3 py-2.5 text-muted-foreground">{row.deposit}</td>
                        <td className="px-3 py-2.5">
                          <StatusPill tone={STATUS_TONE[row.status]}>{row.result}</StatusPill>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {analysis.findings.map((finding) => (
              <LevelCard key={finding.id} level={STATUS_LEVEL[finding.status]}>
                <StatusPill tone={STATUS_TONE[finding.status]}>
                  {STATUS_LABEL[finding.status]}
                </StatusPill>
                <h3 className="mt-2.5 text-base font-bold text-foreground">{finding.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {finding.fact}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setOpenFinding(finding)}>
                    {t("pay.why")}
                  </Button>
                  <Button size="sm" onClick={() => void openQuestionCard(finding)}>
                    <MessageSquareQuote className="size-4" /> {t("pay.questionCard")}
                  </Button>
                </div>
              </LevelCard>
            ))}

            <Button
              variant="secondary"
              className="w-full"
              onClick={() => {
                setStep(-1);
              }}
            >
              {t("common.again")}
            </Button>
          </div>
        ) : null}

        {step === 5 && !analysis ? (
          <LevelCard level="warn">
            <p className="text-sm text-foreground">{t("pay.insufficient")}</p>
          </LevelCard>
        ) : null}
      </WizardStep>

      <Drawer open={openFinding !== null} onOpenChange={(open) => !open && setOpenFinding(null)}>
        <DrawerContent className="mx-auto max-w-xl">
          <DrawerHeader className="text-left">
            <DrawerTitle>{openFinding?.title}</DrawerTitle>
            <DrawerDescription>{t("pay.why")}</DrawerDescription>
          </DrawerHeader>
          {openFinding ? (
            <div className="max-h-[62vh] space-y-4 overflow-y-auto px-4 pb-8 text-sm">
              <Block title={t("pay.why.fact")}>{openFinding.fact}</Block>
              <div className="rounded-xl bg-secondary/60 p-3 text-xs">
                <p className="font-semibold text-foreground">
                  {openFinding.left.label} {wonOrDash(openFinding.left.amount)}
                </p>
                <p className="mt-1 font-semibold text-foreground">
                  {openFinding.right.label} {wonOrDash(openFinding.right.amount)}
                </p>
                <p className="mt-1 text-muted-foreground">
                  {t("pay.result.diff")} {won(Math.abs(openFinding.difference))}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold text-muted-foreground">{t("pay.why.possible")}</p>
                <ul className="mt-1.5 space-y-1 text-sm text-foreground">
                  <li>· {t("pay.possible1")}</li>
                  <li>· {t("pay.possible2")}</li>
                  <li>· {t("pay.possible3")}</li>
                  <li>· {t("pay.possible4")}</li>
                </ul>
              </div>
              <Block title={t("pay.why.standard")}>{openFinding.standard}</Block>
              <Block title={t("pay.why.limit")}>{openFinding.limitation}</Block>
              <div>
                <p className="text-xs font-bold text-muted-foreground">{t("pay.why.next")}</p>
                <ul className="mt-1.5 space-y-1">
                  {openFinding.nextActions.map((a) => (
                    <li key={a} className="text-sm text-foreground">
                      · {a}
                    </li>
                  ))}
                </ul>
              </div>
              {openFinding.requiredEvidence.length ? (
                <div>
                  <p className="text-xs font-bold text-muted-foreground">{t("pay.why.docs")}</p>
                  <p className="mt-1 text-sm text-foreground">
                    {openFinding.requiredEvidence.join(", ")}
                  </p>
                </div>
              ) : null}
              <div>
                <p className="text-xs font-bold text-muted-foreground">{t("common.viewLaw")}</p>
                <ul className="mt-1.5 space-y-1">
                  {openFinding.evidence.map((e) => (
                    <li key={e.url}>
                      <a
                        href={e.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-semibold text-primary underline underline-offset-4"
                      >
                        {e.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => void copy(buildWhyText(openFinding))}
              >
                <Copy className="size-4" /> {t("common.copy")}
              </Button>
            </div>
          ) : null}
        </DrawerContent>
      </Drawer>

      <Drawer open={cardFinding !== null} onOpenChange={(open) => !open && setCardFinding(null)}>
        <DrawerContent className="mx-auto max-w-xl">
          <DrawerHeader className="text-left">
            <DrawerTitle>{t("pay.questionCard")}</DrawerTitle>
            <DrawerDescription>{t("pay.questionCardDesc")}</DrawerDescription>
          </DrawerHeader>
          {cardFinding ? (
            <div className="space-y-3 px-4 pb-8">
              <CardBlock label="한국어" text={buildKoreanQuestion(cardFinding)} onCopy={copy} />
              {locale === "ko" ? null : (
                <CardBlock
                  label={languageLabel}
                  text={translating ? "…" : (translated ?? "")}
                  onCopy={copy}
                  disabled={translating}
                />
              )}
            </div>
          ) : null}
        </DrawerContent>
      </Drawer>
    </AppShell>
  );
}

function buildWhyText(f: PayFinding): string {
  return [
    f.title,
    `확인된 사실: ${f.fact}`,
    `공식 기준: ${f.standard}`,
    `판단 범위: ${f.limitation}`,
    `다음 행동: ${f.nextActions.join(" / ")}`,
  ].join("\n");
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-bold text-muted-foreground">{title}</p>
      <p className="mt-1 leading-relaxed text-foreground">{children}</p>
    </div>
  );
}

function CardBlock({
  label,
  text,
  onCopy,
  disabled,
}: {
  label: string;
  text: string;
  onCopy: (text: string) => void;
  disabled?: boolean;
}) {
  const { t } = useT();
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-muted-foreground">{label}</p>
        <Button size="sm" variant="ghost" disabled={disabled || !text} onClick={() => onCopy(text)}>
          <Copy className="size-3.5" /> {t("common.copy")}
        </Button>
      </div>
      <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap text-foreground">{text}</p>
    </div>
  );
}

function DocCard({
  kind,
  doc,
  busy,
  onFile,
  onManual,
  onChange,
  onConfirm,
  onRemove,
}: {
  kind: DocKind;
  doc: PayDocument | undefined;
  busy: boolean;
  onFile: (file: File) => void;
  onManual: () => void;
  onChange: (fields: DocFields) => void;
  onConfirm: () => void;
  onRemove: () => void;
}) {
  const { t } = useT();
  const meta = DOC_META[kind];
  const Icon = meta.icon;
  const inputId = `file-${kind}`;

  return (
    <article className="rounded-2xl bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary">
          <Icon className="size-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-[15px] font-bold text-foreground">{t(meta.label)}</p>
            {doc?.confirmed ? <StatusPill tone="ok">{t("pay.confirmed")}</StatusPill> : null}
            {doc?.source === "sample" ? (
              <StatusPill tone="info">{t("common.mockBadge")}</StatusPill>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {doc ? doc.fileName : t(meta.hint)}
          </p>
        </div>
        {doc ? (
          <button
            type="button"
            onClick={onRemove}
            className="text-xs font-semibold text-muted-foreground underline"
          >
            {t("pay.remove")}
          </button>
        ) : null}
      </div>

      {!doc ? (
        <div className="mt-3 flex gap-2">
          <label
            htmlFor={inputId}
            className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border py-3 text-sm font-semibold text-foreground"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {busy ? t("common.reading") : t("common.upload")}
          </label>
          <input
            id={inputId}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFile(file);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={onManual}
            className="rounded-xl border border-border px-4 text-sm font-semibold text-muted-foreground"
          >
            {t("common.manualInput")}
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <p className="rounded-xl bg-secondary/60 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
            {doc.note}
          </p>
          <div className="grid gap-2.5">
            {FIELDS_BY_KIND[kind].map((field) => (
              <div key={field} className="flex items-center gap-3">
                <label
                  htmlFor={`${kind}-${field}`}
                  className="w-32 shrink-0 text-xs font-semibold text-muted-foreground"
                >
                  {FIELD_LABEL[field]}
                </label>
                {field === "payDate" ? (
                  <Input
                    id={`${kind}-${field}`}
                    type="date"
                    value={doc.fields.payDate ?? ""}
                    onChange={(e) => onChange({ ...doc.fields, payDate: e.target.value || null })}
                    className="h-11 flex-1"
                  />
                ) : (
                  <Input
                    id={`${kind}-${field}`}
                    inputMode="numeric"
                    placeholder="숫자만 입력"
                    value={doc.fields[field] === null ? "" : String(doc.fields[field])}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/[^0-9]/g, "");
                      onChange({ ...doc.fields, [field]: digits ? Number(digits) : null });
                    }}
                    className="h-11 flex-1"
                  />
                )}
              </div>
            ))}
          </div>
          {doc.fields.payDate ? (
            <p className="text-[11px] text-muted-foreground">
              {FIELD_LABEL.payDate}: {formatKDate(doc.fields.payDate)}
            </p>
          ) : null}
          <Button
            size="sm"
            variant={doc.confirmed ? "secondary" : "default"}
            onClick={onConfirm}
            className="w-full"
          >
            <Check className="size-4" /> {doc.confirmed ? t("pay.reconfirm") : t("pay.confirmValue")}
          </Button>
        </div>
      )}
    </article>
  );
}
