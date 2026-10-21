import 'server-only';
import { db } from '@/db';
import { courses, courseSessions, courseChapters } from '@/db/schema';
import { and, asc, eq } from 'drizzle-orm';
import { sessionNotes } from './session-notes';
import type { StudyNoteFile } from './study-note-files';

export type LibraryNote = StudyNoteFile & {
  courseId: string;
  courseTitle: string;
  sessionId: string;
  sessionTitle: string;
  sessionNumber: number;
  chapterTitle: string | null;
  topic: string;
};

export async function studyNotesLibrary(userId: string) {
  const sessions = await db
    .select({
      courseId: courses.id,
      courseTitle: courses.title,
      sessionId: courseSessions.id,
      sessionTitle: courseSessions.title,
      sessionNumber: courseSessions.sessionNumber,
      chapterTitle: courseChapters.title,
      legacyNotes: courseSessions.notes,
    })
    .from(courseSessions)
    .innerJoin(
      courses,
      and(
        eq(courses.id, courseSessions.courseId),
        eq(courses.ownerId, userId),
        eq(courses.kind, 'standard'),
      ),
    )
    .leftJoin(
      courseChapters,
      and(eq(courseChapters.id, courseSessions.chapterId), eq(courseChapters.courseId, courses.id)),
    )
    .orderBy(asc(courses.title), asc(courses.id), asc(courseSessions.sessionNumber));
  const notes: LibraryNote[] = [];
  // Bound filesystem and legacy-import concurrency for large multi-course libraries.
  for (let start = 0; start < sessions.length; start += 8) {
    const groups = await Promise.all(
      sessions.slice(start, start + 8).map(async ({ legacyNotes, ...session }) => {
        const files = await sessionNotes(
          { userId, courseId: session.courseId, sessionId: session.sessionId },
          legacyNotes,
        );
        return files.map((note) => ({
          ...note,
          ...session,
          topic: note.path.includes('/') ? note.path.slice(0, note.path.lastIndexOf('/')) : '',
        }));
      }),
    );
    notes.push(...groups.flat());
  }
  return {
    notes,
    sessions: sessions.map((session) => ({
      courseId: session.courseId,
      courseTitle: session.courseTitle,
      sessionId: session.sessionId,
      sessionTitle: session.sessionTitle,
      sessionNumber: session.sessionNumber,
      chapterTitle: session.chapterTitle,
    })),
  };
}
