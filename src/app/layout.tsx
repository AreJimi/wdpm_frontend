import type { Metadata, Viewport } from 'next';
import './globals.css';
import { LocaleProvider } from '@/components/LocaleProvider';

export const metadata: Metadata = {
  title: 'We Don\u2019t Pay Much \u2014 Iranian bank transfer fee calculator',
  description:
    'Calculate Shetabi, Paya and Satna transfer fees instantly. Up-to-date official fee rules, Rial & Toman, English & Persian.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#4f46e5',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}
