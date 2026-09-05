import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "ExitCheck · 출국 전 금융권리 정산",
  description: "출국 전 수령해야 할 퇴직보험금과 국민연금 반환일시금을 단계별로 점검합니다.",
  openGraph: {
    title: "ExitCheck · Foreign-One",
    description: "Foreign-One: Your financial hole-in-Won - 출국 전 수령해야 할 퇴직보험금과 국민연금 반환일시금을 점검합니다.",
    images: [
      {
        url: "/logo2.svg",
        width: 1774,
        height: 887,
        alt: "Foreign-One",
      },
    ],
    type: "website",
  },
};

export default function ExitCheckLayout({ children }: { children: ReactNode }) {
  return children;
}
