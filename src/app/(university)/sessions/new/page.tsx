import { db } from '@/db';
import { courseChapters } from '@/db/schema';
import { asc, eq } from 'drizzle-orm';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { ownedCourse } from '@/lib/data';
import { PageTitle } from '@/components/ui';
import { SessionForm } from '@/components/forms';
export const metadata = { title: 'Add session' };
export default async function NewSession({
  searchParams,
}: {
  searchParams: Promise<{ course?: string; chapter?: string }>;
}) {
  const user = await requireUser();
  const { course: courseId, chapter } = await searchParams;
  if (!courseId) notFound();
  const course = await ownedCourse(user.id, courseId);
  if (course.kind === 'book') redirect('/courses/' + course.id);
  const chapters = await db
    .select()
    .from(courseChapters)
    .where(eq(courseChapters.courseId, course.id))
    .orderBy(asc(courseChapters.position));
  return (
    <>
      <Link className="text-link" href={'/courses/' + course.id}>
        {course.title}
      </Link>
      <PageTitle title="Add session" description="Choose a date and time for your new session." />
      <SessionForm course={course} chapters={chapters} chapterId={chapter} />
    </>
  );
}
