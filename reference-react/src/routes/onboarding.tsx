import { useState, type ReactNode } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateField, dateFieldValid } from "@/components/date-field";
import { LanguageSwitcher } from "@/components/language-switcher";
import { usePayCycle, initialEmployment } from "@/state/paycycle-context";
import { EMPTY_DATE } from "@/lib/paycycle/types";
import { useT } from "@/i18n";
import { VISA_CODES, visaInfo } from "@/i18n/visa";
import type {
  DateValue,
  EmploymentProfile,
  EmploymentStatus,
  LanguageCode,
} from "@/lib/paycycle/types";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "금융권리 프로필 만들기 · PayCycle AI" },
      {
        name: "description",
        content:
          "근로 상태, 입국일, 근무 시작일, 급여일, 예상 출국일을 한 화면에 하나씩 입력해 금융권리 프로필을 만듭니다.",
      },
      { property: "og:title", content: "금융권리 프로필 만들기 · PayCycle AI" },
      {
        property: "og:description",
        content: "근로 상태에 맞춰 필요한 정보만 입력하고 나만의 금융권리 프로필을 만드세요.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Onboarding,
});

const NATIONALITIES = ["베트남", "캄보디아", "태국", "인도네시아", "네팔", "필리핀"];

const DEFAULT_LANG: Record<string, LanguageCode> = {
  베트남: "vi",
  캄보디아: "km",
  태국: "th",
  인도네시아: "id",
  네팔: "ne",
  필리핀: "tl",
};

interface Draft {
  nickname: string;
  nationality: string;
  visa: string;
  language: LanguageCode | "";
  status: EmploymentStatus | "";
  entryDate: DateValue;
  workStartDate: DateValue;
  currentWorkplaceStartDate: DateValue;
  exitDate: DateValue;
  payDay: number | null;
  payDayUnknown: boolean;
  workplace: string;
  previousWorkplace: string;
}

