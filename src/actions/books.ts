'use server';
import { db } from '@/db';
import { creditPractice } from '@/lib/practice-credit';
import { readingEstimate } from '@/lib/practice';
import { courses, courseSessions, bookBookmarks } from '@/db/schema';
import { requireUser } from '@/lib/auth';
import { slugify } from '@/lib/learning';
import { bookCourseSchema, bookProgressSchema, bookBookmarkSchema } from '@/lib/validation';
import { issueEligibleCertificate } from '@/lib/issue-certificate';
import { and, eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import { formatInTimeZone } from 'date-fns-tz';
import { redirect, notFound, unstable_rethrow } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { syncAssessmentNames } from '@/lib/sync-assessment-names';
import type { ActionState } from '@/actions';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
class BookError extends Error {}
function failure(error: unknown): ActionState {
  unstable_rethrow(error);
  if (error instanceof BookError) return { error: error.message };
  if (error instanceof z.ZodError)
    return {
      error: error.issues
        .map((issue) => issue.message)
        .slice(0, 3)
        .join(' '),
    };
  console.error('Book mutation failed:', error instanceof Error ? error.name : 'Unknown');
  return { error: 'Could not save this change. Please try again.' };
}
function refresh(id: string) {
  for (const path of [
    '/activity',
    '/courses',
    '/dashboard',
    '/profile',
    '/certificates',
    '/courses/' + id,
  ])
    revalidatePath(path);
  revalidatePath('/u', 'layout');
}
async function withBook<T>(
  userId: string,
  id: string,
  run: (tx: Tx, course: typeof courses.$inferSelect) => Promise<T>,
) {
  return db.transaction(async (tx) => {
    const [course] = await tx
      .select()
      .from(courses)
      .where(and(eq(courses.id, id), eq(courses.ownerId, userId), eq(courses.kind, 'book')))
      .for('update');
    if (!course) notFound();
    return run(tx, course);
  });
}
// The existing exam engine uses this private bank as the book's question source.
async function syncBookCompletion(tx: Tx, id: string, completed: boolean) {
  await tx
    .update(courseSessions)
    .set({
      status: completed ? 'completed' : 'in_progress',
      completedAt: completed ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(courseSessions.courseId, id));
}
export async function createBookCourse(_state: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const id = crypto.randomUUID();
  try {
    const input = bookCourseSchema.parse({
      ...Object.fromEntries(form),
      isPublic: form.get('isPublic') === 'on',
    });
    await db.transaction(async (tx) => {
      await tx.insert(courses).values({
        ...input,
        id,
        ownerId: user.id,
        kind: 'book',
        slug: slugify(input.title) + '-' + id.slice(0, 8),
        totalSessions: 1,
        startDate: formatInTimeZone(new Date(), user.timezone, 'yyyy-MM-dd'),
        timezone: user.timezone,
        scheduledTime: '00:00',
        duration: 60,
        weekdays: [],
      });
      await tx.insert(courseSessions).values({
        courseId: id,
        title: 'Book questions',
        sessionNumber: 1,
        scheduledDate: new Date(),
        duration: 60,
        status: 'in_progress',
      });
    });
  } catch (error) {
    return failure(error);
  }
  refresh(id);
  redirect('/courses/' + id);
}
export async function editBookCourse(
  id: string,
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  try {
    await withBook(user.id, id, async (tx, course) => {
      const input = bookCourseSchema
        .extend({
          category: z.union([bookCourseSchema.shape.category, z.literal(course.category)]),
          status: z.enum(['active', 'archived']),
        })
        .parse({ ...Object.fromEntries(form), isPublic: form.get('isPublic') === 'on' });
      const [lastBookmark] = await tx
        .select({ page: bookBookmarks.page })
        .from(bookBookmarks)
        .where(eq(bookBookmarks.courseId, id))
        .orderBy(desc(bookBookmarks.page))
        .limit(1);
      if (input.totalPages < course.currentPage || input.totalPages < (lastBookmark?.page ?? 0))
        throw new BookError(
          'The page count cannot be less than your reading position or an existing bookmark.',
        );
      await tx
        .update(courses)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(courses.id, id));
      await syncBookCompletion(tx, id, course.currentPage === input.totalPages);
      await syncAssessmentNames(tx, id);
    });
    await issueEligibleCertificate(id, user.id);
  } catch (error) {
    return failure(error);
  }
  refresh(id);
  return { success: 'Book updated.' };
}
export async function saveBookProgress(
  id: string,
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  try {
    const input = bookProgressSchema.parse(Object.fromEntries(form));
    await withBook(user.id, id, async (tx, course) => {
      if (input.currentPage > course.totalPages!)
        throw new BookError('Your reading position cannot exceed the book’s page count.');
      await tx
        .update(courses)
        .set({
          ...input,
          creditedPages: Math.max(course.creditedPages, input.currentPage),
          updatedAt: new Date(),
        })
        .where(eq(courses.id, id));
      if (input.currentPage > course.creditedPages)
        await creditPractice(tx, {
          userId: user.id,
          courseId: id,
          timezone: user.timezone,
          activity: 'reading',
          sourceKey: `book:${id}:${input.currentPage}`,
          seconds: readingEstimate(input.currentPage, course.creditedPages),
        });
      await syncBookCompletion(tx, id, input.currentPage === course.totalPages);
    });
    await issueEligibleCertificate(id, user.id);
  } catch (error) {
    return failure(error);
  }
  refresh(id);
  return { success: 'Reading progress saved.' };
}
export async function saveBookNotes(
  id: string,
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  try {
    const readingNotes = z.string().max(20000).parse(form.get('readingNotes'));
    await withBook(user.id, id, async (tx) => {
      await tx
        .update(courses)
        .set({ readingNotes, updatedAt: new Date() })
        .where(eq(courses.id, id));
    });
  } catch (error) {
    return failure(error);
  }
  refresh(id);
  return { success: 'Reading notes saved.' };
}
export async function saveBookBookmark(
  id: string,
  bookmarkId: string | null,
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  try {
    const input = bookBookmarkSchema.parse(Object.fromEntries(form));
    await withBook(user.id, id, async (tx, course) => {
      if (input.page > course.totalPages!)
        throw new BookError('Choose a bookmark page within this book.');
      if (bookmarkId) {
        const saved = await tx
          .update(bookBookmarks)
          .set({ ...input, updatedAt: new Date() })
          .where(and(eq(bookBookmarks.id, bookmarkId), eq(bookBookmarks.courseId, id)))
          .returning({ id: bookBookmarks.id });
        if (!saved.length) throw new BookError('This bookmark no longer exists.');
      } else await tx.insert(bookBookmarks).values({ ...input, courseId: id });
    });
  } catch (error) {
    return failure(error);
  }
  refresh(id);
  return { success: bookmarkId ? 'Bookmark updated.' : 'Bookmark added.' };
}
export async function deleteBookBookmark(
  id: string,
  bookmarkId: string,
  _state: ActionState,
): Promise<ActionState> {
  void _state;
  const user = await requireUser();
  try {
    await withBook(user.id, id, async (tx) => {
      await tx
        .delete(bookBookmarks)
        .where(and(eq(bookBookmarks.id, bookmarkId), eq(bookBookmarks.courseId, id)));
    });
  } catch (error) {
    return failure(error);
  }
  refresh(id);
  return { success: 'Bookmark removed.' };
}
