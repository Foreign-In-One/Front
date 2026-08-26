'use client';

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  CircleMinus,
  Clipboard,
  FileCheck2,
  History,
  Home,
  Info,
  Plane,
  Receipt,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  UserRound,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { saveTaxCheckResult } from '../../lib/paycycle/result-storage';
import {
  evaluateTax,
  formatWon,
  INITIAL_TAX_PROFILE,
  type RuleTone,
  TAXCHECK_DEMO_INPUT,
  type TaxProfile,
  type TaxRuleCard,
} from '../../lib/paycycle/taxcheck';
import styles from './page.module.css';

const STEP_TOTAL = 4;
const STEP_TITLES = [
  '현재 정보 확인',
  '주택청약저축 확인',
  '세율 선택 확인',
  '확인 결과',
];

const NAV_ITEMS = [
  { href: '/dashboard', label: '홈', icon: Home },
  { href: '/calendar', label: '캘린더', icon: CalendarClock },
  { href: '/paycheck', label: '급여', icon: Wallet },
  { href: '/taxcheck', label: '세금', icon: Receipt },
  { href: '/exitcheck', label: '출국', icon: Plane },
] as const;

type SaveState = 'idle' | 'saved' | 'failed';

export default function TaxCheckPage() {
  // -1은 시작 화면, 0~3은 Lovable 원본의 4개 내부 단계입니다.
  const [step, setStep] = useState(-1);
  const [taxProfile, setTaxProfile] = useState<TaxProfile>(INITIAL_TAX_PROFILE);
  const [toast, setToast] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const savedFingerprint = useRef<string | null>(null);

  const cards = useMemo(
    () => evaluateTax({ ...TAXCHECK_DEMO_INPUT, taxProfile }),
    [taxProfile],
  );

  const daysText =
    cards.find((card) => card.id === 'resident')?.confirmed[2] ??
    '국내 체류일: 계산 불가';
  const applicableCount = cards.filter(
    (card) => card.status === '적용 가능성 있음',
  ).length;
  const needsActionCount = cards.filter(
    (card) => card.status === '추가 자료 필요',
  ).length;
  const unknownCount = cards.filter(
    (card) => card.status === '현재 정보로 판단 불가',
  ).length;

  const canGoNext = useMemo(() => {
    if (step === 1) {
      const housingAnswered = taxProfile.housingSaving !== null;
      const homelessAnswered = taxProfile.isHomeless !== null;
      const proofAnswered =
        taxProfile.housingSaving === false ||
        taxProfile.housingSavingProof !== null;
      return housingAnswered && homelessAnswered && proofAnswered;
    }

    if (step === 2) return taxProfile.usesDeductions !== null;
    return true;
  }, [step, taxProfile]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  // 결과 화면에 도달하면 동일 입력은 한 번만 저장합니다.
  useEffect(() => {
    if (step !== STEP_TOTAL - 1) return;

    const fingerprint = JSON.stringify({
      year: TAXCHECK_DEMO_INPUT.year,
      yearlyPay: TAXCHECK_DEMO_INPUT.yearlyPay,
      monthsRecorded: TAXCHECK_DEMO_INPUT.monthsRecorded,
      taxProfile,
    });

    if (savedFingerprint.current === fingerprint) return;
    savedFingerprint.current = fingerprint;

    const saved = saveTaxCheckResult({
      year: TAXCHECK_DEMO_INPUT.year,
      yearlyPay: TAXCHECK_DEMO_INPUT.yearlyPay,
      monthsRecorded: TAXCHECK_DEMO_INPUT.monthsRecorded,
      taxProfile,
      cards,
    });

    if (saved) {
      setSaveState('saved');
      setToast('TaxCheck 결과를 내 기록에 저장했어요.');
    } else {
      setSaveState('failed');
      setToast('결과를 저장하지 못했어요. 브라우저 설정을 확인해 주세요.');
    }
  }, [cards, step, taxProfile]);

  const updateProfile = (patch: Partial<TaxProfile>) => {
    setTaxProfile((current) => ({ ...current, ...patch }));
  };

  const goBack = () => {
    if (step === 0) {
      setStep(-1);
      return;
    }
    setStep((current) => Math.max(current - 1, 0));
  };

  const goNext = () => {
    if (!canGoNext) return;
    setStep((current) => Math.min(current + 1, STEP_TOTAL - 1));
  };

  const reset = () => {
    setTaxProfile(INITIAL_TAX_PROFILE);
    setSaveState('idle');
    savedFingerprint.current = null;
    setStep(-1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className={styles.app}>
      <header className={styles.appHeader}>
        <div className={styles.headerInner}>
          <div className={styles.headingArea}>
            <p className={styles.eyebrow}>PayCycle AI</p>
            <h1>TaxCheck</h1>
            <p>내 데이터로 연말정산 확인 항목과 필요한 자료를 정리해요.</p>
          </div>

          <div className={styles.headerActions}>
            <Link
              href="/records"
              className={styles.iconLink}
              aria-label="내 기록 보기"
            >
              <History aria-hidden="true" />
            </Link>
            <Link
              href="/profile"
              className={styles.iconLink}
              aria-label="내 프로필 보기"
            >
              <UserRound aria-hidden="true" />
            </Link>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        {step < 0 ? (
          <StartScreen onStart={() => setStep(0)} />
        ) : (
          <section className={styles.wizard} aria-labelledby="step-title">
            <div className={styles.progressHeader}>
              <button
                type="button"
                className={styles.backIcon}
                onClick={goBack}
                aria-label="이전 화면"
              >
                <ArrowLeft aria-hidden="true" />
              </button>

              <div
                className={styles.progressTrack}
                role="progressbar"
                aria-valuemin={1}
                aria-valuemax={STEP_TOTAL}
                aria-valuenow={step + 1}
                aria-label={`TaxCheck ${step + 1}단계`}
              >
                <span
                  style={{ width: `${((step + 1) / STEP_TOTAL) * 100}%` }}
                />
              </div>
              <span className={styles.progressCount}>
                {step + 1}/{STEP_TOTAL}
              </span>
            </div>

            <div key={step} className={styles.stepContent}>
              <div className={styles.stepHeading}>
                <span>STEP {step + 1}</span>
                <h2 id="step-title">{STEP_TITLES[step]}</h2>
                <p>{stepDescription(step)}</p>
              </div>

              {step === 0 && (
                <CurrentDataStep cards={cards} daysText={daysText} />
              )}

              {step === 1 && (
                <HousingStep
                  taxProfile={taxProfile}
                  updateProfile={updateProfile}
                />
              )}

              {step === 2 && (
                <FlatTaxStep
                  taxProfile={taxProfile}
                  updateProfile={updateProfile}
                  card={cards.find((card) => card.id === 'flat')}
                />
              )}

              {step === 3 && (
                <ResultStep
                  cards={cards}
                  applicableCount={applicableCount}
                  needsActionCount={needsActionCount}
                  unknownCount={unknownCount}
                  saveState={saveState}
                  onNotify={setToast}
                  onReset={reset}
                />
              )}
            </div>

            {step < STEP_TOTAL - 1 && (
              <div className={styles.wizardFooter}>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={goBack}
                >
                  이전
                </button>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={goNext}
                  disabled={!canGoNext}
                >
                  {step === 2 ? '결과 보기' : '다음'}
                  <ArrowRight aria-hidden="true" />
                </button>
                {!canGoNext && (
                  <output className={styles.validationMessage}>
                    모든 질문에 답하면 다음 단계로 이동할 수 있어요.
                  </output>
                )}
              </div>
            )}
          </section>
        )}
      </main>

      <nav className={styles.bottomNav} aria-label="주요 메뉴">
        <ul>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = item.href === '/taxcheck';
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={active ? styles.navActive : undefined}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {toast && (
        <output className={styles.toast} aria-live="polite">
          <CheckCircle2 aria-hidden="true" />
          {toast}
        </output>
      )}
    </div>
  );
}

function StartScreen({ onStart }: { onStart: () => void }) {
  return (
    <section className={styles.startScreen}>
      <div className={styles.startIcon}>
        <Receipt aria-hidden="true" />
      </div>
      <span className={styles.startBadge}>연말정산 사전점검</span>
      <h2>
        놓치기 쉬운 세금 항목을
        <br />내 데이터로 확인해 보세요
      </h2>
      <p>
        저장된 급여와 입국 정보를 바탕으로 거주자 여부, 주택청약저축 공제,
        외국인 근로자 단일세율 검토 항목을 순서대로 정리합니다.
      </p>

      <div className={styles.startPoints}>
        <StartPoint
          icon={<ShieldCheck />}
          title="규칙 기반 확인"
          description="답변과 저장 정보로만 판정해요."
        />
        <StartPoint
          icon={<FileCheck2 />}
          title="준비 자료 안내"
          description="부족한 서류와 다음 행동을 알려드려요."
        />
        <StartPoint
          icon={<History />}
          title="결과 자동 저장"
          description="내 기록과 대시보드에서 다시 볼 수 있어요."
        />
      </div>

      <div className={styles.cautionBox}>
        <Info aria-hidden="true" />
        <p>
          이 결과는 세무 신고나 법률상 최종 판단을 대신하지 않으며, 실제 적용
          여부는 담당자 확인이 필요합니다.
        </p>
      </div>

      <button type="button" className={styles.startButton} onClick={onStart}>
        TaxCheck 시작하기
        <ArrowRight aria-hidden="true" />
      </button>
    </section>
  );
}

function StartPoint({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className={styles.startPoint}>
      <span>{icon}</span>
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
    </div>
  );
}

function CurrentDataStep({
  cards,
  daysText,
}: {
  cards: TaxRuleCard[];
  daysText: string;
}) {
  return (
    <div className={styles.stack}>
      <article className={styles.salaryCard}>
        <div className={styles.salaryTop}>
          <div>
            <p>올해 확인된 급여</p>
            <strong>{formatWon(TAXCHECK_DEMO_INPUT.yearlyPay)}</strong>
          </div>
          <span>
            <Sparkles aria-hidden="true" /> 샘플 데이터
          </span>
        </div>
        <div className={styles.salaryMeta}>
          <span>{TAXCHECK_DEMO_INPUT.year}년</span>
          <span>급여 기록 {TAXCHECK_DEMO_INPUT.monthsRecorded}개월</span>
          <span>{daysText.replace('국내 체류일: ', '체류일 ')}</span>
        </div>
      </article>

      <div className={styles.dataNotice}>
        <Info aria-hidden="true" />
        <p>
          <strong>현재는 시연용 데이터입니다.</strong> Spring API 연결 후에는
          로그인 사용자의 급여 합계와 입국일을 자동으로 불러옵니다.
        </p>
      </div>

      <RuleCardView
        card={cards.find((card) => card.id === 'resident')}
        defaultOpen
      />
    </div>
  );
}

function HousingStep({
  taxProfile,
  updateProfile,
}: {
  taxProfile: TaxProfile;
  updateProfile: (patch: Partial<TaxProfile>) => void;
}) {
  return (
    <div className={styles.stack}>
      <QuestionCard
        title="주택청약저축에 가입했나요?"
        hint="본인 명의의 주택청약종합저축을 기준으로 답해 주세요."
      >
        <BooleanChoice
          name="housingSaving"
          value={taxProfile.housingSaving}
          onChange={(value) =>
            updateProfile({
              housingSaving: value,
              housingSavingProof: value ? taxProfile.housingSavingProof : null,
            })
          }
        />
      </QuestionCard>

      {taxProfile.housingSaving === true && (
        <QuestionCard
          title="주택청약저축 납입증명서가 있나요?"
          hint="금융기관 또는 홈택스에서 확인할 수 있습니다."
        >
          <BooleanChoice
            name="housingSavingProof"
            value={taxProfile.housingSavingProof}
            onChange={(value) => updateProfile({ housingSavingProof: value })}
          />
        </QuestionCard>
      )}

      <QuestionCard
        title="현재 무주택자인가요?"
        hint="공제 기준일의 세대주·주택 보유 조건은 별도 확인이 필요합니다."
      >
        <BooleanChoice
          name="isHomeless"
          value={taxProfile.isHomeless}
          onChange={(value) => updateProfile({ isHomeless: value })}
        />
      </QuestionCard>
    </div>
  );
}

function FlatTaxStep({
  taxProfile,
  updateProfile,
  card,
}: {
  taxProfile: TaxProfile;
  updateProfile: (patch: Partial<TaxProfile>) => void;
  card: TaxRuleCard | undefined;
}) {
  return (
    <div className={styles.stack}>
      <QuestionCard
        title="현재 다른 소득공제를 사용하고 있나요?"
        hint="보험료·의료비·교육비·신용카드 등 공제 사용 여부를 기준으로 답해 주세요."
      >
        <BooleanChoice
          name="usesDeductions"
          value={taxProfile.usesDeductions}
          onChange={(value) => updateProfile({ usesDeductions: value })}
        />
      </QuestionCard>

      <div className={styles.cautionBox}>
        <AlertTriangle aria-hidden="true" />
        <p>
          19% 단일세율의 실제 유불리는 이 답변만으로 결정되지 않습니다.
          일반세율로 계산한 세액과 반드시 비교해야 합니다.
        </p>
      </div>

      <RuleCardView card={card} />
    </div>
  );
}

function ResultStep({
  cards,
  applicableCount,
  needsActionCount,
  unknownCount,
  saveState,
  onNotify,
  onReset,
}: {
  cards: TaxRuleCard[];
  applicableCount: number;
  needsActionCount: number;
  unknownCount: number;
  saveState: SaveState;
  onNotify: (message: string) => void;
  onReset: () => void;
}) {
  return (
    <div className={styles.stack}>
      <article className={styles.resultSummaryCard}>
        <div className={styles.completeIcon}>
          <Check aria-hidden="true" />
        </div>
        <div>
          <span className={styles.completeBadge}>확인 완료</span>
          <h3>추가로 확인할 항목을 정리했어요</h3>
          <p>입력한 답변과 현재 저장된 급여 정보를 기준으로 만든 결과입니다.</p>
        </div>

        <div className={styles.countGrid}>
          <div className={styles.countPossible}>
            <strong>{applicableCount}</strong>
            <span>적용 가능성</span>
          </div>
          <div className={styles.countNeed}>
            <strong>{needsActionCount}</strong>
            <span>추가 자료</span>
          </div>
          <div className={styles.countUnknown}>
            <strong>{unknownCount}</strong>
            <span>판단 보류</span>
          </div>
        </div>

        <p
          className={`${styles.saveMessage} ${saveState === 'failed' ? styles.saveFailed : ''}`}
        >
          {saveState === 'saved' && (
            <>
              <CheckCircle2 aria-hidden="true" /> 결과가 내 기록에 자동
              저장됐어요.
            </>
          )}
          {saveState === 'failed' && (
            <>
              <AlertTriangle aria-hidden="true" /> 브라우저 저장소에 결과를
              저장하지 못했어요.
            </>
          )}
          {saveState === 'idle' && <>결과를 저장하고 있어요.</>}
        </p>
      </article>

      {cards.map((card) => (
        <RuleCardView key={card.id} card={card} onNotify={onNotify} />
      ))}

      <div className={styles.finalDisclaimer}>
        <CircleHelp aria-hidden="true" />
        <p>
          TaxCheck는 준비할 항목을 안내합니다. 세액·공제 한도·거주자 구분의 최종
          결정은 국세청 또는 세무 전문가에게 확인하세요.
        </p>
      </div>

      <div className={styles.resultButtons}>
        <Link href="/records" className={styles.primaryLink}>
          내 기록에서 보기 <History aria-hidden="true" />
        </Link>
        <button type="button" className={styles.resetButton} onClick={onReset}>
          <RotateCcw aria-hidden="true" /> 처음부터 다시 확인
        </button>
      </div>
    </div>
  );
}

function QuestionCard({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <article className={styles.questionCard}>
      <h3>{title}</h3>
      {hint && <p>{hint}</p>}
      <div className={styles.choiceGroup}>{children}</div>
    </article>
  );
}

function BooleanChoice({
  name,
  value,
  onChange,
}: {
  name: string;
  value: boolean | null;
  onChange: (value: boolean) => void;
}) {
  return (
    <>
      {[
        { label: '예', value: true },
        { label: '아니요', value: false },
      ].map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.label}
            type="button"
            name={name}
            aria-pressed={active}
            className={active ? styles.choiceActive : undefined}
            onClick={() => onChange(option.value)}
          >
            <span>{active && <Check aria-hidden="true" />}</span>
            {option.label}
          </button>
        );
      })}
    </>
  );
}

