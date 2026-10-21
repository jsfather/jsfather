import Link from 'next/link';
import { BookOpen, FileText, Layers, ArrowUpRight, Download } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { studyNotesLibrary } from '@/lib/study-notes-library';
import { pageNumber } from '@/lib/data';
import { PageTitle, Pagination } from '@/components/ui';
import { NotesFilters } from '@/components/notes-filters';
import { StudyMarkdown } from '@/components/study-markdown';
import { NoteEditor, DeleteNote } from '@/components/session-notes';

export const metadata = { title: 'Study notes' };
export default async function NotesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const query = await searchParams;
  const value = (key: string) =>
    typeof query[key] === 'string' ? query[key].slice(0, 200).trim() : '';
  const library = await studyNotesLibrary(user.id);
  const selectedSession = library.sessions.find(
    (session) => session.sessionId === value('session'),
  );
  const initial = {
    q: value('q'),
    course: value('course') || selectedSession?.courseId || '',
    session: value('session'),
    topic: value('topic'),
  };
  const filtered = library.notes.filter(
    (note) =>
      (!initial.course || note.courseId === initial.course) &&
      (!initial.session || note.sessionId === initial.session) &&
      (!initial.topic ||
        (initial.topic === '__general' ? !note.topic : note.topic === initial.topic)) &&
      (!initial.q ||
        [note.title, note.path, note.body, note.courseTitle, note.sessionTitle]
          .join('\n')
          .toLocaleLowerCase()
          .includes(initial.q.toLocaleLowerCase())),
  );
  const page = Math.min(pageNumber(value('page')), Math.max(1, Math.ceil(filtered.length / 12)));
  const notes = filtered.slice((page - 1) * 12, page * 12);
  const topics = [...new Set(library.notes.map((note) => note.topic).filter(Boolean))].sort();
  const baseQuery = new URLSearchParams(Object.entries(initial).filter(([, value]) => value));
  const base = '/notes' + (baseQuery.size ? '?' + baseQuery.toString() : '');
  return (
    <div className="ui-stack section-stack">
      <PageTitle
        eyebrow="PERSONAL LIBRARY"
        title="Study notes"
        description="Read and revisit your notes across courses and sessions."
        action={
          <Link className="button secondary" href="/courses">
            <BookOpen size={16} />
            My courses
          </Link>
        }
      />
      <div className="ui-stack section-stack notes-workspace">
        <section className="panel notes-overview" aria-label="Notes overview">
          <div>
            <FileText size={20} />
            <strong>{library.notes.length}</strong>
            <span>Saved notes</span>
          </div>
          <div>
            <BookOpen size={20} />
            <strong>{new Set(library.notes.map((note) => note.courseId)).size}</strong>
            <span>Courses with notes</span>
          </div>
          <div>
            <Layers size={20} />
            <strong>{new Set(library.notes.map((note) => note.topic || 'General')).size}</strong>
            <span>Topics</span>
          </div>
        </section>
        <section className="panel ui-stack" aria-label="Find your notes">
          <h2>Find your notes</h2>
          <NotesFilters key={base} sessions={library.sessions} topics={topics} initial={initial} />
        </section>
        <p className="field-hint" role="status">
          {filtered.length} {filtered.length === 1 ? 'note' : 'notes'} in this collection
          {filtered.length > 0
            ? ` · Showing ${(page - 1) * 12 + 1}–${Math.min(page * 12, filtered.length)}`
            : ''}
        </p>
        {!filtered.length ? (
          <section className="panel ui-stack notes-empty" aria-label="No matching notes">
            <FileText size={32} aria-hidden="true" />
            <h2>
              {library.notes.length ? 'No notes match these filters' : 'Your notes start here'}
            </h2>
            <p className="muted">
              {library.notes.length
                ? 'Try a different search, course, session, or topic to find what you need.'
                : 'Add a note to any course session. It will appear here with your other study notes.'}
            </p>
            <div className="panel-actions">
              {library.notes.length ? (
                <Link className="button secondary" href="/notes">
                  Show all notes
                </Link>
              ) : (
                <Link
                  className="button primary"
                  href={selectedSession ? '/sessions/' + selectedSession.sessionId : '/courses'}
                >
                  {selectedSession ? 'Add a session note' : 'Choose a course'}
                </Link>
              )}
            </div>
          </section>
        ) : (
          <div className="notes-reading-layout">
            <aside className="panel ui-stack notes-contents" aria-label="Notes on this page">
              <h2>In this collection</h2>
              <p className="field-hint">
                {filtered.length} {filtered.length === 1 ? 'note' : 'notes'} · Page {page}
              </p>
              <nav className="ui-stack" aria-label="Jump to note">
                {notes.map((note, index) => (
                  <a
                    className="notes-contents-link"
                    href={'#note-' + index}
                    key={note.sessionId + note.path}
                  >
                    <strong>{note.title}</strong>
                    <span>{note.sessionTitle}</span>
                  </a>
                ))}
              </nav>
            </aside>
            <div className="ui-stack section-stack notes-reading-list">
              {notes.map((note, index) => (
                <article
                  className="panel ui-stack notes-reading-card"
                  id={'note-' + index}
                  key={note.sessionId + note.path}
                  aria-label={note.title}
                >
                  <div className="ui-stack notes-note-context">
                    <Link className="text-link" href={'/courses/' + note.courseId}>
                      {note.courseTitle}
                    </Link>
                    <p className="muted">
                      {note.chapterTitle ? note.chapterTitle + ' · ' : ''}Session{' '}
                      {note.sessionNumber} · {note.sessionTitle}
                    </p>
                    <span className="badge badge-neutral">{note.topic || 'General'}</span>
                  </div>
                  <StudyMarkdown embedded>{note.body}</StudyMarkdown>
                  <div className="panel-actions notes-reading-actions">
                    <Link className="button secondary" href={'/sessions/' + note.sessionId}>
                      <ArrowUpRight size={16} />
                      Open session
                    </Link>
                    <a
                      className="text-link"
                      href={`/api/sessions/${note.sessionId}/notes?path=${encodeURIComponent(note.path)}`}
                      download
                    >
                      <Download size={16} />
                      Download .md
                    </a>
                  </div>
                  <details className="lesson-reveal">
                    <summary>Edit note</summary>
                    <NoteEditor sessionId={note.sessionId} note={note} />
                  </details>
                  <details className="lesson-reveal">
                    <summary>More options</summary>
                    <div className="ui-stack">
                      <p className="note-file-path">{note.path}</p>
                      <DeleteNote sessionId={note.sessionId} note={note} />
                    </div>
                  </details>
                </article>
              ))}
              <Pagination page={page} hasMore={page * 12 < filtered.length} base={base} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
