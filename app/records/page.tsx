'use client';

import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FileSearch,
  History,
  Home,
  Plane,
  Receipt,
  ShieldCheck,
  Trash2,
  UserRound,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  listSavedResults,
  type ResultKind,
  removeSavedResult,
  type SavedResult,
} from '../../lib/paycycle/result-storage';
import { formatWon } from '../../lib/paycycle/taxcheck';
import styles from './page.module.css';

type FilterKind = ResultKind | 'all';

const TABS: { key: FilterKind; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'pay', label: '급여' },
  { key: 'tax', label: '세금' },
  { key: 'exit', label: '출국' },
];

const NAV_ITEMS = [
  { href: '/dashboard', label: '홈', icon: Home },
  { href: '/calendar', label: '캘린더', icon: CalendarClock },
  { href: '/paycheck', label: '급여', icon: Wallet },
  { href: '/taxcheck', label: '세금', icon: Receipt },
  { href: '/exitcheck', label: '출국', icon: Plane },
] as const;

const KIND_META = {
  pay: { label: '급여 확인', icon: Wallet, target: '/paycheck' },
  tax: { label: '세금 확인', icon: Receipt, target: '/taxcheck' },
  exit: { label: '출국 정산', icon: Plane, target: '/exitcheck' },
} as const;

export default function RecordsPage() {
  const [filter, setFilter] = useState<FilterKind>('all');
  const [results, setResults] = useState<SavedResult[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setResults(listSavedResults());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const counts = useMemo(
    () => ({
      all: results.length,
      pay: results.filter((result) => result.kind === 'pay').length,
      tax: results.filter((result) => result.kind === 'tax').length,
      exit: results.filter((result) => result.kind === 'exit').length,
    }),
    [results],
  );

  const visibleResults = useMemo(
    () =>
      filter === 'all'
        ? results
        : results.filter((result) => result.kind === filter),
    [filter, results],
  );

  const handleDelete = (result: SavedResult) => {
    const confirmed = window.confirm(
      `${KIND_META[result.kind].label} 기록을 삭제할까요?`,
    );
    if (!confirmed) return;

    if (!removeSavedResult(result.id)) {
      setToast('기록을 삭제하지 못했어요. 다시 시도해 주세요.');
      return;
    }

    setResults((current) => current.filter((saved) => saved.id !== result.id));
    setToast('확인 기록을 삭제했어요.');
  };

  return (
    <div className={styles.app}>
      <header className={styles.appHeader}>
        <div className={styles.headerInner}>
          <Link
            href="/dashboard"
            className={styles.backLink}
            aria-label="대시보드로 이동"
          >
            <ArrowLeft aria-hidden="true" />
          </Link>

          <div className={styles.headingArea}>
            <p className={styles.eyebrow}>PayCycle AI</p>
            <h1>내 확인 기록</h1>
            <p>지금까지 확인한 급여·세금·출국 결과를 다시 확인해요.</p>
          </div>

          <Link
            href="/profile"
            className={styles.profileLink}
            aria-label="내 프로필 보기"
          >
            <UserRound aria-hidden="true" />
          </Link>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.summaryPanel} aria-label="확인 기록 요약">
          <div className={styles.summaryIcon}>
            <History aria-hidden="true" />
          </div>
          <div>
            <span>저장된 전체 기록</span>
            <strong>{hydrated ? `${counts.all}건` : '확인 중'}</strong>
            <p>분석 결과는 현재 브라우저에 안전하게 보관돼요.</p>
          </div>
        </section>

        <div className={styles.tabs} role="tablist" aria-label="기록 종류">
          {TABS.map((tab) => {
            const active = filter === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={active}
                className={active ? styles.tabActive : undefined}
                onClick={() => setFilter(tab.key)}
              >
                <span>{tab.label}</span>
                <small>{counts[tab.key]}</small>
              </button>
            );
          })}
        </div>

        <section
          className={styles.recordsSection}
          aria-live="polite"
          aria-busy={!hydrated}
        >
          <div className={styles.sectionHeading}>
            <div>
              <h2>{TABS.find((tab) => tab.key === filter)?.label} 기록</h2>
              <p>최근에 확인한 결과부터 보여드려요.</p>
            </div>
            <span>{visibleResults.length}건</span>
          </div>

          {!hydrated ? (
            <RecordSkeleton />
          ) : visibleResults.length === 0 ? (
            <EmptyState filter={filter} />
          ) : (
            <ul className={styles.recordList}>
              {visibleResults.map((result) => (
                <RecordCard
                  key={result.id}
                  result={result}
                  onDelete={handleDelete}
                />
              ))}
            </ul>
          )}
        </section>

        <p className={styles.privacyNote}>
          <ShieldCheck aria-hidden="true" />
          현재 기록은 이 브라우저에만 저장되며 서버로 전송되지 않습니다.
        </p>
      </main>

      <nav className={styles.bottomNav} aria-label="주요 메뉴">
        <ul>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link href={item.href}>
                  <Icon aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {toast && (
        <output className={styles.toast}>
          <CheckCircle2 aria-hidden="true" />
          {toast}
        </output>
      )}
    </div>
  );
}

