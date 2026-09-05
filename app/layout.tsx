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
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || 'https://paycheck-chi.vercel.app',
  ),
  title: {
    default: 'Foreign-One: Your financial hole-in-Won',
    template: '%s · Foreign-One',
  },
  description:
    'Foreign-One: Your financial hole-in-Won - 외국인 근로자를 위한 급여 3중 대조, 캘린더, 세금 및 정산 올인원 금융권리 케어',
  icons: {
    icon: '/logo2.svg',
    shortcut: '/logo2.svg',
    apple: '/logo2.svg',
  },
  openGraph: {
    title: 'Foreign-One: Your financial hole-in-Won',
    description:
      'Foreign-One: Your financial hole-in-Won - 외국인 근로자를 위한 스마트 금융권리 및 급여·세금·출국 정산 올인원 케어',
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
  twitter: {
    card: 'summary_large_image',
    title: 'Foreign-One: Your financial hole-in-Won',
    description:
      'Foreign-One: Your financial hole-in-Won - 외국인 근로자를 위한 스마트 금융권리 케어',
    images: ['/logo2.svg'],
  },
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
