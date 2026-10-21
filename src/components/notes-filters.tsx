'use client';

import Link from 'next/link';
import { useId, useState } from 'react';
import { Search } from 'lucide-react';

type SessionOption = {
  courseId: string;
  courseTitle: string;
  sessionId: string;
  sessionTitle: string;
  sessionNumber: number;
};
export function NotesFilters({
  sessions,
  topics,
  initial,
}: {
  sessions: SessionOption[];
  topics: string[];
  initial: { q: string; course: string; session: string; topic: string };
}) {
  const labelId = useId();
  const [course, setCourse] = useState(initial.course);
  const [session, setSession] = useState(initial.session);
  const courseOptions = [
    ...new Map(sessions.map((item) => [item.courseId, item.courseTitle])).entries(),
  ];
  return (
    <form action="/notes" method="get" className="ui-stack" aria-label="Filter study notes">
      <label className="field">
        <span>Search notes</span>
        <input
          type="search"
          name="q"
          defaultValue={initial.q}
          maxLength={200}
          placeholder="Find a concept, code example, or key point…"
        />
      </label>
      <details className="lesson-reveal">
        <summary>Course, session &amp; topic filters</summary>
        <div className="notes-filter-grid">
          <label className="field">
            <span id={labelId + '-course'}>Course</span>
            <select
              aria-labelledby={labelId + '-course'}
              name="course"
              value={course}
              onChange={(event) => {
                setCourse(event.target.value);
                setSession('');
              }}
            >
              <option value="">All courses</option>
              {courseOptions.map(([id, title]) => (
                <option value={id} key={id}>
                  {title}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span id={labelId + '-session'}>Session</span>
            <select
              aria-labelledby={labelId + '-session'}
              name="session"
              value={session}
              onChange={(event) => setSession(event.target.value)}
            >
              <option value="">All sessions</option>
              {sessions
                .filter((item) => !course || item.courseId === course)
                .map((item) => (
                  <option key={item.sessionId} value={item.sessionId}>
                    {!course ? item.courseTitle + ' · ' : ''}
                    {item.sessionNumber}. {item.sessionTitle}
                  </option>
                ))}
            </select>
          </label>
          <label className="field">
            <span id={labelId + '-topic'}>Topic</span>
            <select aria-labelledby={labelId + '-topic'} name="topic" defaultValue={initial.topic}>
              <option value="">All topics</option>
              <option value="__general">General</option>
              {topics.map((topic) => (
                <option value={topic} key={topic}>
                  {topic}
                </option>
              ))}
            </select>
          </label>
        </div>
      </details>
      <p className="field-hint">
        Search across titles, key points, examples, and note content. Your notes stay private.
      </p>
      <div className="panel-actions">
        <button className="button primary">
          <Search size={16} />
          Apply filters
        </button>
        <Link className="text-link" href="/notes">
          Clear filters
        </Link>
      </div>
    </form>
  );
}
