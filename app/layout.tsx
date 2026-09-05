import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';
import { Toaster } from 'sonner';
import { ThemeToggle } from '@/components/theme-toggle';
import { LocaleProvider } from '@/i18n';
import { THEME_INIT_SCRIPT } from '@/lib/theme';
import { PayCycleProvider } from '@/state/paycycle-context';

export const metadata: Metadata = {
  title: 'PayCycle AI · 외국인 근로자 금융권리 Agent',
  description:
    '한국에서 일하는 외국인 근로자를 위한 급여 3중 대조, 캘린더, 프로필 관리 서비스',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body>
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        <LocaleProvider>
          <PayCycleProvider>
            {children}
            <ThemeToggle />
            <Toaster
              position="top-center"
              richColors
              closeButton
              duration={3000}
              offset={{ top: 76 }}
              mobileOffset={{ top: 76 }}
              toastOptions={{
                style: { maxWidth: 'min(92vw, 380px)' },
              }}
            />
          </PayCycleProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
