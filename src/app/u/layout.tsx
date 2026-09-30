import { UniversityName } from '@/components/brand';
import Link from 'next/link';
import { Brand, ThemeToggle } from '@/components/navigation';
export const dynamic = 'force-dynamic';
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="public-shell">
      <header className="public-header">
        <Brand />
        <div className="actions-row" style={{ margin: 0 }}>
          <ThemeToggle />
          <Link className="button secondary" href="/dashboard">
            My university
          </Link>
        </div>
      </header>
      <main>{children}</main>
      <footer className="public-footer">
        <UniversityName /> Personal University · A place for lifelong learning.
      </footer>
    </div>
  );
}
