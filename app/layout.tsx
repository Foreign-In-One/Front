import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import { Toaster } from 'sonner';
import { ThemeToggle } from '@/components/theme-toggle';
import { LocaleProvider } from '@/i18n';
import { THEME_INIT_SCRIPT } from '@/lib/theme';
import { PayCycleProvider } from '@/state/paycycle-context';

const inter = Inter({ subsets: ['latin'] });

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
      <body className={inter.className}>
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        <LocaleProvider>
          <PayCycleProvider>
            {children}
            <ThemeToggle />
            <Toaster position="top-center" richColors />
          </PayCycleProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
