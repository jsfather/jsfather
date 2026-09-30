import { Avatar } from '@/components/avatar';
import { publicUser, courseSummaries, universityStats, pageNumber } from '@/lib/data';
import { canSeeProgress, canSeeScores } from '@/lib/learning';
import { PageTitle, CourseCard, Pagination } from '@/components/ui';
import { format } from 'date-fns';
import { db } from '@/db';
import { certificates, courses } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
export async function generateMetadata({ params }: { params: Promise<{ username: string }> }) {
  const user = await publicUser((await params).username);
  return {
    title: user.name ?? user.username,
    description:
      user.bio ||
      `${user.name ?? user.username}’s learning journey at jsfather Personal University.`,
  };
}
export default async function PublicProfile({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await publicUser((await params).username);
  const page = pageNumber((await searchParams).page);
  const list = user.showCourses ? await courseSummaries(user.id, page, true) : [];
  const stats = canSeeProgress(user) ? await universityStats(user.id, true) : null;
  const scoreVisible = canSeeScores(user);
  let earned = 0;
  if (scoreVisible) {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(certificates)
      .innerJoin(courses, eq(certificates.courseId, courses.id))
      .where(and(eq(certificates.userId, user.id), eq(courses.isPublic, true)));
    earned = row.count;
  }
  return (
    <>
      <div className="profile-header">
        <Avatar large name={user.name ?? user.username} image={user.image} />
        <div>
          <div className="eyebrow">PERSONAL UNIVERSITY</div>
          <h1>{user.name ?? user.username}</h1>
          <p className="muted">
            @{user.username} · Joined {format(user.createdAt, 'MMMM yyyy')}
          </p>
        </div>
      </div>
      {user.bio && <p className="profile-bio">{user.bio}</p>}
      <div className="profile-links">
        {user.location && <span className="muted">{user.location}</span>}
        {user.website && (
          <a href={user.website} rel="noopener noreferrer" target="_blank">
            Website
          </a>
        )}
        {user.githubUrl && (
          <a href={user.githubUrl} rel="noopener noreferrer" target="_blank">
            GitHub
          </a>
        )}
        {user.linkedinUrl && (
          <a href={user.linkedinUrl} rel="noopener noreferrer" target="_blank">
            LinkedIn
          </a>
        )}
      </div>
      {stats && (
        <>
          <PageTitle title="Learning progress" />
          <div className="stats-grid">
            {[
              { label: 'Public courses', value: stats.courses },
              { label: 'Completed courses', value: stats.completedCourses },
              { label: 'Total sessions', value: stats.total },
              { label: 'Completed sessions', value: stats.completed },
              ...(scoreVisible
                ? [
                    { label: 'Exams passed', value: stats.passedExams },
                    { label: 'Average score', value: `${stats.averageScore}%` },
                    { label: 'Certificates earned', value: earned },
                  ]
                : []),
            ].map(({ label, value }) => (
              <div className="stat-card" key={label}>
                <div className="stat-label">{label}</div>
                <div className="stat-value">
                  <strong>{value}</strong>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      {user.showCourses && (
        <>
          <PageTitle title="Public courses" />
          {list.length ? (
            <>
              <div className="course-grid full">
                {list.map((row) => (
                  <CourseCard
                    key={row.course.id}
                    course={row.course}
                    total={row.total}
                    completed={stats ? row.completed : 0}
                    showProgress={!!stats}
                    href={`/u/${user.username}/courses/${row.course.slug}`}
                  />
                ))}
              </div>
              <Pagination page={page} hasMore={list.length === 12} base={'/u/' + user.username} />
            </>
          ) : (
            <p className="muted">No public courses to share yet.</p>
          )}
        </>
      )}
    </>
  );
}
