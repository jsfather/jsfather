'use server';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { redirect, notFound, unstable_rethrow } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { formatInTimeZone } from 'date-fns-tz';
import { db } from '@/db';
import {
  courses,
  users,
  vocabularyMembers,
  vocabularyWords,
  vocabularyProgress,
  vocabularyReviews,
} from '@/db/schema';
import { requireUser } from '@/lib/auth';
import { slugify } from '@/lib/learning';
import { courseSchema, localDate } from '@/lib/validation';
import { nextVocabularyReview, reviewTargets } from '@/lib/vocabulary';
import { vocabularyTargetSql } from '@/lib/vocabulary-data';
import type { ActionState } from '@/actions';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
class VocabularyError extends Error {}
const vocabularyCourseSchema = courseSchema.pick({
  title: true,
  description: true,
  category: true,
  difficulty: true,
  color: true,
  timezone: true,
});
const wordSchema = z.object({
  word: z.string().trim().min(1).max(200),
  explanation: z.string().trim().min(1).max(5000),
  example: z.string().trim().max(2000),
  persianMeaning: z.string().trim().max(2000).default(''),
  pronunciationIpa: z.string().trim().max(1000).default(''),
  pronunciationFa: z.string().trim().max(1000).default(''),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  addedOn: localDate,
});
function failure(error: unknown): ActionState {
  unstable_rethrow(error);
  if (error instanceof VocabularyError) return { error: error.message };
  if (error instanceof z.ZodError)
    return {
      error: error.issues
        .map((i) => i.message)
        .slice(0, 3)
        .join(' '),
    };
  const cause = error && typeof error === 'object' && 'cause' in error ? error.cause : error;
  if (cause && typeof cause === 'object' && 'code' in cause && cause.code === '23505')
    return { error: 'That word or collaborator is already in this course.' };
  console.error('Vocabulary mutation failed:', error instanceof Error ? error.name : 'Unknown');
  return { error: 'We could not save this change. Please try again.' };
}
function refresh(id: string) {
  revalidatePath('/courses');
  revalidatePath('/dashboard');
  revalidatePath('/courses/' + id, 'layout');
}
// Lock the course before every mutation. Membership removal, editing words and
// saving reviews cannot race authorization checks or count the same card twice.
async function withCourse<T>(
  userId: string,
  courseId: string,
  ownerOnly: boolean,
  run: (tx: Tx, course: typeof courses.$inferSelect) => Promise<T>,
) {
  return db.transaction(async (tx) => {
    const [course] = await tx
      .select()
      .from(courses)
      .where(and(eq(courses.id, courseId), eq(courses.kind, 'vocabulary')))
      .for('update');
    if (!course) notFound();
    if (course.ownerId !== userId) {
      if (ownerOnly) notFound();
      const [member] = await tx
        .select()
        .from(vocabularyMembers)
        .where(and(eq(vocabularyMembers.courseId, courseId), eq(vocabularyMembers.userId, userId)));
      if (!member) notFound();
    }
    return run(tx, course);
  });
}
export async function createVocabularyCourse(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  let id = '';
  try {
    const input = vocabularyCourseSchema.parse(Object.fromEntries(form));
    id = crypto.randomUUID();
    await db.insert(courses).values({
      ...input,
      id,
      ownerId: user.id,
      kind: 'vocabulary',
      slug: slugify(input.title) + '-' + id.slice(0, 8),
      totalSessions: 0,
      scheduledTime: '00:00',
      duration: 15,
      weekdays: [],
      startDate: formatInTimeZone(new Date(), input.timezone, 'yyyy-MM-dd'),
    });
  } catch (e) {
    return failure(e);
  }
  refresh(id);
  redirect('/courses/' + id);
}
export async function editVocabularyCourse(
  id: string,
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  try {
    const input = vocabularyCourseSchema
      .extend({
        status: z.enum(['active', 'archived']),
        isPublic: z.preprocess((v) => v === 'on', z.boolean()),
      })
      .parse(Object.fromEntries(form));
    await withCourse(user.id, id, true, async (tx) => {
      await tx
        .update(courses)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(courses.id, id));
    });
  } catch (e) {
    return failure(e);
  }
  refresh(id);
  return { success: 'Course updated.' };
}
export async function saveVocabularyWord(
  courseId: string,
  wordId: string | null,
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  try {
    const input = wordSchema.parse(Object.fromEntries(form));
    await withCourse(user.id, courseId, true, async (tx) => {
      if (!wordId) {
        await tx.insert(vocabularyWords).values({ ...input, courseId });
        return;
      }
      const [word] = await tx
        .select()
        .from(vocabularyWords)
        .where(and(eq(vocabularyWords.id, wordId), eq(vocabularyWords.courseId, courseId)));
      if (!word) notFound();
      const contentChanged =
        word.word !== input.word ||
        word.explanation !== input.explanation ||
        word.persianMeaning !== input.persianMeaning;
      await tx
        .update(vocabularyWords)
        .set({ ...input, version: word.version + 1, updatedAt: new Date() })
        .where(eq(vocabularyWords.id, wordId));
      // Existing review records remain history; pending cards are invalidated.
      await tx
        .delete(vocabularyReviews)
        .where(
          and(eq(vocabularyReviews.wordId, wordId), sql`${vocabularyReviews.submittedAt} is null`),
        );
      if (contentChanged)
        await tx.delete(vocabularyProgress).where(eq(vocabularyProgress.wordId, wordId));
      else if (word.difficulty !== input.difficulty)
        await tx
          .update(vocabularyProgress)
          .set({ dueAt: new Date() })
          .where(
            and(
              eq(vocabularyProgress.wordId, wordId),
              sql`${vocabularyProgress.successfulReviews} < ${reviewTargets[input.difficulty]}`,
            ),
          );
    });
  } catch (e) {
    return failure(e);
  }
  refresh(courseId);
  return { success: wordId ? 'Word updated.' : 'Word added.' };
}
export async function deleteVocabularyWord(
  courseId: string,
  wordId: string,
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  try {
    await withCourse(user.id, courseId, true, async (tx) => {
      const [word] = await tx
        .select()
        .from(vocabularyWords)
        .where(and(eq(vocabularyWords.id, wordId), eq(vocabularyWords.courseId, courseId)));
      if (!word) notFound();
      if (form.get('confirmation') !== word.word)
        throw new VocabularyError('Type the word to confirm deletion.');
      await tx.delete(vocabularyWords).where(eq(vocabularyWords.id, wordId));
    });
  } catch (e) {
    return failure(e);
  }
  refresh(courseId);
  return { success: 'Word deleted.' };
}
export async function addVocabularyCollaborator(
  courseId: string,
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  try {
    const username = z.string().trim().toLowerCase().min(3).max(60).parse(form.get('username'));
    await withCourse(user.id, courseId, true, async (tx, course) => {
      const [friend] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, username));
      if (!friend)
        throw new VocabularyError(
          'No account has that username. Ask your friend to sign in and check their username in Settings.',
        );
      if (friend.id === course.ownerId) throw new VocabularyError('You already own this course.');
      await tx
        .insert(vocabularyMembers)
        .values({ courseId, userId: friend.id, role: 'collaborator' })
        .onConflictDoUpdate({
          target: [vocabularyMembers.courseId, vocabularyMembers.userId],
          set: { role: 'collaborator' },
        });
    });
  } catch (e) {
    return failure(e);
  }
  refresh(courseId);
  return { success: 'Collaborator added. This course is now in their My courses.' };
}
export async function removeVocabularyCollaborator(
  courseId: string,
  memberId: string,
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  try {
    await withCourse(user.id, courseId, true, async (tx) => {
      const [member] = await tx
        .select({ username: users.username })
        .from(vocabularyMembers)
        .innerJoin(users, eq(users.id, vocabularyMembers.userId))
        .where(
          and(eq(vocabularyMembers.courseId, courseId), eq(vocabularyMembers.userId, memberId)),
        );
      if (!member) notFound();
      if (form.get('confirmation') !== member.username)
        throw new VocabularyError('Type the username to confirm removal.');
      await tx
        .delete(vocabularyMembers)
        .where(
          and(eq(vocabularyMembers.courseId, courseId), eq(vocabularyMembers.userId, memberId)),
        );
      await tx
        .delete(vocabularyReviews)
        .where(
          and(
            eq(vocabularyReviews.courseId, courseId),
            eq(vocabularyReviews.userId, memberId),
            sql`${vocabularyReviews.submittedAt} is null`,
          ),
        );
    });
  } catch (e) {
    return failure(e);
  }
  refresh(courseId);
  return {
    success: 'Collaborator removed. Their review history is preserved if you add them again.',
  };
}
export async function startVocabularyReview(courseId: string) {
  const user = await requireUser();
  const id = await withCourse(user.id, courseId, false, async (tx, course) => {
    if (course.status === 'archived') return null;
    const [pending] = await tx
      .select()
      .from(vocabularyReviews)
      .where(
        and(
          eq(vocabularyReviews.courseId, courseId),
          eq(vocabularyReviews.userId, user.id),
          sql`${vocabularyReviews.submittedAt} is null`,
        ),
      );
    if (pending) return pending.id;
    const [word] = await tx
      .select({ word: vocabularyWords })
      .from(vocabularyWords)
      .leftJoin(
        vocabularyProgress,
        and(
          eq(vocabularyProgress.wordId, vocabularyWords.id),
          eq(vocabularyProgress.userId, user.id),
        ),
      )
      .where(
        and(
          eq(vocabularyWords.courseId, courseId),
          sql`coalesce(${vocabularyProgress.successfulReviews}, 0) < ${vocabularyTargetSql}`,
          sql`(${vocabularyProgress.dueAt} is null or ${vocabularyProgress.dueAt} <= now())`,
        ),
      )
      .orderBy(sql`random()`)
      .limit(1);
    if (!word) return null;
    const [review] = await tx
      .insert(vocabularyReviews)
      .values({
        courseId,
        wordId: word.word.id,
        userId: user.id,
        wordVersion: word.word.version,
        wordSnapshot: {
          word: word.word.word,
          explanation: word.word.explanation,
          example: word.word.example,
          difficulty: word.word.difficulty,
        },
        direction: Math.random() < 0.5 ? 'word' : 'meaning',
      })
      .returning({ id: vocabularyReviews.id });
    return review.id;
  });
  redirect('/courses/' + courseId + '/review' + (id ? '/' + id : ''));
}
export async function revealVocabularyReview(
  courseId: string,
  reviewId: string,
  _state: ActionState,
): Promise<ActionState> {
  void _state;
  const user = await requireUser();
  try {
    await withCourse(user.id, courseId, false, async (tx) => {
      const [review] = await tx
        .update(vocabularyReviews)
        .set({ revealedAt: new Date() })
        .where(
          and(
            eq(vocabularyReviews.id, reviewId),
            eq(vocabularyReviews.courseId, courseId),
            eq(vocabularyReviews.userId, user.id),
            sql`${vocabularyReviews.submittedAt} is null`,
          ),
        )
        .returning({ id: vocabularyReviews.id });
      if (!review)
        throw new VocabularyError(
          'This card is no longer active. Return to the course to continue.',
        );
    });
  } catch (e) {
    return failure(e);
  }
  return { success: 'Answer revealed.' };
}
export async function submitVocabularyReview(
  courseId: string,
  reviewId: string,
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  try {
    const remembered = z.enum(['remembered', 'again']).parse(form.get('rating')) === 'remembered';
    await withCourse(user.id, courseId, false, async (tx, course) => {
      if (course.status === 'archived') throw new VocabularyError('This course is archived.');
      const [review] = await tx
        .select()
        .from(vocabularyReviews)
        .where(
          and(
            eq(vocabularyReviews.id, reviewId),
            eq(vocabularyReviews.courseId, courseId),
            eq(vocabularyReviews.userId, user.id),
          ),
        );
      if (!review) notFound();
      if (review.submittedAt) return; // Retried requests never increment progress twice.
      if (!review.revealedAt)
        throw new VocabularyError('Reveal the answer before rating your recall.');
      const [word] = await tx
        .select()
        .from(vocabularyWords)
        .where(and(eq(vocabularyWords.id, review.wordId), eq(vocabularyWords.courseId, courseId)));
      if (!word || word.version !== review.wordVersion)
        throw new VocabularyError('This word changed. Return to the course to start a new card.');
      const [progress] = await tx
        .select()
        .from(vocabularyProgress)
        .where(and(eq(vocabularyProgress.wordId, word.id), eq(vocabularyProgress.userId, user.id)));
      const now = new Date();
      const successfulReviews = Math.min(
        reviewTargets[word.difficulty],
        (progress?.successfulReviews ?? 0) + (remembered ? 1 : 0),
      );
      const values = {
        successfulReviews,
        totalReviews: (progress?.totalReviews ?? 0) + 1,
        lastReviewedAt: now,
        dueAt: nextVocabularyReview(word.difficulty, successfulReviews, remembered, now),
      };
      await tx
        .insert(vocabularyProgress)
        .values({ wordId: word.id, userId: user.id, ...values })
        .onConflictDoUpdate({
          target: [vocabularyProgress.wordId, vocabularyProgress.userId],
          set: values,
        });
      await tx
        .update(vocabularyReviews)
        .set({ remembered, submittedAt: now })
        .where(eq(vocabularyReviews.id, reviewId));
    });
  } catch (e) {
    return failure(e);
  }
  refresh(courseId);
  await startVocabularyReview(courseId);
  return {};
}

