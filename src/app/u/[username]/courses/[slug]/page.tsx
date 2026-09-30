import Link from 'next/link';
import { publicCourse } from '@/lib/data';
import { PageTitle, Badge, Progress } from '@/components/ui';
export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string; slug: string }>;
}) {
  const { username, slug } = await params;
  const { course } = await publicCourse(username, slug);
  return {
    title: course.title,
    description:
      course.description.slice(0, 160) ||
      `A personal course in ${course.category} at jsfather Personal University.`,
  };
}
export default async function PublicCoursePage({
  params,
}: {
  params: Promise<{ username: string; slug: string }>;
}) {
  const { username, slug } = await params;
  const { user, course, progress, bestScore, certificateId } = await publicCourse(username, slug);
  return (
    <>
      <Link className="text-link" href={'/u/' + username} style={{ marginBottom: 25 }}>
        {user.name ?? user.username}’s university
      </Link>
      <PageTitle
        eyebrow={course.category.toUpperCase()}
        title={course.title}
        action={<Badge color={course.color}>{course.difficulty}</Badge>}
      />
      <section className="panel">
        <p className="detail-description">{course.description}</p>
        <p className="muted" style={{ marginBottom: 24 }}>
          {course.totalSessions} scheduled sessions
        </p>
        {progress && (
          <>
            <div className="progress-label">
              <span>
                {progress.completed} / {progress.total} sessions completed
              </span>
              <strong>{progress.percentage}%</strong>
            </div>
            <Progress value={progress.percentage} color={course.color} />
          </>
        )}
        {bestScore !== null && (
          <p style={{ marginTop: 25 }}>
            Best exam score: <strong>{bestScore}%</strong>
          </p>
        )}
        {certificateId && (
          <Link
            className="button secondary"
            style={{ marginTop: 25 }}
            href={`/u/${username}/certificates/${certificateId}`}
          >
            View achievement certificate
          </Link>
        )}
      </section>
    </>
  );
}
