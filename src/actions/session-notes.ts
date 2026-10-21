'use server';

import { db } from '@/db';
import { courses, courseSessions } from '@/db/schema';
import { ownedSession } from '@/lib/data';
import { requireUser } from '@/lib/auth';
import { studyNoteFiles } from '@/lib/session-notes';
import { NoteFileError } from '@/lib/study-note-files';
import { noteBodySchema, notePathSchema } from '@/lib/study-note-format';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { notFound, unstable_rethrow } from 'next/navigation';
import { z } from 'zod';
import type { ActionState } from '@/actions';

export type NoteState = ActionState & { version?: string };
function failure(error: unknown): NoteState {
  unstable_rethrow(error);
  if (error instanceof z.ZodError) return { error: error.issues[0].message };
  if (error instanceof NoteFileError) return { error: error.message };
  console.error('Study note storage failed:', error instanceof Error ? error.name : 'Unknown');
  return {
    error:
      'Could not save the Markdown file. Check note storage and try again; your text is still in the editor.',
  };
}

export async function saveNote(
  sessionId: string,
  existingPath: string | null,
  _state: NoteState,
  form: FormData,
): Promise<NoteState> {
  const user = await requireUser();
  const { course } = await ownedSession(user.id, sessionId);
  if (course.kind !== 'standard') return { error: 'Use a regular course session for study notes.' };
  try {
    const topic = z
      .string()
      .max(200)
      .parse(form.get('topic') ?? '')
      .trim();
    const filename = z
      .string()
      .max(100)
      .parse(form.get('filename') ?? '')
      .trim();
    const path = notePathSchema.parse(existingPath ?? (topic ? topic + '/' : '') + filename);
    const body = noteBodySchema.parse(z.string().parse(form.get('body')).replace(/\r\n?/g, '\n'));
    const expectedVersion = z
      .string()
      .regex(existingPath ? /^[a-f0-9]{64}$/ : /^$/)
      .parse(form.get('version') ?? '');
    const version = await db.transaction(async (tx) => {
      const [lockedCourse] = await tx
        .select({ id: courses.id })
        .from(courses)
        .where(and(eq(courses.id, course.id), eq(courses.ownerId, user.id)))
        .for('update');
      const [session] = await tx
        .select({ id: courseSessions.id })
        .from(courseSessions)
        .where(and(eq(courseSessions.id, sessionId), eq(courseSessions.courseId, course.id)));
      if (!lockedCourse || !session) notFound();
      return studyNoteFiles.save(
        { userId: user.id, courseId: course.id, sessionId },
        path,
        body,
        expectedVersion,
      );
    });
    revalidatePath('/sessions/' + sessionId);
    return { success: existingPath ? 'Note updated.' : 'Markdown note added.', version };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteNote(
  sessionId: string,
  path: string,
  _state: NoteState,
  form: FormData,
): Promise<NoteState> {
  const user = await requireUser();
  const { course } = await ownedSession(user.id, sessionId);
  try {
    notePathSchema.parse(path);
    const version = z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .parse(form.get('version'));
    if (form.get('confirmation') !== path)
      return { error: 'Type the note path to confirm deletion.' };
    await db.transaction(async (tx) => {
      const [lockedCourse] = await tx
        .select({ id: courses.id })
        .from(courses)
        .where(and(eq(courses.id, course.id), eq(courses.ownerId, user.id)))
        .for('update');
      if (!lockedCourse) notFound();
      await studyNoteFiles.remove(
        { userId: user.id, courseId: course.id, sessionId },
        path,
        version,
      );
    });
    revalidatePath('/sessions/' + sessionId);
    return { success: 'Note deleted.' };
  } catch (error) {
    return failure(error);
  }
}
