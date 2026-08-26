import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: '내 금융권리 대시보드 · PayCycle AI',
  description:
    '올해 누적 급여와 급여·세금·출국 확인 상태, 최근 분석 기록을 한 화면에서 확인합니다.',
  openGraph: {
    title: '내 금융권리 대시보드 · PayCycle AI',
    description: '급여·세금·출국 정산 상태를 한 화면에서 확인하세요.',
    type: 'website',
  },
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return children;
}
