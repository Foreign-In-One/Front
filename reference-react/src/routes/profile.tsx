import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CalendarClock, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { DateField } from "@/components/date-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePayCycle } from "@/state/paycycle-context";
import { useT } from "@/i18n";
import { LOCALES } from "@/i18n";
import { VISA_CODES } from "@/i18n/visa";
import { dDay } from "@/lib/paycycle/rule-engine";
import type { EmploymentStatus, LanguageCode } from "@/lib/paycycle/types";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "내 프로필 · PayCycle AI" },
      {
        name: "description",
        content:
          "국적·비자·입국일·출국 예정일·급여일 등 내 금융권리 프로필을 확인하고 수정합니다. 수정하면 캘린더와 D-Day가 즉시 갱신됩니다.",
      },
      { property: "og:title", content: "내 프로필 · PayCycle AI" },
      {
        property: "og:description",
        content: "내 체류·근로 정보를 수정하면 일정과 남은 기간이 바로 반영됩니다.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

const STATUSES: EmploymentStatus[] = ["PRE_EMPLOYMENT", "EMPLOYED", "SEPARATED", "CHANGING"];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-3 rounded-2xl bg-card p-4 shadow-sm">
      <h2 className="text-sm font-bold text-foreground">{title}</h2>
      <div className="mt-3 space-y-4">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function ProfilePage() {
  const { state, hydrated, updateProfile, updateEmployment, resetAll } = usePayCycle();
  const { t, locale, setLocale } = useT();
  const navigate = useNavigate();

  const profile = state.profile;
  const employment = state.employment;

  if (!hydrated) {
    return (
      <AppShell title={t("profile.title")}>
        <p className="text-sm text-muted-foreground">…</p>
      </AppShell>
    );
  }

  if (!profile || !employment) {
    return (
      <AppShell title={t("profile.title")}>
        <div className="rounded-2xl bg-card p-6 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">{t("profile.empty")}</p>
          <Link
            to="/onboarding"
            className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-primary px-5 py-4 text-base font-bold text-primary-foreground"
          >
            {t("profile.create")}
          </Link>
        </div>
      </AppShell>
    );
  }

  const exitIso =
    employment.exitDate.value && !employment.exitDate.unknown ? employment.exitDate.value : null;

  return (
    <AppShell title={t("profile.title")} subtitle={t("profile.subtitle")}>
      <section className="rounded-2xl bg-primary p-5 text-primary-foreground shadow-lg shadow-primary/20">
        <div className="flex items-center gap-2 text-xs font-semibold opacity-80">
          <UserRound className="size-4" /> {profile.nationality} · {profile.visa}
        </div>
        <p className="mt-1 text-2xl font-bold">{profile.nickname}</p>
        <p className="mt-1 flex items-center gap-1.5 text-xs opacity-85">
          <CalendarClock className="size-3.5" />
          {exitIso ? t("profile.dday", { n: dDay(exitIso) }) : t("profile.ddayNone")}
        </p>
      </section>

      <Section title={t("profile.basic")}>
        <Field label={t("profile.nickname")}>
          <Input
            value={profile.nickname}
            onChange={(e) => updateProfile({ nickname: e.target.value })}
            className="h-12"
          />
        </Field>
        <Field label={t("profile.nationality")}>
          <Input
            value={profile.nationality}
            onChange={(e) => updateProfile({ nationality: e.target.value })}
            className="h-12"
          />
        </Field>
        <Field label={t("profile.language")}>
          <select
            value={locale}
            onChange={(e) => {
              const next = e.target.value as (typeof LOCALES)[number]["code"];
              setLocale(next);
              updateProfile({ language: next as unknown as LanguageCode });
            }}
            className="h-12 w-full rounded-xl border border-border bg-background px-3 text-sm font-semibold text-foreground"
          >
            {LOCALES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </Field>
      </Section>

      <Section title={t("profile.stay")}>
        <Field label={t("profile.visa")}>
          <select
            value={profile.visa}
            onChange={(e) => updateProfile({ visa: e.target.value })}
            className="h-12 w-full rounded-xl border border-border bg-background px-3 text-sm font-semibold text-foreground"
          >
            {VISA_CODES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("profile.entryDate")}>
          <DateField
            label={t("profile.entryDate")}
            value={employment.entryDate}
            rule={{ noFuture: true }}
            onChange={(entryDate) => updateEmployment({ entryDate })}
          />
        </Field>
        <Field label={t("profile.exitDate")}>
          <DateField
            label={t("profile.exitDate")}
            value={employment.exitDate}
            onChange={(exitDate) => updateEmployment({ exitDate })}
          />
        </Field>
      </Section>

      <Section title={t("profile.work")}>
        <Field label={t("profile.status")}>
          <div className="grid grid-cols-2 gap-2">
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => updateEmployment({ status: s })}
                className={`rounded-xl border py-3 text-xs font-semibold ${
                  employment.status === s
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground"
                }`}
              >
                {t(`status.${s}`)}
              </button>
            ))}
          </div>
        </Field>
        <Field label={t("profile.workplace")}>
          <Input
            value={employment.workplace}
            onChange={(e) => updateEmployment({ workplace: e.target.value })}
            className="h-12"
          />
        </Field>
        {employment.status === "SEPARATED" || employment.status === "CHANGING" ? (
          <Field label={t("profile.prevWorkplace")}>
            <Input
              value={employment.previousWorkplace}
              onChange={(e) => updateEmployment({ previousWorkplace: e.target.value })}
              className="h-12"
            />
          </Field>
        ) : null}
        <Field label={t("profile.workStart")}>
          <DateField
            label={t("profile.workStart")}
            value={employment.workStartDate}
            rule={{ noFuture: true }}
            onChange={(workStartDate) => updateEmployment({ workStartDate })}
          />
        </Field>
        <Field label={t("profile.payDay")}>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              max={31}
              value={employment.payDay ?? ""}
              onChange={(e) => {
                const n = Number(e.target.value);
                updateEmployment({ payDay: Number.isFinite(n) && n >= 1 && n <= 31 ? n : null });
              }}
              className="h-12 w-28"
            />
            <span className="text-sm text-muted-foreground">{t("profile.payDaySuffix")}</span>
          </div>
        </Field>
      </Section>

      <Button
        className="mt-4 w-full"
        onClick={() => {
          toast.success(t("profile.saved"));
          void navigate({ to: "/dashboard" });
        }}
      >
        {t("common.save")}
      </Button>

      <p className="mt-3 text-center text-[11px] leading-relaxed text-muted-foreground">
        {t("profile.privacy")}
      </p>

      <Button
        variant="ghost"
        className="mt-2 w-full text-muted-foreground"
        onClick={() => {
          resetAll();
          toast.success(t("profile.resetDone"));
          void navigate({ to: "/" });
        }}
      >
        <Trash2 className="size-4" /> {t("profile.reset")}
      </Button>
    </AppShell>
  );
}
