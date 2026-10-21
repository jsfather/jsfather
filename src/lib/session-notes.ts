import 'server-only';
import { createHash } from 'node:crypto';
import { db } from '@/db';
import { courses, courseSessions } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { StudyNoteFiles, type NoteScope } from './study-note-files';

export const studyNoteFiles = new StudyNoteFiles();

// The import is restart-safe: create the file before clearing the legacy database field.
// An existing imported file is never overwritten, including after an interrupted transaction.
export async function sessionNotes(scope: NoteScope, legacyNotes: string) {
  if (legacyNotes.trim()) {
    await db.transaction(async (tx) => {
      await tx
        .select({ id: courses.id })
        .from(courses)
        .where(and(eq(courses.id, scope.courseId), eq(courses.ownerId, scope.userId)))
        .for('update');
      const [session] = await tx
        .select()
        .from(courseSessions)
        .where(
          and(eq(courseSessions.id, scope.sessionId), eq(courseSessions.courseId, scope.courseId)),
        );
      if (!session?.notes.trim()) return;
      const body =
        ('# Imported study notes\n\n' + session.notes).replace(/\r\n?/g, '\n').trimEnd() + '\n';
      let path = 'imported-study-notes.md';
      let existing = await studyNoteFiles.read(scope, path);
      if (existing && existing.body !== body) {
        path = `imported-study-notes-${createHash('sha256').update(body).digest('hex')}.md`;
        existing = await studyNoteFiles.read(scope, path);
      }
      if (!existing) await studyNoteFiles.save(scope, path, body, '');
      else if (existing.body !== body) throw new Error('Conflicting legacy note import.');
      await tx
        .update(courseSessions)
        .set({ notes: '', updatedAt: new Date() })
        .where(eq(courseSessions.id, scope.sessionId));
    });
  }
  return studyNoteFiles.list(scope);
}
