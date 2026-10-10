import Link from 'next/link';
import { VocabularyCourseForm } from '@/components/vocabulary-forms';
import { requireUser } from '@/lib/auth';
import { PageTitle } from '@/components/ui';
import { CourseForm } from '@/components/forms';
import { formatInTimeZone } from 'date-fns-tz';
export const metadata = { title: 'Create a course' };
export default async function NewCourse({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const vocabulary = (await searchParams).kind === 'vocabulary';
  const user = await requireUser();
  return (
    <>
      <PageTitle
        eyebrow="A NEW CHAPTER"
        title="Create a course"
        description="Decide what to learn. Give it a time and a place."
      />
      <div className="actions-row" style={{ marginBottom: 24 }}>
        <Link className={`button ${vocabulary ? 'secondary' : 'primary'}`} href="/courses/new">
          Scheduled course
        </Link>
        <Link
          className={`button ${vocabulary ? 'primary' : 'secondary'}`}
          href="/courses/new?kind=vocabulary"
        >
          Language vocabulary
        </Link>
      </div>
      {vocabulary ? (
        <VocabularyCourseForm timezone={user.timezone} />
      ) : (
        <CourseForm
          timezone={user.timezone}
          today={formatInTimeZone(new Date(), user.timezone, 'yyyy-MM-dd')}
        />
      )}
    </>
  );
}
