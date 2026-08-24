import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Check, Plane, Receipt, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import { usePayCycle } from "@/state/paycycle-context";
import { LOCALES, useT, type UiLocale } from "@/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PayCycle AI · 외국인 근로자 금융권리 관리" },
      {
        name: "description",
        content:
          "매월 급여 확인, 연말정산 점검, 출국 전 정산까지. 외국인 근로자의 금융권리를 한곳에서 관리하는 AI 서비스입니다.",
      },
      { property: "og:title", content: "PayCycle AI · 외국인 근로자 금융권리 관리" },
      {
        property: "og:description",
        content: "급여 확인부터 연말정산, 출국 전 정산까지 한곳에서 관리하세요.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Landing,
});

const FEATURE_ICONS = [Wallet, Receipt, Plane];

function Landing() {
  const { state, hydrated, loadSample } = usePayCycle();
  const { locale, setLocale, t } = useT();
  const navigate = useNavigate();
  const hasProfile = hydrated && state.profile;

  /** 첫 화면은 언어 선택 하나만 보여 준다. 선택 후 서비스 소개로 넘어간다. */
  const [picked, setPicked] = useState(false);

  if (!picked) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-10">
          <div className="pc-rise inline-flex w-fit items-center gap-2 rounded-full bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground shadow-sm">
            <ShieldCheck className="size-4 text-signal" />
            PayCycle AI
          </div>
          <h1 className="pc-rise mt-6 text-2xl font-bold text-foreground">
            언어를 선택해 주세요
            <span className="mt-1 block text-base font-semibold text-muted-foreground">
              Select your language
            </span>
          </h1>

          <ul className="mt-8 space-y-3">
            {LOCALES.map((l) => (
              <li key={l.code}>
                <button
                  type="button"
                  onClick={() => setLocale(l.code as UiLocale)}
                  className={`flex w-full items-center justify-between rounded-2xl border px-5 py-4 text-left text-base font-semibold transition-colors ${
                    locale === l.code
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-foreground"
                  }`}
                >
                  {l.label}
                  {locale === l.code ? <Check className="size-5" /> : null}
                </button>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={() => setPicked(true)}
            className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-4 text-base font-bold text-primary-foreground shadow-lg shadow-primary/20"
          >
            {t("common.next")}
            <ArrowRight className="size-4" />
          </button>
        </div>
      </div>
    );
  }

  const features = [
    { when: t("landing.f1.when"), text: t("landing.f1.text") },
    { when: t("landing.f2.when"), text: t("landing.f2.text") },
    { when: t("landing.f3.when"), text: t("landing.f3.text") },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-between px-6 py-10">
        <div>
          <div className="pc-rise inline-flex items-center gap-2 rounded-full bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground shadow-sm">
            <ShieldCheck className="size-4 text-signal" />
            PayCycle AI · {t("landing.badge")}
          </div>

          <h1 className="pc-rise mt-8 text-[28px] leading-[1.35] font-bold tracking-tight whitespace-pre-line text-foreground">
            {t("landing.title")}
          </h1>

          <p className="pc-rise mt-4 text-[15px] leading-relaxed text-muted-foreground">
            {t("landing.sub")}
          </p>

          <div className="mt-9 space-y-3">
            {features.map((f, i) => {
              const Icon = FEATURE_ICONS[i]!;
              return (
                <div
                  key={f.when}
                  className="pc-rise flex items-center gap-4 rounded-2xl bg-card p-4 shadow-sm"
                  style={{ animationDelay: `${120 + i * 90}ms` }}
                >
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-secondary">
                    <Icon className="size-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground">{f.when}</p>
                    <p className="mt-0.5 text-[15px] font-semibold text-foreground">{f.text}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-10 space-y-3">
          <Link
            to={hasProfile ? "/dashboard" : "/onboarding"}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-4 text-base font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-transform active:scale-[0.98]"
          >
            {hasProfile ? t("landing.ctaBack") : t("landing.cta")}
            <ArrowRight className="size-4" />
          </Link>
          <button
            type="button"
            onClick={() => {
              loadSample();
              void navigate({ to: "/dashboard" });
            }}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-card px-5 py-4 text-base font-semibold text-foreground"
          >
            <Sparkles className="size-4 text-info" /> {t("landing.sample")}
          </button>
        </div>
      </div>
    </div>
  );
}
