'use client';
import { useActionState } from 'react';
import {
  createBookCourse,
  editBookCourse,
  saveBookProgress,
  saveBookNotes,
  saveBookBookmark,
  deleteBookBookmark,
} from '@/actions/books';
import { Feedback, Submit } from './forms';
import { CourseCategorySelect } from './course-category-select';
import type { Course, BookBookmark } from '@/db/schema';

export function BookCourseForm({ course }: { course?: Course }) {
  const [state, action] = useActionState(
    course ? editBookCourse.bind(null, course.id) : createBookCourse,
    {},
  );
  return (
    <form action={action} className="form-panel">
      <Feedback state={state} />
      <h3>{course ? 'Book settings' : 'Start reading a book'}</h3>
      <label className="field">
        <span>Book title</span>
        <input name="title" required minLength={2} maxLength={160} defaultValue={course?.title} />
      </label>
      <label className="field">
        <span>Author (optional)</span>
        <input name="bookAuthor" maxLength={200} defaultValue={course?.bookAuthor ?? ''} />
      </label>
      <label className="field">
        <span>Description</span>
        <textarea
          name="description"
          maxLength={5000}
          rows={3}
          defaultValue={course?.description ?? ''}
        />
      </label>
      <div className="form-grid">
        <label className="field">
          <span>Total pages</span>
          <input
            name="totalPages"
            type="number"
            required
            min={1}
            max={2000000}
            defaultValue={course?.totalPages ?? undefined}
            placeholder="e.g. 400"
          />
        </label>
        <label className="field">
          <span>Category</span>
          <CourseCategorySelect value={course?.category} />
        </label>
        <label className="field">
          <span>Difficulty</span>
          <select name="difficulty" defaultValue={course?.difficulty ?? 'intermediate'}>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </label>
        <label className="field">
          <span>Course color</span>
          <select name="color" defaultValue={course?.color ?? 'amber'}>
            {['teal', 'blue', 'violet', 'amber', 'rose', 'sky', 'indigo', 'orange', 'fuchsia'].map(
              (color) => (
                <option key={color} value={color}>
                  {color}
                </option>
              ),
            )}
          </select>
        </label>
      </div>
      {course && (
        <label className="field">
          <span>Course status</span>
          <select name="status" defaultValue={course.status}>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        </label>
      )}
      <label className="toggle-row">
        <span>Public course</span>
        <input name="isPublic" type="checkbox" defaultChecked={course?.isPublic} />
      </label>
      <p className="field-hint">
        Read at your own pace. Bookmarks and reading notes are always private.
      </p>
      <div className="form-footer">
        <Submit>{course ? 'Save book' : 'Start book'}</Submit>
      </div>
    </form>
  );
}
export function BookProgressForm({ course }: { course: Course }) {
  const [state, action] = useActionState(saveBookProgress.bind(null, course.id), {});
  return (
    <form action={action}>
      <Feedback state={state} />
      <label className="field">
        <span>Last page read</span>
        <input
          name="currentPage"
          type="number"
          required
          min={0}
          max={course.totalPages!}
          defaultValue={course.currentPage}
        />
      </label>
      <p className="field-hint">
        Enter 0 if you have not started. You can move your reading position backwards.
      </p>
      <Submit>Save progress</Submit>
    </form>
  );
}
export function BookNotesForm({ course }: { course: Course }) {
  const [state, action] = useActionState(saveBookNotes.bind(null, course.id), {});
  return (
    <form action={action}>
      <Feedback state={state} />
      <label className="field">
        <span>Reading notes</span>
        <textarea
          name="readingNotes"
          rows={9}
          maxLength={20000}
          defaultValue={course.readingNotes}
          placeholder="Ideas, summaries, and things to revisit…"
        />
      </label>
      <p className="field-hint">Only you can see these notes.</p>
      <Submit>Save notes</Submit>
    </form>
  );
}
export function BookBookmarkForm({
  course,
  bookmark,
}: {
  course: Course;
  bookmark?: BookBookmark;
}) {
  const [state, action] = useActionState(
    saveBookBookmark.bind(null, course.id, bookmark?.id ?? null),
    {},
  );
  return (
    <form action={action}>
      <Feedback state={state} />
      <div className="form-grid">
        <label className="field">
          <span>Bookmark page</span>
          <input
            name="page"
            type="number"
            required
            min={1}
            max={course.totalPages!}
            defaultValue={bookmark?.page ?? Math.max(1, course.currentPage)}
          />
        </label>
        <label className="field">
          <span>Bookmark label (optional)</span>
          <input
            name="label"
            maxLength={160}
            defaultValue={bookmark?.label ?? ''}
            placeholder="e.g. An idea to revisit"
          />
        </label>
      </div>
      <label className="field">
        <span>Bookmark notes (optional)</span>
        <textarea name="notes" rows={3} maxLength={10000} defaultValue={bookmark?.notes ?? ''} />
      </label>
      <Submit>{bookmark ? 'Save bookmark' : 'Add bookmark'}</Submit>
    </form>
  );
}
export function DeleteBookBookmarkForm({
  courseId,
  bookmarkId,
}: {
  courseId: string;
  bookmarkId: string;
}) {
  const [state, action] = useActionState(deleteBookBookmark.bind(null, courseId, bookmarkId), {});
  return (
    <form action={action} style={{ marginTop: 12 }}>
      <Feedback state={state} />
      <Submit secondary>Remove bookmark</Submit>
    </form>
  );
}