function RecordCard({
  result,
  onDelete,
}: {
  result: SavedResult;
  onDelete: (result: SavedResult) => void;
}) {
  const meta = KIND_META[result.kind];
  const Icon = meta.icon;

  return (
    <li className={styles.recordCard}>
      <div className={styles.recordTop}>
        <span className={`${styles.kindIcon} ${styles[result.kind]}`}>
          <Icon aria-hidden="true" />
        </span>

        <div className={styles.recordTitle}>
          <p>
            {meta.label}
            <span>{resultKindLabel(result)}</span>
          </p>
          <h3>{resultHeadline(result)}</h3>
        </div>

        <button
          type="button"
          className={styles.deleteButton}
          onClick={() => onDelete(result)}
          aria-label={`${meta.label} 기록 삭제`}
        >
          <Trash2 aria-hidden="true" />
        </button>
      </div>

      <div className={styles.recordSummary}>{resultSummary(result)}</div>

      {result.kind === 'tax' && result.cards?.length ? (
        <details className={styles.savedDetails}>
          <summary>
            <span>저장된 판정 상세 보기</span>
            <ChevronDown aria-hidden="true" />
          </summary>
          <ul>
            {result.cards.map((card) => (
              <li key={card.id}>
                <div>
                  <strong>{card.title}</strong>
                  <span
                    className={`${styles.ruleStatus} ${ruleStatusClass(card.status)}`}
                  >
                    {card.status}
                  </span>
                </div>
                <p>{card.summary}</p>
                {card.nextActions[0] ? (
                  <small>다음 행동 · {card.nextActions[0]}</small>
                ) : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <div className={styles.recordFooter}>
        <p>
          <Clock3 aria-hidden="true" />
          {formatDate(result.createdAt)} 확인
        </p>
        <Link href={meta.target}>다시 확인하기</Link>
      </div>
    </li>
  );
}

function EmptyState({ filter }: { filter: FilterKind }) {
  const target = filter === 'all' ? '/taxcheck' : KIND_META[filter].target;
  const label =
    filter === 'all' ? '확인 시작하기' : `${KIND_META[filter].label} 시작하기`;

  return (
    <div className={styles.emptyState}>
      <span>
        <FileSearch aria-hidden="true" />
      </span>
      <h3>아직 확인 기록이 없습니다</h3>
      <p>
        급여·세금·출국 확인을 완료하면 이곳에서 결과를 다시 확인할 수 있어요.
      </p>
      <Link href={target}>{label}</Link>
    </div>
  );
}

function RecordSkeleton() {
  return (
    <output className={styles.skeleton}>
      <span className={styles.screenReaderOnly}>확인 기록 불러오는 중</span>
      <span className={styles.skeletonCard} aria-hidden="true" />
      <span className={styles.skeletonCard} aria-hidden="true" />
    </output>
  );
}

function resultKindLabel(result: SavedResult) {
  switch (result.kind) {
    case 'pay':
      return result.payPeriod || '기간 미확인';
    case 'tax':
      return `${result.year}년`;
    case 'exit':
      return result.departureDate || '출국일 미정';
  }
}

function resultHeadline(result: SavedResult) {
  switch (result.kind) {
    case 'pay':
      return result.workplace || '근무지 미입력';
    case 'tax':
      return `${result.totalCount}개 항목 중 ${taxReviewCount(result)}개 추가 확인 필요`;
    case 'exit':
      return `${result.totalCount}개 중 ${result.readyCount}개 준비 완료`;
  }
}

function resultSummary(result: SavedResult) {
  switch (result.kind) {
    case 'pay':
      return (
        <>
          <div>
            <span>실제 입금액</span>
            <strong>
              {result.paidAmount === null
                ? '확인 불가'
                : formatWon(result.paidAmount)}
            </strong>
          </div>
          <div>
            <span>확인된 차이</span>
            <strong>
              {result.differenceAmount === null
                ? '확인 불가'
                : formatWon(result.differenceAmount)}
            </strong>
          </div>
        </>
      );
    case 'tax':
      return (
        <>
          <div>
            <span>확인된 급여</span>
            <strong>{formatWon(result.yearlyPay)}</strong>
          </div>
          <div>
            <span>적용 가능 항목</span>
            <strong>{result.applicableCount}개</strong>
          </div>
          <div>
            <span>추가 확인 필요</span>
            <strong className={styles.needValue}>
              {taxReviewCount(result)}개
            </strong>
          </div>
        </>
      );
    case 'exit':
      return (
        <>
          <div>
            <span>준비 완료</span>
            <strong>{result.readyCount}개</strong>
          </div>
          <div>
            <span>남은 항목</span>
            <strong>
              {Math.max(result.totalCount - result.readyCount, 0)}개
            </strong>
          </div>
        </>
      );
  }
}

function taxReviewCount(result: Extract<SavedResult, { kind: 'tax' }>) {
  const unknownCount =
    result.unknownCount ??
    result.cards?.filter((card) => card.status === '현재 정보로 판단 불가')
      .length ??
    0;
  return result.needsActionCount + unknownCount;
}

function ruleStatusClass(status: string) {
  switch (status) {
    case '적용 가능성 있음':
      return styles.rulePossible;
    case '추가 자료 필요':
      return styles.ruleNeed;
    case '조건 미충족':
      return styles.ruleNot;
    default:
      return styles.ruleUnknown;
  }
}

function formatDate(iso: string) {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return '날짜 미확인';

  return parsed.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
