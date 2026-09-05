'use client';

import { Loader2, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { triggerSalaryMonitoringBatchApi } from '@/services/api';
import { usePayCycle } from '@/state/paycycle-context';

interface DemoSyncButtonProps {
  /** 버튼 스타일 변형: icon (헤더용 아이콘 버튼) 또는 full (텍스트 포함 버튼) */
  variant?: 'icon' | 'button';
  className?: string;
  onSyncComplete?: () => void;
}

/**
 * [PayCycle AI 데모/시뮬레이션 전용 급여 자동 감지(Batch) 실행 및 로딩 컴포넌트]
 *
 * - 기능:
 *   1) `POST /api/batch/salary-monitoring`을 호출하여 백그라운드 급여 스캔 배치를 즉시 트리거
 *   2) 실시간 로딩 애니메이션(스피너 및 펄스)을 표시하여 데모 체감도 향상
 *   3) 완료 후 처리된 건수(processed, created, updated) 안내 및 최신 상태 동기화
 */
export function DemoSyncButton({
  variant = 'icon',
  className = '',
  onSyncComplete,
}: DemoSyncButtonProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const { refreshFromBackend } = usePayCycle();

  const handleSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);

    try {
      // 1. 급여 자동 감지 모니터링 배치 실행 API 호출
      const { result } = await triggerSalaryMonitoringBatchApi();

      // 2. 부드러운 데모 경험을 위한 약간의 시각적 딜레이 (사용자가 로딩 상태 인지)
      await new Promise((r) => setTimeout(r, 500));

      // 3. 최신 Paycheck 및 캘린더 데이터 동기화 조회 및 React 상태 즉시 갱신
      await refreshFromBackend();

      const count = result.processedCount;

      if (count > 0) {
        toast.success(`급여 내역 동기화 완료! (${count}건 확인)`);
      } else {
        toast.info('급여 내역이 이미 최신 상태입니다.');
      }

      // 4. 완료 콜백 실행
      if (onSyncComplete) {
        onSyncComplete();
      }
    } catch (err) {
      console.warn('Salary monitoring batch sync error:', err);
      toast.error(
        '급여 동기화 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
      );
    } finally {
      setIsSyncing(false);
    }
  };

  if (variant === 'button') {
    return (
      <Button
        type="button"
        size="sm"
        disabled={isSyncing}
        onClick={handleSync}
        className={`flex items-center gap-1.5 rounded-2xl font-bold text-xs ${className}`}
      >
        {isSyncing ? (
          <>
            <Loader2 className="size-3.5 animate-spin" />
            <span>급여 감지 중...</span>
          </>
        ) : (
          <>
            <RefreshCw className="size-3.5" />
            <span>급여 내역 동기화</span>
          </>
        )}
      </Button>
    );
  }

  return (
    <button
      type="button"
      disabled={isSyncing}
      onClick={handleSync}
      title="급여 내역 동기화 (배치 즉시 실행)"
      aria-label="급여 내역 동기화"
      className={`relative inline-flex size-8 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-primary disabled:opacity-50 ${className}`}
    >
      {isSyncing ? (
        <Loader2 className="size-4.5 animate-spin text-primary" />
      ) : (
        <RefreshCw className="size-4.5" />
      )}
      {/* 펄스 도트 인디케이터 */}
      {!isSyncing && (
        <span className="absolute -top-0.5 -right-0.5 flex size-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-primary" />
        </span>
      )}
    </button>
  );
}
