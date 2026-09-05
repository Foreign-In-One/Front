import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Foreign-One: Your financial hole-in-Won',
  description:
    'Foreign-One: Your financial hole-in-Won - 올해 누적 급여와 급여·세금·출국 확인 상태, 최근 분석 기록을 한 화면에서 확인합니다.',
  openGraph: {
    title: 'Foreign-One: Your financial hole-in-Won',
    description: 'Foreign-One: Your financial hole-in-Won - 급여·세금·출국 정산 상태를 한 화면에서 확인하세요.',
    images: [
      {
        url: '/logo2.svg',
        width: 1774,
        height: 887,
        alt: 'Foreign-One',
      },
    ],
    type: 'website',
  },
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return children;
}
