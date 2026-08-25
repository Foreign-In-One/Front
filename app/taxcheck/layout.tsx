import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'TaxCheck · 연말정산 확인 항목',
  description:
    '저장된 급여 기록과 입력 정보를 기준으로 연말정산 확인 항목과 필요한 자료를 단계별로 정리합니다.',
  openGraph: {
    title: 'TaxCheck · 연말정산 확인 항목',
    description: '내 데이터로 연말정산 확인 항목과 필요한 서류를 정리합니다.',
    type: 'website',
  },
};

export default function TaxCheckLayout({ children }: { children: ReactNode }) {
  return children;
}
