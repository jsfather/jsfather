import Link from 'next/link';
import { Plus } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { courseSummaries, pageNumber } from '@/lib/data';
import { PageTitle, CourseCard, Empty, Pagination } from '@/components/ui';
export const metadata = { title: 'My courses' };
export default async function Courses({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireUser();
  const page = pageNumber((await searchParams).page);
  const list = await courseSummaries(user.id, page);
  return (
    <>
      <PageTitle
        eyebrow="YOUR SYLLABUS"
        title="My courses"
        description="The skills you’re building. The path you’ve chosen."
        action={
          <Link className="button primary" href="/courses/new">
            <Plus size={17} />
            Create course
          </Link>
        }
      />
      {list.length ? (
        <>
          <div className="course-grid full">
            {list.map((row) => (
              <CourseCard key={row.course.id} {...row} timezone={user.timezone} />
            ))}
          </div>
          <Pagination page={page} hasMore={list.length === 12} base="/courses" />
        </>
      ) : (
        <Empty
          title={page > 1 ? 'No more courses.' : 'A blank syllabus. Endless possibilities.'}
          description="Create a course around a skill you want to develop. Choose the sessions and schedule that fit your life."
          href={page > 1 ? '/courses' : '/courses/new'}
          label={page > 1 ? 'Back to courses' : 'Create your first course'}
        />
      )}
    </>
  );
}