function RuleCardView({
  card,
  defaultOpen = false,
  onNotify,
}: {
  card: TaxRuleCard | undefined;
  defaultOpen?: boolean;
  onNotify?: (message: string) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (!card) return null;

  const toneClass: Record<RuleTone, string> = {
    possible: styles.rulePossible,
    need: styles.ruleNeed,
    not: styles.ruleNot,
    unknown: styles.ruleUnknown,
  };

  const StatusIcon = {
    possible: CheckCircle2,
    need: AlertTriangle,
    not: CircleMinus,
    unknown: CircleHelp,
  }[card.tone];

  const copyText = [
    `[${card.status}] ${card.title}`,
    card.summary,
    '',
    '다음 행동',
    ...card.nextActions.map((action, index) => `${index + 1}. ${action}`),
  ].join('\n');

  const handleCopy = async () => {
    const copied = await copyToClipboard(copyText);
    onNotify?.(
      copied
        ? '확인 결과를 복사했어요.'
        : '복사하지 못했어요. 다시 시도해 주세요.',
    );
  };

  return (
    <article className={`${styles.ruleCard} ${toneClass[card.tone]}`}>
      <div className={styles.ruleHeader}>
        <span className={styles.statusPill}>
          <StatusIcon aria-hidden="true" />
          {card.status}
        </span>
        <h3>{card.title}</h3>
        <p>{card.summary}</p>
      </div>

      <div className={styles.actionBox}>
        <strong>다음 행동</strong>
        {card.nextActions.length ? (
          <ol>
            {card.nextActions.map((action, index) => (
              <li key={action}>
                <span>{index + 1}</span>
                <p>{action}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p>현재 추가로 안내할 행동이 없습니다.</p>
        )}
      </div>

      <div className={styles.ruleActions}>
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
        >
          왜 이렇게 나왔나요?
          <ChevronDown
            className={open ? styles.chevronOpen : undefined}
            aria-hidden="true"
          />
        </button>
        <button type="button" onClick={handleCopy}>
          <Clipboard aria-hidden="true" /> 결과 복사
        </button>
      </div>

      {open && (
        <div className={styles.reasonPanel}>
          <DetailList
            title="확인된 정보"
            items={card.confirmed}
            tone="confirmed"
          />
          {card.missing.length > 0 && (
            <DetailList
              title="더 필요한 정보"
              items={card.missing}
              tone="missing"
            />
          )}
          <div className={styles.evidenceArea}>
            <strong>공식 근거</strong>
            {card.evidence.map((evidence) => (
              <a
                key={evidence.url}
                href={evidence.url}
                target="_blank"
                rel="noreferrer"
              >
                {evidence.title}
                <ArrowRight aria-hidden="true" />
              </a>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

function DetailList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: 'confirmed' | 'missing';
}) {
  return (
    <div className={styles.detailList}>
      <strong>{title}</strong>
      <ul>
        {items.map((item) => (
          <li key={item}>
            {tone === 'confirmed' ? (
              <CheckCircle2 aria-hidden="true" />
            ) : (
              <AlertTriangle aria-hidden="true" />
            )}
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function stepDescription(step: number) {
  switch (step) {
    case 0:
      return '분석에 사용되는 급여 기록과 체류 정보를 먼저 확인합니다.';
    case 1:
      return '주택청약저축 공제 검토에 필요한 조건과 서류를 확인합니다.';
    case 2:
      return '외국인 근로자 단일세율 비교에 필요한 정보를 확인합니다.';
    default:
      return '판정 이유와 준비해야 할 자료를 항목별로 확인하세요.';
  }
}

async function copyToClipboard(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    textarea.remove();
    return copied;
  } catch {
    return false;
  }
}
