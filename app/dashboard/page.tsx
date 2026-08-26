'use client';

import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  History,
  Home,
  Plane,
  Receipt,
  ShieldCheck,
  UserRound,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  listSavedResults,
  type SavedExitCheckResult,
  type SavedPayCheckResult,
  type SavedResult,
  type SavedTaxCheckResult,
} from '../../lib/paycycle/result-storage';
import { formatWon } from '../../lib/paycycle/taxcheck';
import styles from './page.module.css';

const NAV_ITEMS = [
  { href: '/dashboard', label: '홈', icon: Home },
  { href: '/calendar', label: '캘린더', icon: CalendarClock },
  { href: '/paycheck', label: '급여', icon: Wallet },
  { href: '/taxcheck', label: '세금', icon: Receipt },
  { href: '/exitcheck', label: '출국', icon: Plane },
] as const;

const KIND_META = {
  pay: { label: '급여', icon: Wallet, className: 'pay' },
  tax: { label: '세금', icon: Receipt, className: 'tax' },
  exit: { label: '출국', icon: Plane, className: 'exit' },
} as const;

export default function DashboardPage() {
  const [results, setResults] = useState<SavedResult[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setResults(listSavedResults());
    setHydrated(true);
  }, []);

  const latestPay = useMemo(
    () => results.find((result) => result.kind === 'pay'),
    [results],
  );
  const latestTax = useMemo(
    () => results.find((result) => result.kind === 'tax'),
    [results],
  );
  const latestExit = useMemo(
    () => results.find((result) => result.kind === 'exit'),
    [results],
  );
  const recentResults = useMemo(() => results.slice(0, 3), [results]);

  const payResults = useMemo(
    () => results.filter((result) => result.kind === 'pay'),
    [results],
  );
  const yearlyPay =
    latestTax?.yearlyPay ??
    payResults.reduce((total, result) => total + (result.paidAmount ?? 0), 0);
  const monthsRecorded = latestTax?.monthsRecorded ?? payResults.length;
  const hasPaySummary =
    Boolean(latestTax) ||
    payResults.some((result) => result.paidAmount !== null);
  const summaryYear = latestTax?.year ?? new Date().getFullYear();
  const paySummaryLabel = latestTax
    ? `${summaryYear}년 확인된 급여`
    : '저장된 급여 합계';
  const needsReviewCount = latestTax ? taxReviewCount(latestTax) : 0;

  return (
    <div className={styles.app}>
      <header className={styles.appHeader}>
        <div className={styles.headerInner}>
          <div className={styles.headingArea}>
            <p className={styles.eyebrow}>PayCycle AI</p>
            <h1>내 금융권리 대시보드</h1>
            <p>급여·세금·출국 확인 상태를 한눈에 살펴봐요.</p>
          </div>

          <div className={styles.headerActions}>
            <Link
              href="/records"
              className={styles.iconLink}
              aria-label="내 확인 기록 보기"
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
        {!hydrated ? (
          <DashboardSkeleton />
        ) : (
          <>
            <section
              className={styles.payHero}
              aria-labelledby="yearly-pay-title"
            >
              <div className={styles.payHeroTop}>
                <div>
                  <p id="yearly-pay-title">{paySummaryLabel}</p>
                  <strong>
                    {hasPaySummary ? formatWon(yearlyPay) : '아직 집계 전'}
                  </strong>
                </div>
                <span className={styles.heroIcon}>
                  <Wallet aria-hidden="true" />
                </span>
              </div>

              <div className={styles.heroMeta}>
                <div>
                  <span>기록 개월</span>
                  <strong>
                    {monthsRecorded > 0 ? `${monthsRecorded}개월` : '기록 없음'}
                  </strong>
                </div>
                <div>
                  <span>전체 확인 기록</span>
                  <strong>{results.length}건</strong>
                </div>
                <div>
                  <span>세금 추가 확인</span>
                  <strong>
                    {latestTax ? `${needsReviewCount}건` : '확인 전'}
                  </strong>
                </div>
              </div>

              <p className={styles.heroNotice}>
                <ShieldCheck aria-hidden="true" />
                {results[0]
                  ? `최근 업데이트 ${formatShortDate(results[0].createdAt)} · 저장 결과 기준`
                  : '확인을 완료하면 이 브라우저에서 자동으로 집계해요.'}
              </p>
            </section>

            <NextAction
              latestPay={latestPay}
              latestTax={latestTax}
              latestExit={latestExit}
              needsReviewCount={needsReviewCount}
              hasResults={results.length > 0}
            />

            <section
              className={styles.section}
              aria-labelledby="check-status-title"
            >
              <div className={styles.sectionHeading}>
                <div>
                  <p>RIGHTS CHECK</p>
                  <h2 id="check-status-title">나의 확인 현황</h2>
                </div>
                <span>저장 결과 기준</span>
              </div>

              <PayStatusCard result={latestPay} />

              <div className={styles.checkGrid}>
                <TaxStatusCard result={latestTax} />
                <ExitStatusCard result={latestExit} />
              </div>
            </section>

            <section
              className={styles.recentSection}
              aria-labelledby="recent-title"
            >
              <div className={styles.recentHeading}>
                <div>
                  <History aria-hidden="true" />
                  <h2 id="recent-title">최근 확인 기록</h2>
                </div>
                <Link href="/records">
                  전체 보기 <ChevronRight aria-hidden="true" />
                </Link>
              </div>

              {recentResults.length ? (
                <ul className={styles.recentList}>
                  {recentResults.map((result) => (
                    <RecentResult key={result.id} result={result} />
                  ))}
                </ul>
              ) : (
                <div className={styles.recentEmpty}>
                  <History aria-hidden="true" />
                  <div>
                    <strong>아직 저장된 확인 기록이 없습니다</strong>
                    <p>확인을 완료하면 최근 결과가 이곳에 표시돼요.</p>
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </main>

      <nav className={styles.bottomNav} aria-label="주요 메뉴">
        <ul>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = item.href === '/dashboard';
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
    </div>
  );
}

function NextAction({
  latestPay,
  latestTax,
  latestExit,
  needsReviewCount,
  hasResults,
}: {
  latestPay: SavedPayCheckResult | undefined;
  latestTax: SavedTaxCheckResult | undefined;
  latestExit: SavedExitCheckResult | undefined;
  needsReviewCount: number;
  hasResults: boolean;
}) {
  let title = '첫 금융권리 확인을 시작해보세요';
  let description =
    'TaxCheck로 현재 정보와 준비해야 할 세금 자료를 먼저 확인할 수 있어요.';
  let href = '/taxcheck';
  let linkLabel = 'TaxCheck 시작하기';

  if (latestTax && needsReviewCount > 0) {
    title = `세금 항목 ${needsReviewCount}개를 추가로 확인해 주세요`;
    description =
      '판단에 필요한 정보나 서류가 부족한 항목이 있어요. 저장된 판정과 다음 행동을 확인해 보세요.';
    href = '/records';
    linkLabel = '판정 상세 보기';
  } else if (hasResults && !latestPay) {
    title = '이번 달 급여가 맞는지 확인해 보세요';
    description =
      '계약서·급여명세서·입금내역을 비교하면 금액 차이와 확인할 항목을 찾을 수 있어요.';
    href = '/paycheck';
    linkLabel = 'PayCheck 시작하기';
  } else if (hasResults && !latestExit) {
    title = '출국 예정이 있다면 준비 항목을 확인해 보세요';
    description =
      '보험·연금·퇴직금 등 출국 전에 확인할 권리와 필요한 자료를 미리 정리할 수 있어요.';
    href = '/exitcheck';
    linkLabel = 'ExitCheck 시작하기';
  } else if (hasResults) {
    title = '저장된 확인 결과를 다시 살펴보세요';
    description =
      '최근 급여·세금·출국 결과와 추가로 확인할 항목을 기록 화면에서 볼 수 있어요.';
    href = '/records';
    linkLabel = '최근 기록 보기';
  }

  return (
    <section className={styles.actionBanner} aria-label="추천하는 다음 행동">
      <span>
        <CircleAlert aria-hidden="true" />
      </span>
      <div>
        <small>NEXT ACTION</small>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      <Link href={href}>
        {linkLabel} <ArrowRight aria-hidden="true" />
      </Link>
    </section>
  );
}

function PayStatusCard({
  result,
}: {
  result: SavedPayCheckResult | undefined;
}) {
  const status = payStatus(result?.status);

  return (
    <article className={styles.payCard}>
      <div className={styles.cardTop}>
        <span className={`${styles.cardIcon} ${styles.payIcon}`}>
          <Wallet aria-hidden="true" />
        </span>
        <div>
          <p>이번 달 급여</p>
          <h3>{result ? result.payPeriod : '아직 확인하지 않음'}</h3>
        </div>
        <span className={`${styles.statusPill} ${styles[status.tone]}`}>
          {status.label}
        </span>
      </div>

      <p className={styles.cardDescription}>
        {result
          ? `최근 확인된 실제 입금액은 ${
              result.paidAmount === null
                ? '확인할 수 없습니다'
                : formatWon(result.paidAmount)
            }.`
          : '급여 확인 결과가 없습니다. 서류를 비교해 이번 달 급여를 확인해 보세요.'}
      </p>

      <Link href="/paycheck" className={styles.cardLink}>
        {result ? '다시 확인하기' : '급여 확인 시작하기'}
        <ArrowRight aria-hidden="true" />
      </Link>
    </article>
  );
}

function TaxStatusCard({
  result,
}: {
  result: SavedTaxCheckResult | undefined;
}) {
  const needsReview = result ? taxReviewCount(result) : 0;
  const checkedCount = result
    ? Math.max(result.totalCount - needsReview, 0)
    : 0;

  return (
    <Link href="/taxcheck" className={styles.miniCard}>
      <div className={styles.miniTop}>
        <span className={`${styles.cardIcon} ${styles.taxIcon}`}>
          <Receipt aria-hidden="true" />
        </span>
        <span
          className={`${styles.statusDot} ${
            !result
              ? styles.dotNeutral
              : needsReview === 0
                ? styles.dotOk
                : styles.dotNeed
          }`}
        />
      </div>
      <h3>TaxCheck</h3>
      <p>
        {result
          ? `${result.totalCount}개 항목 확인 · ${needsReview}개 추가 확인`
          : '아직 세금 항목을 확인하지 않았어요.'}
      </p>
      {result ? (
        <div className={styles.progressArea}>
          <progress
            max={Math.max(result.totalCount, 1)}
            value={checkedCount}
            aria-label={`TaxCheck ${checkedCount}개 확인 완료`}
          />
          <small>
            {checkedCount}/{result.totalCount} 확인 완료
          </small>
        </div>
      ) : null}
      <strong>
        {result ? '다시 확인하기' : '세금 확인 시작하기'}
        <ChevronRight aria-hidden="true" />
      </strong>
    </Link>
  );
}

function ExitStatusCard({
  result,
}: {
  result: SavedExitCheckResult | undefined;
}) {
  return (
    <Link href="/exitcheck" className={styles.miniCard}>
      <div className={styles.miniTop}>
        <span className={`${styles.cardIcon} ${styles.exitIcon}`}>
          <Plane aria-hidden="true" />
        </span>
        <span
          className={`${styles.statusDot} ${
            result && result.readyCount === result.totalCount
              ? styles.dotOk
              : styles.dotNeutral
          }`}
        />
      </div>
      <h3>ExitCheck</h3>
      <p>
        {result
          ? `${result.totalCount}개 중 ${result.readyCount}개 준비 완료`
          : '출국일이 정해지면 준비 항목을 확인해요.'}
      </p>
      {result ? (
        <div className={styles.progressArea}>
          <progress
            max={Math.max(result.totalCount, 1)}
            value={result.readyCount}
            aria-label={`ExitCheck ${result.readyCount}개 준비 완료`}
          />
          <small>
            {result.readyCount}/{result.totalCount} 준비 완료
          </small>
        </div>
      ) : null}
      <strong>
        {result ? '다시 확인하기' : '출국 확인 시작하기'}
        <ChevronRight aria-hidden="true" />
      </strong>
    </Link>
  );
}

function RecentResult({ result }: { result: SavedResult }) {
  const meta = KIND_META[result.kind];
  const Icon = meta.icon;
  const needsReview = resultNeedsReview(result);
  const ResultStatusIcon = needsReview ? CircleAlert : CheckCircle2;

  return (
    <li>
      <span className={`${styles.recentIcon} ${styles[meta.className]}`}>
        <Icon aria-hidden="true" />
      </span>
      <div>
        <p>
          {meta.label} 확인
          <small>{formatShortDate(result.createdAt)}</small>
        </p>
        <strong>{recentSummary(result)}</strong>
      </div>
      <ResultStatusIcon
        className={needsReview ? styles.recentWarning : undefined}
        aria-hidden="true"
      />
    </li>
  );
}

function DashboardSkeleton() {
  return (
    <output className={styles.skeleton}>
      <span className={styles.screenReaderOnly}>대시보드 불러오는 중</span>
      <span className={styles.skeletonHero} aria-hidden="true" />
      <span className={styles.skeletonCard} aria-hidden="true" />
      <span className={styles.skeletonCard} aria-hidden="true" />
    </output>
  );
}

function taxReviewCount(result: SavedTaxCheckResult) {
  const unknownCount =
    result.unknownCount ??
    result.cards?.filter((card) => card.status === '현재 정보로 판단 불가')
      .length ??
    0;
  return result.needsActionCount + unknownCount;
}

function payStatus(status: string | undefined) {
  switch (status) {
    case 'MATCH':
      return { label: '일치', tone: 'statusOk' } as const;
    case 'EXPLANATION_REQUIRED':
      return { label: '확인 필요', tone: 'statusNeed' } as const;
    case 'INSUFFICIENT_DATA':
      return { label: '자료 부족', tone: 'statusNeed' } as const;
    case 'USER_CONFIRMATION':
      return { label: '확인 대기', tone: 'statusNeutral' } as const;
    default:
      return { label: '확인 전', tone: 'statusNeutral' } as const;
  }
}

function recentSummary(result: SavedResult) {
  switch (result.kind) {
    case 'pay':
      return `${result.payPeriod || '기간 미확인'} · ${
        result.workplace || '근무지 미입력'
      }`;
    case 'tax':
      return `${result.year}년 · ${result.totalCount}개 중 ${taxReviewCount(
        result,
      )}개 추가 확인`;
    case 'exit':
      return `${result.totalCount}개 중 ${result.readyCount}개 준비 완료`;
  }
}

function resultNeedsReview(result: SavedResult) {
  switch (result.kind) {
    case 'pay':
      return result.status !== 'MATCH';
    case 'tax':
      return taxReviewCount(result) > 0;
    case 'exit':
      return result.readyCount < result.totalCount;
  }
}

function formatShortDate(iso: string) {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return '날짜 미확인';
  return parsed.toLocaleDateString('ko-KR', {
    month: 'short',
    day: 'numeric',
  });
}
