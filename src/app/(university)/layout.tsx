import { UniversityName } from '@/components/brand';
import { requireUser } from '@/lib/auth';
import { Avatar } from '@/components/avatar';
import { Sidebar, Breadcrumb, ThemeToggle } from '@/components/navigation';
import { formatInTimeZone } from 'date-fns-tz';
export const dynamic = 'force-dynamic';
export const metadata = { robots: { index: false, follow: false } };
export default async function UniversityLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <>
      <Sidebar name={user.name ?? user.username} username={user.username} image={user.image} />
      <div className="app-main">
        <header className="topbar">
          <Breadcrumb />
          <div className="topbar-right">
            <span className="topbar-date">
              {formatInTimeZone(new Date(), user.timezone, 'EEEE, MMMM d, yyyy')}
            </span>
            <ThemeToggle />
            <LinkAvatar name={user.name ?? user.username} image={user.image} />
          </div>
        </header>
        <main className="content">
          {children}
          <footer className="app-footer">
            <span>
              © {new Date().getFullYear()} <UniversityName /> Personal University
            </span>
            <span>One session closer to who you want to be.</span>
          </footer>
        </main>
      </div>
    </>
  );
}
function LinkAvatar({ name, image }: { name: string; image?: string | null }) {
  return (
    <a className="avatar" href="/profile" aria-label="Your profile">
      <Avatar name={name} image={image} />
    </a>
  );
}
