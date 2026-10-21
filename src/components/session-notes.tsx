'use client';

import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import { useActionState, useId, useState } from 'react';
import { saveNote, deleteNote, type NoteState } from '@/actions/session-notes';
import type { StudyNoteFile } from '@/lib/study-note-files';
import { noteTemplate } from '@/lib/study-note-format';
import { Feedback, Submit } from './forms';
import { StudyMarkdown } from './study-markdown';
import { ConfirmationDialog } from './confirmation-dialog';

export function NoteEditor({ sessionId, note }: { sessionId: string; note?: StudyNoteFile }) {
  const contentLabelId = useId();
  const [body, setBody] = useState(note?.body ?? noteTemplate);
  const [version, setVersion] = useState(note?.version ?? '');
  const [filename, setFilename] = useState('');
  const [topic, setTopic] = useState('');
  const [state, action] = useActionState(async (previous: NoteState, form: FormData) => {
    const result = await saveNote(sessionId, note?.path ?? null, previous, form);
    if (result.success) {
      if (note) setVersion(result.version!);
      else {
        setBody(noteTemplate);
        setFilename('');
        setTopic('');
      }
    }
    return result;
  }, {});
  return (
    <form
      action={action}
      className="ui-stack"
      aria-label={note ? `Edit ${note.path}` : 'Add Markdown note'}
    >
      <Feedback state={state} />
      <input type="hidden" name="version" value={version} />
      {note ? (
        <p className="note-file-path">{note.path}</p>
      ) : (
        <div className="form-grid">
          <label className="field">
            <span>Filename</span>
            <input
              name="filename"
              value={filename}
              onChange={(event) => setFilename(event.target.value)}
              placeholder="javascript-closures.md"
              maxLength={100}
              required
            />
          </label>
          <label className="field">
            <span>Topic folder (optional)</span>
            <input
              name="topic"
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              placeholder="javascript/functions"
              maxLength={200}
            />
          </label>
        </div>
      )}
      <label className="field">
        <span id={contentLabelId}>Markdown content</span>
        <textarea
          aria-labelledby={contentLabelId}
          className="note-source"
          name="body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={18}
          maxLength={100000}
          required
          spellCheck={false}
        />
      </label>
      <p className="field-hint">
        Use # Title, a short explanation, Key Points, Example, and Reference. Label every code fence
        with its language; put expected output in a separate text fence when useful. Link directly
        to verified primary documentation.
      </p>
      <details className="lesson-reveal">
        <summary>Preview Markdown</summary>
        <StudyMarkdown>{body}</StudyMarkdown>
      </details>
      <div className="panel-actions">
        <Submit>{note ? 'Save note' : 'Add note'}</Submit>
      </div>
    </form>
  );
}

export function DeleteNote({ sessionId, note }: { sessionId: string; note: StudyNoteFile }) {
  return (
    <div className="panel-actions">
      <ConfirmationDialog
        trigger="Delete note"
        confirmation={note.path}
        description="This permanently removes this Markdown file."
        inputLabel="Note path to confirm deletion"
        action={deleteNote.bind(null, sessionId, note.path)}
      >
        <input type="hidden" name="version" value={note.version} />
      </ConfirmationDialog>
    </div>
  );
}

export function SessionNotes({ sessionId, notes }: { sessionId: string; notes: StudyNoteFile[] }) {
  return (
    <section className="panel ui-stack" aria-label="Session notes">
      <h2>
        Study notes <span className="muted">({notes.length})</span>
      </h2>
      <p className="muted">Your concepts, examples, and references for this session.</p>
      <div className="panel-actions">
        <Link className="button secondary" href={`/notes?session=${encodeURIComponent(sessionId)}`}>
          <BookOpen size={16} />
          Open notes workspace
        </Link>
      </div>
      {!notes.length && <p className="muted">No notes yet. Add your first Markdown note below.</p>}
      {notes.map((note) => (
        <details className="lesson-reveal session-note" key={note.path}>
          <summary>
            <strong>{note.title}</strong>
            <span className="note-file-path">{note.path}</span>
          </summary>
          <div className="ui-stack">
            <StudyMarkdown>{note.body}</StudyMarkdown>
            <div className="panel-actions">
              <a
                className="button secondary"
                href={`/api/sessions/${sessionId}/notes?path=${encodeURIComponent(note.path)}`}
                download
              >
                Download .md
              </a>
            </div>
            <details className="lesson-reveal">
              <summary>Edit note</summary>
              <NoteEditor sessionId={sessionId} note={note} />
            </details>
            <DeleteNote sessionId={sessionId} note={note} />
          </div>
        </details>
      ))}
      <details className="lesson-reveal">
        <summary>Add a Markdown note</summary>
        <NoteEditor sessionId={sessionId} />
      </details>
    </section>
  );
}
