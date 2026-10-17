'use server';
import { db } from '@/db';
import { categoryBanks, exams, examQuestions, examOptions } from '@/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { randomInt } from 'node:crypto';
import { ownedCategoryBank } from '@/lib/data';
import { categoryQuestionPool } from '@/lib/category-questions';
import { assessmentDefaults } from '@/lib/assessment';
import { requireUser } from '@/lib/auth';
import { isCourseCategory } from '@/lib/course-categories';
import { saveExam, startAttempt, type ActionState } from '@/actions';
import { redirect, unstable_rethrow } from 'next/navigation';
import { revalidatePath } from 'next/cache';

export async function openCategory(_state: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const category = String(form.get('category') ?? '');
  if (!isCourseCategory(category)) return { error: 'Choose a category.' };
  let id: string;
  try {
    const [categoryBank] = await db
      .insert(categoryBanks)
      .values({ ownerId: user.id, category })
      .onConflictDoUpdate({
        target: [categoryBanks.ownerId, categoryBanks.category],
        set: { category },
      })
      .returning({ id: categoryBanks.id });
    id = categoryBank.id;
  } catch (error) {
    unstable_rethrow(error);
    return { error: 'We could not open this category. Please try again.' };
  }
  revalidatePath('/categories');
  redirect('/categories/' + id);
}

export async function saveCategoryQuestions(
  categoryBankId: string,
  examId: string | null,
  state: ActionState,
  form: FormData,
) {
  return saveExam(null, examId, '', state, form, categoryBankId);
}

// Generate a fresh, shuffled snapshot of the complete category pool for every exam.
export async function generateCategoryExam(
  categoryBankId: string,
  _state: ActionState,
): Promise<ActionState> {
  void _state;
  const user = await requireUser();
  await ownedCategoryBank(user.id, categoryBankId);
  const id = crypto.randomUUID();
  try {
    const error = await db.transaction(
      async (tx) => {
        const [bank] = await tx
          .select()
          .from(categoryBanks)
          .where(and(eq(categoryBanks.id, categoryBankId), eq(categoryBanks.ownerId, user.id)))
          .for('update');
        if (!bank) return 'This category is no longer available.';
        const pool = await categoryQuestionPool(tx, user.id, bank);
        if (!pool.length) return 'Add questions to this category or one of its courses first.';
        const selected = pool.map((row) => row.question);
        for (let i = selected.length - 1; i > 0; i--) {
          const j = randomInt(i + 1);
          [selected[i], selected[j]] = [selected[j], selected[i]];
        }
        const defaults = assessmentDefaults(selected);
        await tx.insert(exams).values({
          id,
          categoryBankId,
          isFinal: true,
          title: bank.category + ' · Category exam',
          ...defaults,
          autoTimeLimit: true,
          autoPassingScore: true,
        });
        const options = await tx
          .select()
          .from(examOptions)
          .where(
            inArray(
              examOptions.questionId,
              selected.map((q) => q.id),
            ),
          );
        const copied = selected.map((q, order) => ({
          id: crypto.randomUUID(),
          examId: id,
          order,
          question: q.question,
          difficulty: q.difficulty,
          type: q.type,
          points: q.points,
          timeSeconds: q.timeSeconds,
          acceptedAnswers: q.acceptedAnswers,
          caseSensitive: q.caseSensitive,
          tolerance: q.tolerance,
          pairs: q.pairs,
          explanation: q.explanation,
        }));
        const ids = new Map(selected.map((q, i) => [q.id, copied[i].id]));
        const copiedOptions = options.map((option) => ({
          questionId: ids.get(option.questionId)!,
          text: option.text,
          isCorrect: option.isCorrect,
          order: option.order,
        }));
        for (let i = 0; i < copied.length; i += 1000)
          await tx.insert(examQuestions).values(copied.slice(i, i + 1000));
        for (let i = 0; i < copiedOptions.length; i += 1000)
          await tx.insert(examOptions).values(copiedOptions.slice(i, i + 1000));
        return null;
      },
      { isolationLevel: 'repeatable read' },
    );
    if (error) return { error };
  } catch (error) {
    unstable_rethrow(error);
    return { error: 'We could not prepare this category exam. Please try again.' };
  }
  revalidatePath('/categories/' + categoryBankId);
  await startAttempt(id);
  return {};
}
