import { PracticePanel } from '@/components/practice-panel';
import Link from 'next/link';
import { db } from '@/db';
import { bookBookmarks, courseSessions, exams, examAttempts, type Course } from '@/db/schema';
import { and, asc, desc, eq, or, sql } from 'drizzle-orm';
import { PageTitle, Progress, Pagination } from './ui';
import {
  BookProgressForm,
  BookNotesForm,
  BookBookmarkForm,
  DeleteBookBookmarkForm,
} from './book-forms';
import { AssessmentControls } from './final-controls';

export async function BookCourseDetail({
  course,
  userId,
  page,
}: {
  course: Course;
  userId: string;
  page: number;
}) {
  const [bookmarks, [source], history] = await Promise.all([
    db
      .select()
      .from(bookBookmarks)
      .where(eq(bookBookmarks.courseId, course.id))
      .orderBy(asc(bookBookmarks.page), asc(bookBookmarks.createdAt))
      .limit(50)
      .offset((page - 1) * 50),
    db
      .select({ id: courseSessions.id })
      .from(courseSessions)
      .where(eq(courseSessions.courseId, course.id))
      .limit(1),
    db
      .select({ exam: exams, best: sql<number | null>`max(${examAttempts.percentage})` })
      .from(exams)
      .leftJoin(
        examAttempts,
        and(eq(examAttempts.examId, exams.id), eq(examAttempts.userId, userId)),
      )
      .where(
        and(eq(exams.courseId, course.id), or(eq(exams.isFinal, true), eq(exams.isPractice, true))),
      )
      .groupBy(exams.id)
      .orderBy(desc(exams.createdAt))
      .limit(20),
  ]);
  const percentage = Math.round((course.currentPage / course.totalPages!) * 100);
  return (
    <>
      <PageTitle
        eyebrow={`BOOK · ${course.category.toUpperCase()}`}
        title={course.title}
        description={course.bookAuthor ? `By ${course.bookAuthor}` : 'Read at your own pace.'}
        action={
          <Link className="button secondary" href={`/courses/${course.id}/edit`}>
            Edit book
          </Link>
        }
      />
      <PracticePanel courseId={course.id} activity="reading" />
      <div className="detail-layout">
        <div>
          <section className="panel detail-panel">
            {course.description && <p className="detail-description">{course.description}</p>}
            <div className="progress-label">
              <span>Reading progress</span>
              <strong>{percentage}%</strong>
            </div>
            <Progress value={percentage} color={course.color} />
            <div className="detail-stats">
              <div>
                <strong>{course.currentPage}</strong>
                <span>Pages read</span>
              </div>
              <div>
                <strong>{course.totalPages! - course.currentPage}</strong>
                <span>Pages remaining</span>
              </div>
              <div>
                <strong>{course.totalPages}</strong>
                <span>Total pages</span>
              </div>
            </div>
            {course.currentPage === course.totalPages && (
              <p className="muted">
                Book finished. You can revisit your notes and practice your questions.
              </p>
            )}
            <BookProgressForm course={course} />
          </section>
          <section className="panel" style={{ marginTop: 24 }}>
            <h2>Reading notes</h2>
            <BookNotesForm course={course} />
          </section>
          <section className="panel" style={{ marginTop: 24 }}>
            <h2>Bookmarks</h2>
            <p className="muted">Save pages you want to revisit, with private notes.</p>
            <BookBookmarkForm course={course} />
            {!bookmarks.length && (
              <p className="muted" style={{ marginTop: 24 }}>
                No bookmarks on this page yet.
              </p>
            )}
            {bookmarks.map((bookmark) => (
              <details
                key={bookmark.id}
                style={{ borderTop: '1px solid var(--border)', marginTop: 24, paddingTop: 16 }}
              >
                <summary>
                  Page {bookmark.page}
                  {bookmark.label ? ` · ${bookmark.label}` : ''}
                </summary>
                {bookmark.notes && (
                  <p style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', marginTop: 12 }}>
                    {bookmark.notes}
                  </p>
                )}
                <BookBookmarkForm course={course} bookmark={bookmark} />
                <DeleteBookBookmarkForm courseId={course.id} bookmarkId={bookmark.id} />
              </details>
            ))}
            <Pagination
              page={page}
              hasMore={bookmarks.length === 50}
              base={'/courses/' + course.id}
            />
          </section>
        </div>
        <aside>
          <section className="panel">
            <h2>Book questions</h2>
            <p className="muted" style={{ margin: '12px 0 20px' }}>
              Add questions as you read. Your practice and final assessments cover the book’s
              question bank.
            </p>
            {source && (
              <Link className="button primary" href={'/exams/new?session=' + source.id}>
                Manage questions
              </Link>
            )}
          </section>
          <section className="panel" style={{ marginTop: 24 }}>
            <h2>Book details</h2>
            <div className="meta-list">
              <div>
                <span>Category</span>
                <strong>{course.category}</strong>
              </div>
              <div>
                <span>Status</span>
                <strong>
                  {course.currentPage === course.totalPages ? 'Finished' : course.status}
                </strong>
              </div>
              <div>
                <span>Visibility</span>
                <strong>{course.isPublic ? 'Public' : 'Private'}</strong>
              </div>
            </div>
          </section>
        </aside>
      </div>
      <AssessmentControls courseId={course.id} book>
        {!!history.length && (
          <div style={{ marginTop: 24 }}>
            <h3>Your assessment history</h3>
            {history.map(({ exam, best }) => (
              <div className="session-row" key={exam.id}>
                <div className="session-info">
                  <h4>{exam.title}</h4>
                  <span>{best === null ? 'In progress' : `Best: ${best}%`}</span>
                </div>
                <Link className="text-link" href={'/exams/' + exam.id}>
                  Results &amp; sharing
                </Link>
              </div>
            ))}
          </div>
        )}
      </AssessmentControls>
    </>
  );
}
