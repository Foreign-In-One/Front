'use client';

import { ArrowLeft, ArrowRight, Plane } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { dDay, formatKDate, todayIso } from '@/lib/date';
import {
  type ExitAnswers,
  type ExitClaim,
  evaluateExit,
  exitRoadmap,
  monthsWorked,
  type RuleStatus,
  readExitAnswers,
  saveExitAnswers,
} from '@/lib/exit-check';
import { readProfile, type StoredProfile, saveProfile } from '@/lib/profile';

const STEP_TITLES = [
  '출국일 확인',
  '근무기간 확인',
  '보험 / 연금 확인',
  '필요 서류 확인',
  '준비 상태 확인',
  '출국 준비 요약',
];

const STATUS_TONE: Record<RuleStatus, 'ok' | 'warn' | 'info' | 'neutral'> = {
  '적용 가능성 있음': 'ok',
  '조건 미충족': 'neutral',
  '추가 자료 필요': 'warn',
  '현재 정보로 판단 불가': 'neutral',
  '대상 후보': 'info',
};

export function ExitCheckFlow() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<StoredProfile | null>(null);
  const [answers, setAnswers] = useState<ExitAnswers | null>(null);
  const [step, setStep] = useState(-1);

  useEffect(() => {
    setProfile(readProfile());
    setAnswers(readExitAnswers());
    setReady(true);
  }, []);

  const totalMonths = useMemo(
    () => (profile ? monthsWorked(profile.workStart) : null),
    [profile],
  );
  const claims = useMemo<ExitClaim[]>(
    () =>
      answers
        ? evaluateExit({
            totalMonths,
            exitDate: profile?.exit ?? '',
            answers,
          })
        : [],
    [totalMonths, profile?.exit, answers],
  );

  const updateExitDate = (value: string) => {
    if (!profile) return;
    const next = { ...profile, exit: value };
    setProfile(next);
    saveProfile(next);
  };

  const updateAnswer = (key: keyof ExitAnswers, value: boolean) => {
    setAnswers((previous) => {
      const next = { ...(previous as ExitAnswers), [key]: value };
      saveExitAnswers(next);
      return next;
    });
  };

  const back = () => {
    if (step <= 0) {
      step === -1 ? router.push('/') : setStep(-1);
      return;
    }
    setStep(step - 1);
  };

  if (!ready) return null;

  if (!profile) {
    return (
      <div className="f1-screen">
        <main className="f1-wrap f1-onboarding">
          <section className="f1-exit-start">
            <span className="f1-exit-start__icon">
              <Plane size={28} />
            </span>
            <h1>먼저 금융권리 프로필이 필요해요</h1>
            <p>
              출국 전 정산 확인은 등록된 근로 상태와 날짜를 기준으로 계산됩니다.
            </p>
            <button
              type="button"
              className="f1-next mt-8 w-full"
              onClick={() => router.push('/onboarding')}
            >
              프로필 만들러 가기 <ArrowRight size={18} />
            </button>
          </section>
        </main>
      </div>
    );
  }

  if (step < 0) {
    return (
      <div className="f1-screen">
        <main className="f1-wrap f1-onboarding">
          <section className="f1-exit-start">
            <span className="f1-exit-start__icon">
              <Plane size={28} />
            </span>
            <h1>출국 준비하기</h1>
            <p>출국 전에 확인해야 할 돈과 서류를 순서대로 확인합니다.</p>
            <button
              type="button"
              className="f1-next mt-8 w-full"
              onClick={() => setStep(0)}
            >
              출국 준비 시작 <ArrowRight size={18} />
            </button>
          </section>
        </main>
      </div>
    );
  }

  const answersReady = answers as ExitAnswers;

  return (
    <div className="f1-screen">
      <main className="f1-wrap f1-onboarding">
        <header className="f1-onboarding__top">
          <button
            type="button"
            className="f1-back"
            aria-label="이전"
            onClick={back}
          >
            <ArrowLeft size={18} />
          </button>
          <div className="f1-progress">
            <span
              style={{ width: `${((step + 1) / STEP_TITLES.length) * 100}%` }}
            />
          </div>
          <span className="f1-step-count">
            {step + 1}/{STEP_TITLES.length}
          </span>
        </header>

        <section className="f1-question">
          <h1>{STEP_TITLES[step]}</h1>

          <div className="mt-8">
            {step === 0 ? (
              <div className="f1-exit-hero-wrap">
                <div className="f1-exit-hero">
                  {profile.exit ? (
                    <>
                      <p className="f1-exit-hero__label">예상 출국일까지</p>
                      <p className="f1-exit-hero__value">
                        D-{dDay(profile.exit)}
                      </p>
                      <p className="f1-exit-hero__date">
                        {formatKDate(profile.exit)}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="f1-exit-hero__label">
                        예상 출국일이 등록되지 않았습니다.
                      </p>
                      <p className="f1-exit-hero__date">
                        출국일을 입력하면 준비 일정과 D-day를 계산합니다.
                      </p>
                    </>
                  )}
                </div>
                <label className="f1-exit-datefield">
                  <span>예상 출국일</span>
                  <input
                    type="date"
                    className="f1-date-picker"
                    value={profile.exit}
                    onChange={(event) => updateExitDate(event.target.value)}
                  />
                </label>
              </div>
            ) : null}

            {step === 1 ? (
              <div className="f1-exit-stack">
                <div className="f1-exit-card">
                  <p className="f1-exit-card__label">확인된 근속기간</p>
                  <p className="f1-exit-card__value">
                    {totalMonths === null
                      ? '근무 시작일이 없어 계산할 수 없습니다.'
                      : `약 ${totalMonths}개월`}
                  </p>
                  <p className="f1-exit-card__hint">
                    계속근로 1년 이상이면 퇴직금 대상 여부를 확인할 수 있습니다.
                  </p>
                </div>
                <ClaimView claim={claims.find((c) => c.id === 'severance')} />
              </div>
            ) : null}

            {step === 2 ? (
              <div className="f1-exit-stack">
                <YesNoQuestion
                  label="출국만기보험 가입 사실을 확인했나요?"
                  value={answersReady.hasInsuranceRecord}
                  onChange={(value) =>
                    updateAnswer('hasInsuranceRecord', value)
                  }
                />
                <YesNoQuestion
                  label="임금명세서에 국민연금 공제가 있나요?"
                  value={answersReady.pensionDeducted}
                  onChange={(value) => updateAnswer('pensionDeducted', value)}
                />
              </div>
            ) : null}

            {step === 3 ? (
              <div className="f1-exit-stack">
                <YesNoQuestion
                  label="출국 예정 증빙(항공권 등)이 있나요?"
                  value={answersReady.hasExitProof}
                  onChange={(value) => updateAnswer('hasExitProof', value)}
                />
                <YesNoQuestion
                  label="최근 3개월 급여명세서를 가지고 있나요?"
                  value={answersReady.hasRecentPayslip}
                  onChange={(value) => updateAnswer('hasRecentPayslip', value)}
                />
                <YesNoQuestion
                  label="본인 명의 계좌를 가지고 있나요?"
                  value={answersReady.hasOwnAccount}
                  onChange={(value) => updateAnswer('hasOwnAccount', value)}
                />
              </div>
            ) : null}

            {step === 4 ? (
              <div className="f1-exit-stack">
                {profile.exit ? (
                  <RoadmapView exitDate={profile.exit} />
                ) : (
                  <div className="f1-exit-card f1-exit-card--warn">
                    <p className="f1-exit-card__label">
                      예상 출국일이 등록되지 않았습니다.
                    </p>
                    <p className="f1-exit-card__hint">
                      출국일을 입력하면 준비 일정과 D-day를 계산합니다.
                    </p>
                  </div>
                )}
              </div>
            ) : null}

            {step === 5 ? (
              <div className="f1-exit-stack">
                {claims.map((claim) => (
                  <ClaimView key={claim.id} claim={claim} />
                ))}
                <p className="f1-exit-footnote">
                  지급 여부와 금액은 가입내역과 국가별 협정에 따라 달라지므로,
                  이 화면은 확인해야 할 조건과 서류를 정리해 드립니다.
                </p>
              </div>
            ) : null}
          </div>
        </section>

        <footer className="f1-onboarding__bottom">
          {step < STEP_TITLES.length - 1 ? (
            <button
              type="button"
              className="f1-next w-full"
              onClick={() => setStep(step + 1)}
            >
              다음 <ArrowRight size={18} />
            </button>
          ) : (
            <button
              type="button"
              className="f1-next w-full"
              onClick={() => router.push('/')}
            >
              홈으로
            </button>
          )}
        </footer>
      </main>
    </div>
  );
}

