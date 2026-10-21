'use server';

import { db } from '@/db';
import { courses, courseChapters, sessionReviews } from '@/db/schema';
import { requireUser } from '@/lib/auth';
import { ownedCourse, ownedSession } from '@/lib/data';
import { addCourseSessions } from '@/lib/session-management';
import { and, eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';
import { z } from 'zod';
import type { ActionState } from '@/actions';

function failure(error: unknown): ActionState {
  unstable_rethrow(error);
  if (error instanceof z.ZodError) return { error: error.issues[0].message };
  return { error: 'Could not save. Please refresh and try again.' };
}

export async function saveChapter(
  courseId: string,
  chapterId: string | null,
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const course = await ownedCourse(user.id, courseId);
  if (course.kind !== 'standard') return { error: 'Chapters are available for regular courses.' };
  try {
    const title = z.string().trim().min(2).max(160).parse(form.get('title'));
    await db.transaction(async (tx) => {
      await tx
        .select({ id: courses.id })
        .from(courses)
        .where(eq(courses.id, courseId))
        .for('update');
      if (chapterId) {
        await tx
          .update(courseChapters)
          .set({ title, updatedAt: new Date() })
          .where(and(eq(courseChapters.id, chapterId), eq(courseChapters.courseId, courseId)));
      } else {
        const [row] = await tx
          .select({ position: sql<number>`coalesce(max(${courseChapters.position}), 0)::int + 1` })
          .from(courseChapters)
          .where(eq(courseChapters.courseId, courseId));
        await tx.insert(courseChapters).values({ courseId, title, position: row.position });
      }
    });
  } catch (error) {
    return failure(error);
  }
  revalidatePath('/courses/' + courseId);
  return { success: chapterId ? 'Chapter saved.' : 'Chapter added.' };
}

export async function addVideoLessons(
  courseId: string,
  chapterId: string,
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const course = await ownedCourse(user.id, courseId);
  if (course.kind !== 'standard') return { error: 'Only regular courses have video lessons.' };
  try {
    const titles = z
      .array(z.string().trim().min(2).max(160))
      .min(1)
      .max(100)
      .parse(
        z
          .string()
          .max(20000)
          .parse(form.get('titles'))
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean),
      );
    const duration = z.coerce.number().int().min(1).max(480).parse(form.get('duration'));
    await db.transaction(async (tx) => {
      await tx
        .select({ id: courses.id })
        .from(courses)
        .where(eq(courses.id, courseId))
        .for('update');
      const [chapter] = await tx
        .select()
        .from(courseChapters)
        .where(and(eq(courseChapters.id, chapterId), eq(courseChapters.courseId, courseId)));
      if (!chapter) throw new Error('Unknown chapter');
      await addCourseSessions(
        tx,
        course,
        titles.map((title) => ({
          chapterId,
          title,
          description: '',
          scheduledDate: new Date(),
          duration,
          notes: '',
          status: 'upcoming',
          completedAt: null,
        })),
      );
    });
    revalidatePath('/courses/' + courseId);
    revalidatePath('/calendar');
    revalidatePath('/dashboard');
    revalidatePath('/courses');
    return { success: `${titles.length} video lessons added.` };
  } catch (error) {
    return failure(error);
  }
}

export async function saveSessionReview(
  sessionId: string,
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const { course } = await ownedSession(user.id, sessionId);
  if (course.kind !== 'standard') return { error: 'Review a regular course lesson here.' };
  try {
    const input = z
      .object({
        keyPoints: z.string().trim().min(2, 'Write at least one key point from memory.').max(20000),
        questions: z.string().trim().max(10000),
        confidence: z.enum(['revisit', 'developing', 'confident']),
      })
      .parse(Object.fromEntries(form));
    await db.transaction(async (tx) => {
      // Serialize with schedule rebuilds so a newly saved review cannot be cascaded away.
      await tx
        .select({ id: courses.id })
        .from(courses)
        .where(eq(courses.id, course.id))
        .for('update');
      await tx.insert(sessionReviews).values({ ...input, sessionId });
    });
  } catch (error) {
    return failure(error);
  }
  revalidatePath('/sessions/' + sessionId);
  revalidatePath('/courses/' + course.id);
  return { success: 'Review saved. Your previous reviews are preserved.' };
}