export async function leaveVocabularyCourse(
  courseId: string,
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  try {
    await withCourse(user.id, courseId, false, async (tx, course) => {
      if (course.ownerId === user.id)
        throw new VocabularyError('The owner cannot leave their course.');
      if (form.get('confirmation') !== course.title)
        throw new VocabularyError('Type the course title to confirm leaving.');
      await tx
        .delete(vocabularyMembers)
        .where(
          and(eq(vocabularyMembers.courseId, courseId), eq(vocabularyMembers.userId, user.id)),
        );
      await tx
        .delete(vocabularyReviews)
        .where(
          and(
            eq(vocabularyReviews.courseId, courseId),
            eq(vocabularyReviews.userId, user.id),
            sql`${vocabularyReviews.submittedAt} is null`,
          ),
        );
    });
  } catch (e) {
    return failure(e);
  }
  refresh(courseId);
  redirect('/courses');
}

export async function joinPublicVocabularyCourse(courseId: string) {
  const user = await requireUser();
  await db.transaction(async (tx) => {
    const [course] = await tx
      .select()
      .from(courses)
      .where(
        and(
          eq(courses.id, courseId),
          eq(courses.kind, 'vocabulary'),
          eq(courses.isPublic, true),
          eq(courses.status, 'active'),
        ),
      )
      .for('update');
    if (!course) notFound();
    const [owner] = await tx
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.id, course.ownerId),
          eq(users.publicProfile, true),
          eq(users.showCourses, true),
        ),
      );
    if (!owner) notFound();
    if (course.ownerId !== user.id)
      await tx
        .insert(vocabularyMembers)
        .values({ courseId, userId: user.id, role: 'learner' })
        .onConflictDoNothing();
  });
  refresh(courseId);
  redirect('/courses/' + courseId);
}