function YesNoQuestion({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | null;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="f1-exit-card">
      <p className="f1-exit-question__title">{label}</p>
      <div className="f1-exit-yesno">
        <button
          type="button"
          aria-pressed={value === true}
          onClick={() => onChange(true)}
        >
          예
        </button>
        <button
          type="button"
          aria-pressed={value === false}
          onClick={() => onChange(false)}
        >
          아니오
        </button>
      </div>
    </div>
  );
}

function RoadmapView({ exitDate }: { exitDate: string }) {
  const today = todayIso();
  const steps = exitRoadmap(exitDate);
  return (
    <div className="f1-exit-card">
      <p className="f1-exit-card__label">출국 준비 일정(권장)</p>
      <ol className="f1-exit-roadmap">
        {steps.map((item) => {
          const passed = item.date <= today;
          return (
            <li key={item.label}>
              <span
                className={`f1-exit-roadmap__dot${passed ? 'is-passed' : ''}`}
              />
              <div>
                <p className="f1-exit-roadmap__label">{item.label}</p>
                <p className="f1-exit-roadmap__detail">
                  {formatKDate(item.date)} · {item.detail}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="f1-exit-card__hint">
        위 날짜는 공식 기한이 아니라 서비스가 제안하는 권장 준비일입니다.
      </p>
    </div>
  );
}

function ClaimView({ claim }: { claim: ExitClaim | undefined }) {
  if (!claim) return null;
  return (
    <article className="f1-exit-claim">
      <span
        className={`f1-exit-pill f1-exit-pill--${STATUS_TONE[claim.status]}`}
      >
        {claim.status}
      </span>
      <h3 className="f1-exit-claim__title">{claim.title}</h3>

      <div className="f1-exit-claim__box">
        <p className="f1-exit-claim__box-label">확인된 내 정보</p>
        <ul>
          {claim.confirmed.map((item) => (
            <li key={item}>· {item}</li>
          ))}
        </ul>
      </div>

      {claim.missing.length ? (
        <p className="f1-exit-claim__missing">
          부족한 자료: {claim.missing.join(', ')}
        </p>
      ) : null}

      <p className="f1-exit-claim__docs">
        필요 서류: {claim.documents.join(', ')}
      </p>
      <p className="f1-exit-claim__next">→ {claim.nextAction}</p>

      <div className="f1-exit-claim__evidence">
        {claim.evidence.map((item) => (
          <a key={item.url} href={item.url} target="_blank" rel="noreferrer">
            {item.title}
          </a>
        ))}
      </div>
    </article>
  );
}
