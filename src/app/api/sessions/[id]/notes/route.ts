import { requireUser } from '@/lib/auth';
import { ownedSession } from '@/lib/data';
import { studyNoteFiles } from '@/lib/session-notes';
import { notePathSchema } from '@/lib/study-note-format';
import { notFound } from 'next/navigation';

export const runtime = 'nodejs';
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await context.params;
  const { course } = await ownedSession(user.id, id);
  const input = notePathSchema.safeParse(new URL(request.url).searchParams.get('path'));
  if (!input.success) return new Response('Invalid note path.', { status: 400 });
  const note = await studyNoteFiles.read(
    { userId: user.id, courseId: course.id, sessionId: id },
    input.data,
  );
  if (!note) notFound();
  return new Response(note.body, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="${note.path.split('/').at(-1)}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
