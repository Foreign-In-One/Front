import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: '내 확인 기록 · PayCycle AI',
  description:
    '저장된 급여 확인, 연말정산 확인, 출국 정산 결과를 한 곳에서 다시 확인합니다.',
  openGraph: {
    title: '내 확인 기록 · PayCycle AI',
    description: '지금까지 확인한 급여·세금·출국 결과를 확인합니다.',
    type: 'website',
  },
};

export default function RecordsLayout({ children }: { children: ReactNode }) {
  return children;
}
