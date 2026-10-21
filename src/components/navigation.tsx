'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useSyncExternalStore, useRef } from 'react';
import {
  LayoutDashboard,
  NotebookPen,
  BookOpen,
  CalendarDays,
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
  Flame,
} from 'lucide-react';
import { Brand, UniversityName } from './brand';
import { Avatar } from './avatar';
import { logout } from '@/actions';
const nav = [
  { href: '/dashboard', name: 'Overview', icon: LayoutDashboard },
  { href: '/courses', name: 'My courses', icon: BookOpen },
  { href: '/notes', name: 'Study notes', icon: NotebookPen },
  { href: '/activity', name: 'Practice history', icon: Flame },
  { href: '/calendar', name: 'Timetable', icon: CalendarDays },
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
  const drawer = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 760px)');
    const closeOnResize = () => {
      drawer.current?.toggleAttribute('inert', media.matches && !open);
      if (!media.matches) setOpen(false);
    };
    media.addEventListener('change', closeOnResize);
    if (!open) {
      drawer.current?.toggleAttribute('inert', media.matches);
    }
    if (!open) return () => media.removeEventListener('change', closeOnResize);
    drawer.current?.removeAttribute('inert');
    const main = document.querySelector<HTMLElement>('.app-main');
    main?.setAttribute('inert', '');
    const triggerButton = trigger.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusable = () =>
      Array.from(
        drawer.current?.querySelectorAll<HTMLElement>('a[href], button, input') ?? [],
      ).filter((el) => !el.hasAttribute('disabled') && el.getClientRects().length);
    focusable()[0]?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
      if (event.key === 'Tab') {
        const items = focusable();
        const first = items[0],
          last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      main?.removeAttribute('inert');
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKey);
      media.removeEventListener('change', closeOnResize);
      triggerButton?.focus();
    };
  }, [open]);
  return (
    <>
      <header className="mobile-header">
        <button
          ref={trigger}
          className="mobile-menu icon-button"
          onClick={() => setOpen(!open)}
          aria-label="Toggle navigation"
          aria-expanded={open}
          aria-controls="university-navigation"
        >
          <Menu />
        </button>
        <Breadcrumb />
        <ThemeToggle />
      </header>
      {open && (
        <button
          className="sidebar-backdrop"
          onClick={() => setOpen(false)}
          aria-label="Close navigation"
        />
      )}
      <aside
        ref={drawer}
        id="university-navigation"
        className={`sidebar ${open ? 'open' : ''}`}
        aria-label="University navigation"
        role={open ? 'dialog' : undefined}
        aria-modal={open || undefined}
      >
        <button
          className="drawer-close icon-button"
          onClick={() => setOpen(false)}
          aria-label="Close menu"
        >
          <X />
        </button>
        <Brand />
        <div className="workspace-label">
          <span className="workspace-monogram">{name.slice(0, 1).toUpperCase()}</span>
          <div>
            <strong>
              <UniversityName />
            </strong>
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
          <Link href="/courses/new" onClick={() => setOpen(false)}>
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
        categories: 'Category questions & exams',
        certificates: 'Certificates',
        settings: 'Settings',
        profile: 'My profile',
        sessions: 'Session details',
        notes: 'Study notes',
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
