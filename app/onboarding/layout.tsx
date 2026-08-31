import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: '금융권리 프로필 만들기 · PayCycle AI',
  description:
    '근로 상태, 입국일, 근무 시작일, 급여일, 예상 출국일을 한 화면에 하나씩 입력해 금융권리 프로필을 만듭니다.',
  openGraph: {
    title: '금융권리 프로필 만들기 · PayCycle AI',
    description:
      '근로 상태에 맞춰 필요한 정보만 입력하고 나만의 금융권리 프로필을 만드세요.',
    type: 'website',
  },
};

export default function OnboardingLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
