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
  searchParams: Promise<{ course?: string }>;
}) {
  const user = await requireUser();
  const { course: courseId } = await searchParams;
  if (!courseId) notFound();
  const course = await ownedCourse(user.id, courseId);
  if (course.kind === 'book') redirect('/courses/' + course.id);
  return (
    <>
      <Link className="text-link" href={'/courses/' + course.id}>
        {course.title}
      </Link>
      <PageTitle title="Add session" description="Choose a date and time for your new session." />
      <SessionForm course={course} />
    </>
  );
}
