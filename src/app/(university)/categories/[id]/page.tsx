import Link from 'next/link';
import { db } from '@/db';
import { exams, certificates } from '@/db/schema';
import { ownedCategoryBank } from '@/lib/data';
import { requireUser } from '@/lib/auth';
import { and, eq, desc } from 'drizzle-orm';
import { categoryQuestionPool } from '@/lib/category-questions';
import { PageTitle } from '@/components/ui';
import { CategoryExamButton } from '@/components/category-form';
export const metadata = { title: 'Category questions & exams' };
export default async function Category({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const bank = await ownedCategoryBank(user.id, (await params).id);
  const pool = await categoryQuestionPool(db, user.id, bank);
  const direct = pool.filter((q) => !q.courseId).length;
  const courseCount = new Set(pool.flatMap((q) => (q.courseId ? [q.courseId] : []))).size;
  const [questionBank] = await db
    .select({ id: exams.id })
    .from(exams)
    .where(
      and(eq(exams.categoryBankId, bank.id), eq(exams.isFinal, false), eq(exams.isPractice, false)),
    );
  const [certificate] = await db
    .select({ id: certificates.id })
    .from(certificates)
    .where(and(eq(certificates.categoryBankId, bank.id), eq(certificates.userId, user.id)))
    .orderBy(desc(certificates.issuedAt))
    .limit(1);
  const history = await db
    .select({ id: exams.id, title: exams.title })
    .from(exams)
    .where(and(eq(exams.categoryBankId, bank.id), eq(exams.isFinal, true)))
    .orderBy(desc(exams.createdAt))
    .limit(10);
  return (
    <>
      <PageTitle
        eyebrow="CATEGORY QUESTIONS & EXAMS"
        title={bank.category}
        action={
          <Link className="button secondary" href="/courses">
            Back to courses
          </Link>
        }
      />
      <div className="ui-stack section-stack">
        <section className="panel ui-stack" aria-label="Category exam">
          <h2>Test yourself</h2>
          <p className="field-hint">
            Each exam includes all available questions in {bank.category}, shuffled into a new
            order. Questions from your courses are included automatically. Pass to earn a category
            certificate.
          </p>
          <p className="muted">
            {pool.length} questions available · {pool.length - direct} from {courseCount} courses ·{' '}
            {direct} added directly
          </p>
          {!pool.length && (
            <p className="muted">Add questions to this category or one of its courses to start.</p>
          )}
          <CategoryExamButton id={bank.id} disabled={!pool.length} />
          {certificate && (
            <div className="panel-actions">
              <Link className="button secondary" href={'/certificates/' + certificate.id}>
                View category certificate
              </Link>
            </div>
          )}
        </section>
        <section className="panel ui-stack" aria-label="Category questions">
          <h2>Add category questions</h2>
          <p className="field-hint">
            Add questions without attaching them to a course. They join the same pool as questions
            from courses in this category.
          </p>
          <div className="panel-actions">
            <Link
              className="button secondary"
              href={
                questionBank ? `/exams/${questionBank.id}/edit` : `/exams/new?category=${bank.id}`
              }
            >
              {questionBank ? 'Edit category questions' : 'Add questions'}
            </Link>
          </div>
        </section>
        {!!history.length && (
          <section className="panel ui-stack">
            <h2>Recent category exams</h2>
            {history.map((exam) => (
              <Link key={exam.id} className="text-link" href={'/exams/' + exam.id}>
                {exam.title}
              </Link>
            ))}
          </section>
        )}
      </div>
    </>
  );
}
