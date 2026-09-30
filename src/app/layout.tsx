import type { Metadata } from 'next';
import { UniversityTitle } from '@/components/brand';
import './globals.css';
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://jsfather.ir'),
  title: {
    default: 'jsfather Personal University — Build your own university',
    template: '%s — jsfather Personal University',
  },
  description:
    'Create your own developer courses, schedule classes, track progress, take exams, and earn personal achievement certificates.',
  icons: { icon: '/favicon.svg' },
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <UniversityTitle />
        {children}
      </body>
    </html>
  );
}
