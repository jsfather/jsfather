import Link from 'next/link';
import { BookCourseForm } from '@/components/book-forms';
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
  const kind = (await searchParams).kind;
  const vocabulary = kind === 'vocabulary';
  const book = kind === 'book';
  const user = await requireUser();
  return (
    <>
      <PageTitle
        eyebrow="A NEW CHAPTER"
        title="Create a course"
        description="Decide what to learn. Give it a time and a place."
      />
      <div className="actions-row" style={{ marginBottom: 24 }}>
        <Link
          className={`button ${vocabulary || book ? 'secondary' : 'primary'}`}
          href="/courses/new"
        >
          Regular course
        </Link>
        <Link
          className={`button ${vocabulary ? 'primary' : 'secondary'}`}
          href="/courses/new?kind=vocabulary"
        >
          Language vocabulary
        </Link>
        <Link className={`button ${book ? 'primary' : 'secondary'}`} href="/courses/new?kind=book">
          Reading a book
        </Link>
      </div>
      {book ? (
        <BookCourseForm />
      ) : vocabulary ? (
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