function Onboarding() {
  const navigate = useNavigate();
  const { saveProfile, state } = usePayCycle();
  const { locale, t } = useT();
  const e = state.employment ?? initialEmployment;
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [visaOpen, setVisaOpen] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({
    nickname: state.profile?.nickname ?? "",
    nationality: state.profile?.nationality ?? "",
    visa: state.profile?.visa ?? "",
    language: state.profile?.language ?? "",
    status: state.employment?.status ?? "",
    entryDate: e.entryDate,
    workStartDate: e.workStartDate,
    currentWorkplaceStartDate: e.currentWorkplaceStartDate,
    exitDate: e.exitDate,
    payDay: e.payDay,
    payDayUnknown: false,
    workplace: e.workplace,
    previousWorkplace: e.previousWorkplace,
  });

  const set = (patch: Partial<Draft>) => setDraft((prev) => ({ ...prev, ...patch }));

  const working = draft.status === "EMPLOYED" || draft.status === "CHANGING";
  const worked = draft.status !== "PRE_EMPLOYMENT" && draft.status !== "";

  const entryRule = { noFuture: true };
  const workStartRule = {
    noFuture: true,
    notBefore: draft.entryDate.value ? { iso: draft.entryDate.value, label: "입국일" } : undefined,
  };
  const currentStartRule = {
    noFuture: true,
    notBefore: draft.workStartDate.value
      ? { iso: draft.workStartDate.value, label: "최초 근무일" }
      : undefined,
  };
  const exitRule = { noPast: true };

  const STATUS_OPTIONS: { value: EmploymentStatus; label: string; desc: string }[] = [
    { value: "PRE_EMPLOYMENT", label: t("ob.status.pre"), desc: t("ob.status.pre.d") },
    { value: "EMPLOYED", label: t("ob.status.employed"), desc: t("ob.status.employed.d") },
    { value: "SEPARATED", label: t("ob.status.separated"), desc: t("ob.status.separated.d") },
    { value: "CHANGING", label: t("ob.status.changing"), desc: t("ob.status.changing.d") },
  ];

  type Step = { key: string; question: string; hint: string; valid: boolean; body: ReactNode };

  /** 선택형 답변은 고르는 즉시 다음 단계로 넘어간다. */
  const advance = () => window.setTimeout(() => setStep((s) => s + 1), 180);

  const allSteps: (Step & { show: boolean })[] = [
    {
      key: "nickname",
      show: true,
      question: t("ob.q.nickname"),
      hint: t("ob.h.nickname"),
      valid: draft.nickname.trim().length > 0,
      body: (
        <Input
          value={draft.nickname}
          onChange={(ev) => set({ nickname: ev.target.value })}
          placeholder="예: 흐엉"
          aria-label={t("ob.q.nickname")}
          className="h-14 text-lg"
        />
      ),
    },
    {
      key: "status",
      show: true,
      question: t("ob.q.status"),
      hint: t("ob.h.status"),
      valid: draft.status !== "",
      body: (
        <div className="space-y-3">
          {STATUS_OPTIONS.map((option) => {
            const active = draft.status === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  set({ status: option.value });
                  advance();
                }}
                className={`w-full rounded-2xl border px-4 py-4 text-left transition-all active:scale-[0.99] ${
                  active
                    ? "border-primary bg-primary text-primary-foreground shadow-md"
                    : "border-border bg-card text-foreground"
                }`}
              >
                <p className="text-base font-bold">{option.label}</p>
                <p className={`mt-1 text-xs ${active ? "opacity-85" : "text-muted-foreground"}`}>
                  {option.desc}
                </p>
              </button>
            );
          })}
        </div>
      ),
    },
    {
      key: "nationality",
      show: true,
      question: t("ob.q.nationality"),
      hint: t("ob.h.nationality"),
      valid: draft.nationality !== "",
      body: (
        <ChoiceGrid
          options={NATIONALITIES}
          value={draft.nationality}
          onSelect={(v) => {
            set({ nationality: v, language: DEFAULT_LANG[v] ?? "en" });
            advance();
          }}
        />
      ),
    },
    {
      key: "visa",
      show: true,
      question: t("ob.q.visa"),
      hint: t("ob.h.visa"),
      valid: draft.visa !== "",
      body: (
        <div className="grid grid-cols-2 gap-3">
          {VISA_CODES.map((code) => {
            const active = draft.visa === code;
            return (
              <div key={code} className="space-y-1.5">
                <div
                  className={`flex items-center justify-between rounded-2xl border px-4 py-4 transition-all ${
                    active
                      ? "border-primary bg-primary text-primary-foreground shadow-md"
                      : "border-border bg-card text-foreground"
                  }`}
                >
                  <button
                    type="button"
                    className="flex-1 text-left text-base font-semibold"
                    onClick={() => {
                      set({ visa: code });
                      advance();
                    }}
                  >
                    {code}
                  </button>
                  <button
                    type="button"
                    aria-label={`${code} 설명`}
                    onClick={() => setVisaOpen(visaOpen === code ? null : code)}
                    className="ml-2 opacity-70"
                  >
                    <Info className="size-4" />
                  </button>
                </div>
                {visaOpen === code ? (
                  <p className="rounded-xl bg-secondary px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                    {visaInfo(locale, code)}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      ),
    },
    {
      key: "entryDate",
      show: true,
      question: t("ob.q.entry"),
      hint: t("ob.h.entry"),
      valid: dateFieldValid(draft.entryDate, entryRule),
      body: (
        <DateField
          label="입국일"
          value={draft.entryDate}
          rule={entryRule}
          allowUnknown={false}
          onChange={(v) => set({ entryDate: v })}
        />
      ),
    },
    {
      key: "workStartDate",
      show: worked,
      question: t("ob.q.workStart"),
      hint: t("ob.h.workStart"),
      valid: dateFieldValid(draft.workStartDate, workStartRule),
      body: (
        <DateField
          label="최초 근무일"
          value={draft.workStartDate}
          rule={workStartRule}
          onChange={(v) => set({ workStartDate: v })}
        />
      ),
    },
    {
      key: "workplace",
      show: worked,
      question: working ? t("ob.q.workplaceNow") : t("ob.q.workplacePast"),
      hint: t("ob.h.workplace"),
      valid: draft.workplace.trim().length > 0,
      body: (
        <div className="space-y-3">
          <Input
            value={draft.workplace}
            onChange={(ev) => set({ workplace: ev.target.value })}
            placeholder="예: 한빛정밀 (제조업)"
            aria-label="사업장"
            className="h-14 text-lg"
          />
          {draft.status === "CHANGING" || draft.status === "SEPARATED" ? (
            <Input
              value={draft.previousWorkplace}
              onChange={(ev) => set({ previousWorkplace: ev.target.value })}
              placeholder="이전 사업장 (선택)"
              aria-label="이전 사업장"
              className="h-14 text-base"
            />
          ) : null}
        </div>
      ),
    },
    {
      key: "currentWorkplaceStartDate",
      show: working,
      question: t("ob.q.currentStart"),
      hint: t("ob.h.currentStart"),
      valid: dateFieldValid(draft.currentWorkplaceStartDate, currentStartRule),
      body: (
        <DateField
          label="현 사업장 입사일"
          value={draft.currentWorkplaceStartDate}
          rule={currentStartRule}
          onChange={(v) => set({ currentWorkplaceStartDate: v })}
        />
      ),
    },
    {
      key: "payDay",
      show: worked,
      question: t("ob.q.payDay"),
      hint: t("ob.h.payDay"),
      valid: draft.payDayUnknown || draft.payDay !== null,
      body: (
        <div className="space-y-3">
          <ChoiceGrid
            options={["5", "10", "15", "20", "25", "말일"]}
            value={
              draft.payDayUnknown
                ? ""
                : draft.payDay === null
                  ? ""
                  : draft.payDay === 31
                    ? "말일"
                    : String(draft.payDay)
            }
            onSelect={(v) => {
              set({ payDay: v === "말일" ? 31 : Number(v), payDayUnknown: false });
              advance();
            }}
            suffix="일"
          />
          <button
            type="button"
            onClick={() => set({ payDayUnknown: !draft.payDayUnknown, payDay: null })}
            className={`rounded-full border px-3.5 py-2 text-xs font-semibold ${
              draft.payDayUnknown
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground"
            }`}
          >
            {t("ob.payDayUnknown")}
          </button>
        </div>
      ),
    },
    {
      key: "exitDate",
      show: true,
      question: t("ob.q.exit"),
      hint: t("ob.h.exit"),
      valid: dateFieldValid(draft.exitDate, exitRule),
      body: (
        <DateField
          label="예상 출국일"
          value={draft.exitDate}
          rule={exitRule}
          onChange={(v) => set({ exitDate: v })}
        />
      ),
    },
  ];

  const steps = allSteps.filter((s) => s.show);
  const safeStep = Math.min(step, steps.length - 1);
  const current = steps[safeStep]!;
  const progress = ((safeStep + 1) / steps.length) * 100;

  const finish = () => {
    const employment: EmploymentProfile = {
      status: (draft.status || "EMPLOYED") as EmploymentStatus,
      entryDate: draft.entryDate,
      workStartDate: worked ? draft.workStartDate : EMPTY_DATE,
      currentWorkplaceStartDate: working ? draft.currentWorkplaceStartDate : EMPTY_DATE,
      exitDate: draft.exitDate,
      payDay: draft.payDayUnknown ? null : draft.payDay,
      workplace: draft.workplace.trim(),
      previousWorkplace: draft.previousWorkplace.trim(),
    };
    saveProfile(
      {
        nickname: draft.nickname.trim(),
        nationality: draft.nationality,
        visa: draft.visa,
        language: (draft.language || "en") as LanguageCode,
      },
      employment,
    );
    setDone(true);
  };

  const next = () => {
    if (!current.valid) return;
    if (safeStep < steps.length - 1) setStep(safeStep + 1);
    else finish();
  };

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="pc-rise w-full max-w-sm text-center">
          <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-signal-soft">
            <Check className="size-9 text-signal-foreground" />
          </div>
          <h1 className="mt-6 text-2xl font-bold whitespace-pre-line text-foreground">
            {t("ob.done.title")}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {draft.nationality} · {draft.visa} ·{" "}
            {STATUS_OPTIONS.find((s) => s.value === draft.status)?.label}
            <br />
            {t("ob.done.sub")}
          </p>
          <Button
            className="mt-8 h-13 w-full rounded-2xl text-base font-bold"
            onClick={() => navigate({ to: "/dashboard" })}
          >
            {t("ob.done.cta")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background px-6 py-8">
      <div className="mx-auto w-full max-w-xl">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label={t("common.prev")}
            onClick={() => (safeStep === 0 ? navigate({ to: "/" }) : setStep(safeStep - 1))}
            className="flex size-9 items-center justify-center rounded-full bg-card text-muted-foreground shadow-sm"
          >
            <ArrowLeft className="size-4" />
          </button>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-muted-foreground">
            {safeStep + 1}/{steps.length}
          </span>
          <LanguageSwitcher />
        </div>

        <div key={current.key} className="pc-rise mt-12">
          <h1 className="text-2xl leading-snug font-bold text-foreground">{current.question}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{current.hint}</p>
          <div className="mt-8">{current.body}</div>
        </div>
      </div>

      <div className="mx-auto mt-auto w-full max-w-xl pt-10">
        <Button
          disabled={!current.valid}
          onClick={next}
          className="h-14 w-full rounded-2xl text-base font-bold"
        >
          {safeStep === steps.length - 1 ? t("ob.finish") : t("common.next")}
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function ChoiceGrid({
  options,
  value,
  onSelect,
  suffix = "",
}: {
  options: string[];
  value: string;
  onSelect: (value: string) => void;
  suffix?: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {options.map((option) => {
        const active = value === option;
        return (
          <button
            key={option}
            type="button"
            onClick={() => onSelect(option)}
            className={`rounded-2xl border px-4 py-4 text-base font-semibold transition-all active:scale-[0.98] ${
              active
                ? "border-primary bg-primary text-primary-foreground shadow-md"
                : "border-border bg-card text-foreground"
            }`}
          >
            {option}
            {option === "말일" ? "" : suffix}
          </button>
        );
      })}
    </div>
  );
}
