import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { UniversityBrandProvider, UniversityTitle } from '@/components/brand';
import { universityTitleBootstrap } from '@/lib/university-title-bootstrap';
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
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const [user] = session?.user?.id
    ? await db
        .select({ universityName: users.universityName })
        .from(users)
        .where(eq(users.id, session.user.id))
    : [];
  const bootstrap = user
    ? universityTitleBootstrap.replace(
        "(localStorage.getItem('jsfather-university-name') || '')",
        () => JSON.stringify(user.universityName).replace(/</g, '\\u003c'),
      )
    : universityTitleBootstrap;
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script id="university-title-bootstrap" dangerouslySetInnerHTML={{ __html: bootstrap }} />
      </head>
      <body>
        <UniversityBrandProvider
          key={session?.user?.id ?? 'guest'}
          accountName={user?.universityName ?? null}
        >
          <UniversityTitle />
          {children}
        </UniversityBrandProvider>
      </body>
    </html>
  );
}
