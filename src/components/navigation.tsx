'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useSyncExternalStore } from 'react';
import {
  LayoutDashboard,
  BookOpen,
  CalendarDays,
  ClipboardList,
  Award,
  UserRound,
  Settings,
  GraduationCap,
  Sun,
  Moon,
  Menu,
  X,
  LogOut,
  PanelLeftClose,
} from 'lucide-react';
import { Brand } from './brand';
import { Avatar } from './avatar';
import { logout } from '@/actions';
const nav = [
  { href: '/dashboard', name: 'Overview', icon: LayoutDashboard },
  { href: '/courses', name: 'My courses', icon: BookOpen },
  { href: '/calendar', name: 'Timetable', icon: CalendarDays },
  { href: '/exams', name: 'Exams', icon: ClipboardList },
  { href: '/certificates', name: 'Certificates', icon: Award },
];
export { Brand } from './brand';
function subscribeTheme(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener('jsfather-theme', callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener('jsfather-theme', callback);
  };
}
function themeSnapshot() {
  try {
    return localStorage.getItem('jsfather-theme') === 'light';
  } catch {
    return false;
  }
}
export function ThemeToggle() {
  const light = useSyncExternalStore(subscribeTheme, themeSnapshot, () => false);
  useEffect(() => {
    document.documentElement.dataset.theme = light ? 'light' : 'dark';
  }, [light]);
  return (
    <button
      className="icon-button"
      aria-label={light ? 'Switch to dark mode' : 'Switch to light mode'}
      onClick={() => {
        try {
          localStorage.setItem('jsfather-theme', light ? 'dark' : 'light');
        } catch {}
        window.dispatchEvent(new Event('jsfather-theme'));
      }}
    >
      {light ? <Moon size={18} /> : <Sun size={18} />}
    </button>
  );
}
export function Sidebar({
  name,
  username,
  image,
}: {
  name: string;
  username: string;
  image?: string | null;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="mobile-menu icon-button"
        onClick={() => setOpen(!open)}
        aria-label="Toggle navigation"
      >
        {open ? <X /> : <Menu />}
      </button>
      {open && (
        <button
          className="sidebar-backdrop"
          onClick={() => setOpen(false)}
          aria-label="Close navigation"
        />
      )}
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <Brand />
        <div className="workspace-label">
          <span className="workspace-monogram">{name.slice(0, 1).toUpperCase()}</span>
          <div>
            <strong>My university</strong>
            <span>Personal workspace</span>
          </div>
          <PanelLeftClose size={16} />
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {nav.map(({ href, name, icon: Icon }) => (
            <Link
              onClick={() => setOpen(false)}
              href={href}
              key={href}
              className={`nav-item ${path.startsWith(href) ? 'active' : ''}`}
            >
              <Icon size={19} />
              {name}
              {path.startsWith(href) && <span className="nav-active-dot" />}
            </Link>
          ))}
        </nav>
        <div className="nav-label account-label">ACCOUNT</div>
        <nav>
          {[
            { href: '/profile', name: 'My profile', icon: UserRound },
            { href: '/settings', name: 'Settings', icon: Settings },
          ].map(({ href, name, icon: Icon }) => (
            <Link
              onClick={() => setOpen(false)}
              key={href}
              href={href}
              className={`nav-item ${path.startsWith(href) ? 'active' : ''}`}
            >
              <Icon size={19} />
              {name}
            </Link>
          ))}
        </nav>
        <div className="sidebar-note">
          <GraduationCap size={21} />
          <strong>Your future, on the syllabus.</strong>
          <p>A little progress, every day.</p>
          <Link href="/courses/new">
            Add your next course <span>+</span>
          </Link>
        </div>
        <div className="sidebar-footer">
          <Avatar name={name} image={image} />
          <div>
            <strong>{name}</strong>
            <span>@{username}</span>
          </div>
          <form action={logout}>
            <button className="icon-button" aria-label="Sign out">
              <LogOut size={17} />
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
export function Breadcrumb() {
  const path = usePathname();
  const section = path.split('/')[1];
  const title =
    (
      {
        dashboard: 'Overview',
        courses: 'My courses',
        calendar: 'Timetable',
        exams: 'Exams',
        certificates: 'Certificates',
        settings: 'Settings',
        profile: 'My profile',
        sessions: 'Session details',
      } as Record<string, string>
    )[section] ?? 'University';
  return (
    <div className="breadcrumb">
      <GraduationCap size={16} />
      <span>My university</span>
      <span className="breadcrumb-slash">/</span>
      <strong>{title}</strong>
    </div>
  );
}
