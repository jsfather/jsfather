import Link from 'next/link';
import { formatInTimeZone } from 'date-fns-tz';
import { requireUser } from '@/lib/auth';
import { accessibleVocabularyCourse, vocabularyStats } from '@/lib/vocabulary-data';
import { startVocabularyReview } from '@/actions/vocabulary';
import { PageTitle } from '@/components/ui';
import { Submit } from '@/components/forms';
export const metadata = { title: 'Vocabulary practice' };
export default async function VocabularyReview({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const course = await accessibleVocabularyCourse(user.id, (await params).id);
  const stats = await vocabularyStats(course.id, user.id);
  return (
    <>
      <PageTitle
        eyebrow={course.title}
        title={stats.due ? 'Ready to practice' : 'You’re caught up'}
        description={`${stats.mastered} of ${stats.total} words mastered. Your reviews are saved.`}
      />
      <section className="panel">
        {stats.due && course.status === 'active' ? (
          <form action={startVocabularyReview.bind(null, course.id)}>
            <Submit>Practice</Submit>
          </form>
        ) : (
          <p className="muted">
            {stats.nextDue
              ? `Next review: ${formatInTimeZone(new Date(stats.nextDue), user.timezone, 'MMM d, HH:mm')}.`
              : 'Add more words to keep learning.'}
          </p>
        )}
        <Link className="text-link" href={`/courses/${course.id}`} style={{ marginTop: 24 }}>
          Back to course
        </Link>
      </section>
    </>
  );
}
