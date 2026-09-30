import Link from 'next/link';
import { BookOpen, ArrowUpRight, CalendarDays, Plus, Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { formatInTimeZone } from 'date-fns-tz';
import type { Course, CourseSession } from '@/db/schema';
export function Badge({ children, color = 'neutral' }: { children: ReactNode; color?: string }) {
  return <span className={`badge badge-${color}`}>{children}</span>;
}
export function Progress({ value, color = 'teal' }: { value: number; color?: string }) {
  return (
    <div
      className={`progress progress-${color}`}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Learning progress"
    >
      <div style={{ width: `${value}%` }} />
    </div>
  );
}
export function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
export function Empty({
  title,
  description,
  href,
  label,
}: {
  title: string;
  description: string;
  href?: string;
  label?: string;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <BookOpen size={26} />
      </div>
      <h3>{title}</h3>
      <p className="muted">{description}</p>
      {href && (
        <Link className="button primary" href={href}>
          <Plus size={16} />
          {label ?? 'Create a course'}
        </Link>
      )}
    </div>
  );
}
export function CourseCard({
  course,
  total,
  completed,
  nextDate,
  href,
  showProgress = true,
  timezone,
  examStatus,
}: {
  course:
    | Course
    | Pick<Course, 'id' | 'title' | 'category' | 'difficulty' | 'color' | 'status' | 'description'>;
  total: number;
  completed: number;
  nextDate?: Date | string | null;
  href?: string;
  showProgress?: boolean;
  timezone?: string;
  examStatus?: string;
}) {
  const percentage = total ? Math.round((completed / total) * 100) : 0;
  return (
    <Link href={href ?? '/courses/' + course.id} className={`course-card color-${course.color}`}>
      <div className="course-top">
        <div className="course-icon">
          <BookOpen size={22} />
        </div>
        <Badge color={course.color}>{course.category}</Badge>
        <ArrowUpRight size={18} className="card-arrow" />
      </div>
      <h3>{course.title}</h3>
      <p className="course-desc">
        {course.description || 'A new chapter in your personal university.'}
      </p>
      {showProgress && (
        <>
          <div className="progress-label">
            <span>
              {completed} of {total} sessions
            </span>
            <strong>{percentage}%</strong>
          </div>
          <Progress value={percentage} color={course.color} />
        </>
      )}
      <div className="course-bottom">
        <span>{examStatus || course.difficulty}</span>
        <span>
          {nextDate ? (
            <>
              <CalendarDays size={13} />{' '}
              {formatInTimeZone(new Date(nextDate), timezone ?? 'Asia/Tehran', 'MMM d, HH:mm')}
            </>
          ) : course.status === 'archived' ? (
            'Archived'
          ) : percentage === 100 ? (
            'Completed'
          ) : (
            'At your own pace'
          )}
        </span>
      </div>
    </Link>
  );
}
export function SessionRow({
  session,
  course,
  timezone,
}: {
  session: CourseSession;
  course: Course;
  timezone: string;
}) {
  const overdue =
    new Date(session.scheduledDate) < new Date() &&
    ['upcoming', 'in_progress'].includes(session.status);
  return (
    <Link className={`session-row color-${course.color}`} href={'/sessions/' + session.id}>
      <div className="session-date">
        <strong>{formatInTimeZone(session.scheduledDate, timezone, 'HH:mm')}</strong>
        <span>{formatInTimeZone(session.scheduledDate, timezone, 'MMM d')}</span>
      </div>
      <div className="session-marker" />
      <div className="session-info">
        <h4>{course.title}</h4>
        <span>
          Session {String(session.sessionNumber).padStart(2, '0')} · {session.title} ·{' '}
          {session.duration} min
        </span>
      </div>
      <Badge color={session.status === 'completed' ? 'teal' : overdue ? 'amber' : 'neutral'}>
        {session.status === 'completed' ? (
          <>
            <Check size={12} /> Completed
          </>
        ) : overdue ? (
          'Overdue'
        ) : (
          session.status.replace('_', ' ')
        )}
      </Badge>
      <ArrowUpRight size={16} className="muted" />
    </Link>
  );
}
export function Pagination({
  page,
  hasMore,
  base,
}: {
  page: number;
  hasMore: boolean;
  base: string;
}) {
  return (
    <div className="pagination">
      {page > 1 && (
        <Link
          className="button secondary"
          href={`${base}${base.includes('?') ? '&' : '?'}page=${page - 1}`}
        >
          Previous
        </Link>
      )}
      <span className="muted">Page {page}</span>
      {hasMore && (
        <Link
          className="button secondary"
          href={`${base}${base.includes('?') ? '&' : '?'}page=${page + 1}`}
        >
          Next
        </Link>
      )}
    </div>
  );
}
