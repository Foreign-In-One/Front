"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, Globe, Trash2, UserRound, Save, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { DateField } from "@/components/date-field";
import { ProfileSection, ProfileField } from "@/components/profile/profile-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePayCycle } from "@/state/paycycle-context";
import { useT, LOCALES, type UiLocale } from "@/i18n";
import { CountrySelect } from "@/components/country-select";
import { VISA_CODES, visaInfo } from "@/i18n/visa";
import { dDay } from "@/lib/paycycle/rule-engine";
import { updateProfileApi } from "@/services/api";
import type { EmploymentStatus, UserProfile, EmploymentProfile } from "@/lib/paycycle/types";

const STATUSES: EmploymentStatus[] = ["PRE_EMPLOYMENT", "EMPLOYED", "SEPARATED", "CHANGING"];

function getStatusLabel(status: string | undefined, t: any): string {
  if (!status) return "";
  const norm = status.toUpperCase();
  if (norm === "EMPLOYED" || norm === "WORKING") return t("profile.status.employed");
  if (norm === "PRE_EMPLOYMENT" || norm === "PRE") return t("profile.status.pre");
  if (norm === "SEPARATED") return t("profile.status.separated");
  if (norm === "CHANGING") return t("profile.status.changing");
  return status;
}

export default function ProfilePage() {
  const { state, hydrated, saveProfile, resetAll } = usePayCycle();
  const { t, locale, setLocale } = useT();
  const router = useRouter();

  const [pendingStatus, setPendingStatus] = useState<EmploymentStatus | null>(null);
  const [draftProfile, setDraftProfile] = useState<UserProfile | null>(null);
  const [draftEmployment, setDraftEmployment] = useState<EmploymentProfile | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // 초기 로딩 또는 글로벌 state 변경 시 draft 동기화
  useEffect(() => {
    if (state.profile && !draftProfile) {
      setDraftProfile(state.profile);
    }
    if (state.employment && !draftEmployment) {
      setDraftEmployment(state.employment);
    }
  }, [state.profile, state.employment, draftProfile, draftEmployment]);

  const profile = draftProfile || state.profile;
  const employment = draftEmployment || state.employment;

  // 수정사항 존재 여부(isDirty) 계산
  const isDirty = useMemo(() => {
    if (!state.profile || !state.employment || !draftProfile || !draftEmployment) return false;
    const p1 = state.profile;
    const p2 = draftProfile;
    const e1 = state.employment;
    const e2 = draftEmployment;

    return (
      p1.nickname !== p2.nickname ||
      p1.nationality !== p2.nationality ||
      p1.visa !== p2.visa ||
      e1.status !== e2.status ||
      e1.workplace !== e2.workplace ||
      e1.workStartDate.value !== e2.workStartDate.value ||
      e1.payDay !== e2.payDay ||
      e1.exitDate.value !== e2.exitDate.value
    );
  }, [state.profile, state.employment, draftProfile, draftEmployment]);

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
        <div className="rounded-3xl bg-card/90 p-6 text-center shadow-xl shadow-black/5 backdrop-blur-md">
          <p className="text-sm text-muted-foreground">{t("profile.empty")}</p>
          <Link
            href="/onboarding"
            className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-primary to-[#1D4A88] px-5 py-4 text-base font-bold text-primary-foreground shadow-xl shadow-primary/20 hover:scale-[1.01] active:scale-[0.99] transition-all"
          >
            {t("profile.create")}
          </Link>
        </div>
      </AppShell>
    );
  }

  const exitIso =
    employment.exitDate.value && !employment.exitDate.unknown ? employment.exitDate.value : null;

  // '수정사항 적용' 클릭 핸들러: DB 저장 API 호출 후 글로벌 Context 반영
  const handleApplyChanges = async () => {
    if (!draftProfile || !draftEmployment) return;
    setIsSaving(true);
    try {
      // 1. Spring Boot 백엔드 DB 저장 (PATCH /api/profile)
      await updateProfileApi({
        name: draftProfile.nickname,
        nationality: draftProfile.nationality,
        visaType: draftProfile.visa,
        entryDate: draftEmployment.entryDate.value || null,
        employmentStatus: draftEmployment.status,
        companyName: draftEmployment.workplace,
        workStartDate: draftEmployment.workStartDate.value || null,
        payday: draftEmployment.payDay ?? 25,
        expectedExitDate: draftEmployment.exitDate.value || null,
        language: draftProfile.language || "ko",
      });

      // 2. 프론트엔드 전역 상태 및 로컬 스토리지 동기화
      saveProfile(draftProfile, draftEmployment);

      toast.success(t("profile.applyChangesDone"));
    } catch (err) {
      console.error("Profile update failed:", err);
      toast.error(t("profile.applyChangesError"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppShell title={t("profile.title")} subtitle={t("profile.subtitle")}>
      {/* 프로필 헤더 카드 (딥블루 그라데이션) */}
      <section className="rounded-3xl bg-gradient-to-br from-[#143463] via-[#1A417A] to-[#143463] p-6 text-white shadow-xl shadow-primary/20 transition-all hover:scale-[1.01]">
        <div className="flex items-center gap-2 text-xs font-bold opacity-90">
          <UserRound className="size-4" /> {profile.nationality} · {profile.visa}
        </div>
        <p className="mt-1.5 text-2xl font-black tracking-tight">{profile.nickname}</p>
        <div className="mt-3.5 flex items-center gap-2 rounded-2xl bg-white/15 px-3.5 py-2 backdrop-blur-md w-fit text-xs font-bold shadow-inner">
          <CalendarClock className="size-4" />
          {exitIso ? t("profile.dday", { n: dDay(exitIso) }) : t("profile.ddayNone")}
        </div>
      </section>

      {/* 1. 사용자 기본정보 */}
      <ProfileSection title={t("profile.sec.user")}>
        <ProfileField label={t("profile.nickname")}>
          <Input
            value={profile.nickname}
            onChange={(e) =>
              setDraftProfile((prev) => (prev ? { ...prev, nickname: e.target.value } : null))
            }
            className="rounded-2xl text-xs font-bold border border-input bg-card shadow-xs focus-visible:ring-2 focus-visible:ring-ring"
          />
        </ProfileField>
      </ProfileSection>

      {/* 2. 국적 / 체류자격 (비자) - 드롭다운이 아래 섹션에 가려지지 않도록 relative z-30 */}
      <ProfileSection title={t("profile.sec.visa")} className="relative z-30">
        <ProfileField label={t("profile.nationality")}>
          <CountrySelect
            value={profile.nationality}
            onChange={(val) =>
              setDraftProfile((prev) => (prev ? { ...prev, nationality: val } : null))
            }
          />
        </ProfileField>

        <ProfileField label={t("profile.visa")}>
          <select
            value={profile.visa}
            onChange={(e) =>
              setDraftProfile((prev) => (prev ? { ...prev, visa: e.target.value } : null))
            }
            className="w-full rounded-2xl border border-input bg-card p-3.5 text-xs font-bold text-foreground shadow-xs focus:ring-2 focus:ring-ring"
          >
            {VISA_CODES.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </select>
          {profile.visa ? (
            <p className="mt-2.5 rounded-2xl bg-muted/60 p-3.5 text-xs font-semibold leading-relaxed text-foreground shadow-xs">
              {visaInfo(locale, profile.visa)}
            </p>
          ) : null}
        </ProfileField>
      </ProfileSection>

      {/* 3. 근로상태 & 사업장 & 근무 시작일 & 급여일 & 예상 출국일 */}
      <ProfileSection title={t("profile.sec.work")} className="relative z-10">
        <ProfileField label={t("profile.status")}>
          <div className="grid grid-cols-2 gap-2.5">
            {STATUSES.map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => {
                  if (employment.status === st) return;
                  setPendingStatus(st);
                }}
                className={`rounded-2xl p-3.5 text-xs font-bold transition-all ${
                  employment.status === st || ((employment.status as string) === "WORKING" && st === "EMPLOYED")
                    ? "bg-gradient-to-br from-primary to-[#1D4A88] text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]"
                    : "bg-card text-muted-foreground hover:text-foreground border border-border/60 shadow-xs hover:scale-[1.01]"
                }`}
              >
                {getStatusLabel(st, t)}
              </button>
            ))}
          </div>
        </ProfileField>

        <ProfileField label={t("profile.workplace")}>
          <Input
            value={employment.workplace}
            onChange={(e) =>
              setDraftEmployment((prev) => (prev ? { ...prev, workplace: e.target.value } : null))
            }
            className="rounded-2xl text-xs font-bold border border-input bg-card shadow-xs focus-visible:ring-2 focus-visible:ring-ring"
          />
        </ProfileField>

        <ProfileField label={t("profile.workStart")}>
          <DateField
            label={t("profile.workStart")}
            value={employment.workStartDate}
            onChange={(next) =>
              setDraftEmployment((prev) => (prev ? { ...prev, workStartDate: next } : null))
            }
            rule={{ noFuture: true }}
          />
        </ProfileField>

        <ProfileField label={t("profile.payDay")}>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={1}
              max={31}
              placeholder={t("ob.q.payDay")}
              value={employment.payDay ?? ""}
              onChange={(e) =>
                setDraftEmployment((prev) =>
                  prev
                    ? {
                        ...prev,
                        payDay: e.target.value ? Number.parseInt(e.target.value, 10) : null,
                      }
                    : null
                )
              }
              className="rounded-2xl text-xs font-bold border border-input bg-card shadow-xs focus-visible:ring-2 focus-visible:ring-ring"
            />
            <span className="text-xs font-bold text-muted-foreground">{t("profile.payDaySuffix")}</span>
          </div>
        </ProfileField>

        <ProfileField label={t("profile.exitDate")}>
          <DateField
            label={t("profile.exitDate")}
            value={employment.exitDate}
            onChange={(next) =>
              setDraftEmployment((prev) => (prev ? { ...prev, exitDate: next } : null))
            }
            rule={{ noPast: true }}
          />
        </ProfileField>
      </ProfileSection>

      {/* 4. 언어 선택 */}
      <ProfileSection title={t("common.language")} className="relative z-0">
        <div className="grid grid-cols-2 gap-2.5">
          {LOCALES.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => setLocale(l.code as UiLocale)}
              className={`flex items-center justify-between rounded-2xl p-3.5 text-xs font-bold transition-all ${
                locale === l.code
                  ? "bg-gradient-to-br from-primary to-[#1D4A88] text-primary-foreground shadow-lg shadow-primary/20 scale-[1.02]"
                  : "bg-card text-muted-foreground hover:text-foreground border border-border/60 shadow-xs hover:scale-[1.01]"
              }`}
            >
              <span>{l.label}</span>
              {locale === l.code && <Globe className="size-4 text-white" />}
            </button>
          ))}
        </div>
      </ProfileSection>

      {/* 하단 액션 버튼 영역 */}
      <div className="mt-6 space-y-3">
        {/* 수정사항 적용 버튼 */}
        <Button
          type="button"
          disabled={!isDirty || isSaving}
          onClick={handleApplyChanges}
          className={`w-full h-14 rounded-2xl text-sm font-black transition-all flex items-center justify-center gap-2 ${
            isDirty
              ? "bg-gradient-to-r from-primary via-[#1A417A] to-primary text-primary-foreground shadow-xl shadow-primary/25 hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
              : "bg-muted/70 text-muted-foreground border border-border/50 cursor-not-allowed opacity-70"
          }`}
        >
          {isSaving ? (
            <>
              <Loader2 className="size-5 animate-spin" />
              <span>{t("profile.applying")}</span>
            </>
          ) : (
            <>
              <Save className="size-5" />
              <span>{t("profile.applyChanges")}</span>
              {isDirty && (
                <span className="ml-1.5 rounded-full bg-white/25 px-2 py-0.5 text-[11px] font-bold text-white shadow-xs">
                  {t("profile.modifiedBadge")}
                </span>
              )}
            </>
          )}
        </Button>

        {/* 초기화 버튼 */}
        <Button
          variant="ghost"
          className="w-full h-12 rounded-2xl text-xs font-bold text-destructive bg-destructive/5 hover:bg-destructive/10 shadow-xs transition-all"
          onClick={() => {
            resetAll();
            toast.success(t("profile.resetDone"));
            router.push("/onboarding");
          }}
        >
          <Trash2 className="mr-2 size-4" />
          {t("profile.reset")}
        </Button>
      </div>

      {/* 근로 상태 변경 확인 모달 다이얼로그 */}
      <Dialog open={pendingStatus !== null} onOpenChange={(open) => !open && setPendingStatus(null)}>
        <DialogContent className="sm:max-w-md rounded-3xl p-6 border border-border bg-card text-card-foreground shadow-2xl z-[100]">
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-base font-black text-foreground">
              {t("profile.statusModal.title")}
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed text-muted-foreground">
              {pendingStatus &&
                t("profile.statusModal.desc", {
                  from: getStatusLabel(employment.status, t),
                  to: getStatusLabel(pendingStatus, t),
                })}
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-2.5 pt-4 justify-end">
            <Button
              variant="ghost"
              className="rounded-2xl text-xs font-bold text-muted-foreground hover:text-foreground"
              onClick={() => setPendingStatus(null)}
            >
              {t("profile.statusModal.cancel")}
            </Button>
            <Button
              className="rounded-2xl bg-gradient-to-r from-primary to-[#1D4A88] text-primary-foreground text-xs font-bold shadow-md shadow-primary/20 hover:scale-[1.01] transition-all"
              onClick={() => {
                if (pendingStatus) {
                  setDraftEmployment((prev) =>
                    prev ? { ...prev, status: pendingStatus } : null
                  );
                  setPendingStatus(null);
                }
              }}
            >
              {t("profile.statusModal.confirm")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
