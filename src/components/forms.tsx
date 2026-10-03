'use client';
import { useActionState } from 'react';
import type { ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import {
  createCourse,
  editCourse,
  deleteCourse,
  deleteExam,
  updateProfile,
  updateSession,
  type ActionState,
} from '@/actions';
import type { Course, CourseSession, User, Exam } from '@/db/schema';
import { formatInTimeZone } from 'date-fns-tz';
import { Plus, Save, Trash2, Lock, Globe } from 'lucide-react';
export function Submit({
  children = 'Save changes',
  danger = false,
}: {
  children?: ReactNode;
  danger?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} type="submit" className={`button ${danger ? 'danger' : 'primary'}`}>
      {pending ? 'Saving…' : children}
    </button>
  );
}
export function Feedback({ state }: { state: ActionState }) {
  return (
    <>
      {state.error && (
        <div className="alert error" role="alert">
          {state.error}
        </div>
      )}
      {state.success && (
        <div className="alert success" role="status">
          {state.success}
        </div>
      )}
    </>
  );
}
function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function CourseForm({
  course,
  timezone = 'Asia/Tehran',
  today,
}: {
  course?: Course;
  timezone?: string;
  today: string;
}) {
  const schedule = course
    ? {
        totalSessions: course.totalSessions,
        duration: course.duration,
        startDate: course.startDate,
        scheduledTime: course.scheduledTime,
        timezone: course.timezone,
        weekdays: course.weekdays,
      }
    : {
        totalSessions: 24,
        duration: 60,
        startDate: today,
        scheduledTime: '18:00',
        timezone,
        weekdays: [0, 1, 2, 3, 4, 5, 6],
      };
  const [state, action] = useActionState(
    course ? editCourse.bind(null, course.id) : createCourse,
    {},
  );
  return (
    <form action={action} className="form-panel">
      <Feedback state={state} />
      <div className="form-section-heading">
        <span className="step-number">01</span>
        <div>
          <h3>Course details</h3>
          <p>Give your next learning chapter a name.</p>
        </div>
      </div>
      <Field label="Course name">
        <input
          name="title"
          required
          minLength={2}
          maxLength={160}
          placeholder="e.g. Advanced JavaScript"
          defaultValue={course?.title}
        />
      </Field>
      <Field label="Description">
        <textarea
          name="description"
          rows={3}
          maxLength={5000}
          placeholder="What will you learn in this course?"
          defaultValue={course?.description}
        />
      </Field>
      <div className="form-grid">
        <Field label="Category">
          <input
            name="category"
            required
            maxLength={80}
            placeholder="e.g. Frontend engineering"
            defaultValue={course?.category}
          />
        </Field>
        <Field label="Difficulty">
          <select name="difficulty" defaultValue={course?.difficulty ?? 'intermediate'}>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </Field>
      </div>
      <Field label="Course color">
        <select name="color" defaultValue={course?.color ?? 'teal'}>
          <option value="teal">Teal</option>
          <option value="blue">Blue</option>
          <option value="violet">Violet</option>
          <option value="amber">Amber</option>
          <option value="rose">Rose</option>
          <option value="sky">Sky</option>
          <option value="indigo">Indigo</option>
          <option value="orange">Orange</option>
          <option value="fuchsia">Fuchsia</option>
        </select>
      </Field>
      <div className="form-section-heading">
        <span className="step-number">02</span>
        <div>
          <h3>{course ? 'Course schedule' : 'Build your schedule'}</h3>
          <p>
            {course
              ? 'Update the class count, start date, or timetable before any class is underway.'
              : 'Your sessions will be scheduled automatically.'}
          </p>
        </div>
      </div>
      <div className="form-grid">
        <Field label="Number of sessions">
          <input
            name="totalSessions"
            type="number"
            min={1}
            max={1000}
            required
            defaultValue={schedule.totalSessions}
          />
        </Field>
        <Field label="Session duration (minutes)">
          <input
            name="duration"
            type="number"
            min={5}
            max={480}
            required
            defaultValue={schedule.duration}
          />
        </Field>
        <Field label="Start date">
          <input name="startDate" type="date" required defaultValue={schedule.startDate} />
        </Field>
        <Field label="Class time">
          <input name="scheduledTime" type="time" required defaultValue={schedule.scheduledTime} />
        </Field>
      </div>
      <Field label="Timezone" hint="Use an IANA timezone, such as Asia/Tehran or Europe/London.">
        <input name="timezone" required defaultValue={schedule.timezone} />
      </Field>
      <fieldset className="weekdays">
        <legend>Class days</legend>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => (
          <label key={day}>
            <input
              type="checkbox"
              name="weekdays"
              value={i}
              defaultChecked={schedule.weekdays.includes(i)}
            />
            <span>{day}</span>
          </label>
        ))}
      </fieldset>
      {course && (
        <Field label="Course status">
          <select name="status" defaultValue={course.status}>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        </Field>
      )}
      <label className="toggle-row">
        <div>
          <Globe size={19} />
          <span>
            <strong>Public course</strong>
            <small>Visible only when your public profile and course list are enabled.</small>
          </span>
        </div>
        <input type="checkbox" name="isPublic" defaultChecked={course?.isPublic} />
      </label>
      <div className="form-footer">
        <span className="muted">
          <Lock size={14} /> Your university is private by default.
        </span>
        <Submit>
          {course ? (
            <>
              <Save size={16} />
              Save course
            </>
          ) : (
            <>
              <Plus size={17} />
              Create course
            </>
          )}
        </Submit>
      </div>
    </form>
  );
}
export function DeleteCourseForm({ course }: { course: Course }) {
  const [state, action] = useActionState(deleteCourse.bind(null, course.id), {});
  return (
    <form action={action} className="panel danger-panel">
      <h3>Delete course</h3>
      <p className="muted">
        This permanently removes all sessions, exams, attempts, and certificates in this course.
        Type “{course.title}” to confirm.
      </p>
      <Feedback state={state} />
      <input name="confirmation" required placeholder={course.title} />
      <Submit danger>
        <Trash2 size={16} />
        Delete course
      </Submit>
    </form>
  );
}
export function DeleteExamForm({ exam }: { exam: Exam }) {
  const [state, action] = useActionState(deleteExam.bind(null, exam.id), {});
  return (
    <form action={action} className="panel danger-panel">
      <h3>Delete exam</h3>
      <p className="muted">
        This permanently removes this exam, its questions, all attempts, and related certificates.
        Type “{exam.title}” to confirm.
      </p>
      <Feedback state={state} />
      <input name="confirmation" required placeholder={exam.title} />
      <Submit danger>
        <Trash2 size={16} />
        Delete exam
      </Submit>
    </form>
  );
}
export function SessionForm({ session, timezone }: { session: CourseSession; timezone: string }) {
  const [state, action] = useActionState(updateSession.bind(null, session.id), {});
  return (
    <form action={action} className="form-panel">
      <Feedback state={state} />
      <Field label="Session title">
        <input name="title" required minLength={2} maxLength={160} defaultValue={session.title} />
      </Field>
      <Field label="Description">
        <textarea name="description" rows={3} defaultValue={session.description} maxLength={5000} />
      </Field>
      <div className="form-grid">
        <Field label={`Scheduled date · ${timezone}`}>
          <input
            name="date"
            type="date"
            required
            defaultValue={formatInTimeZone(session.scheduledDate, timezone, 'yyyy-MM-dd')}
          />
        </Field>
        <Field label="Class time">
          <input
            name="time"
            type="time"
            required
            defaultValue={formatInTimeZone(session.scheduledDate, timezone, 'HH:mm')}
          />
        </Field>
        <Field label="Duration (minutes)">
          <input
            name="duration"
            type="number"
            min={5}
            max={480}
            required
            defaultValue={session.duration}
          />
        </Field>
        <Field label="Status">
          <select name="status" defaultValue={session.status}>
            <option value="upcoming">Upcoming</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Completed</option>
            <option value="skipped">Skipped</option>
          </select>
        </Field>
      </div>
      <Field
        label="Study notes"
        hint="Capture what you learned, useful links, and what to revisit."
      >
        <textarea
          name="notes"
          rows={9}
          maxLength={20000}
          placeholder="Today I learned…"
          defaultValue={session.notes}
        />
      </Field>
      <div className="form-footer">
        <span className="muted">Notes are always private.</span>
        <Submit>
          <Save size={16} />
          Save session
        </Submit>
      </div>
    </form>
  );
}
export function ProfileForm({ user }: { user: User }) {
  const [state, action] = useActionState(updateProfile, {});
  return (
    <form action={action} className="form-panel">
      <Feedback state={state} />
      <h3>Personal information</h3>
      <div className="form-grid">
        <Field label="Full name">
          <input
            name="name"
            required
            minLength={2}
            maxLength={160}
            defaultValue={user.name ?? ''}
          />
        </Field>
        <Field label="Username" hint="Your public profile lives at /u/username.">
          <input
            name="username"
            required
            minLength={3}
            maxLength={30}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            defaultValue={user.username}
          />
        </Field>
      </div>
      <Field label="Bio">
        <textarea
          name="bio"
          maxLength={1000}
          rows={3}
          defaultValue={user.bio}
          placeholder="Tell people what you’re learning."
        />
      </Field>
      <div className="form-grid">
        <Field label="Location">
          <input name="location" maxLength={100} defaultValue={user.location} />
        </Field>
        <Field label="Timezone">
          <input name="timezone" required defaultValue={user.timezone} />
        </Field>
        <Field label="Website">
          <input name="website" type="url" defaultValue={user.website} placeholder="https://" />
        </Field>
        <Field label="GitHub URL">
          <input
            name="githubUrl"
            type="url"
            defaultValue={user.githubUrl}
            placeholder="https://github.com/"
          />
        </Field>
      </div>
      <Field label="LinkedIn URL">
        <input
          name="linkedinUrl"
          type="url"
          defaultValue={user.linkedinUrl}
          placeholder="https://linkedin.com/in/"
        />
      </Field>
      <div className="form-section-heading">
        <span className="step-number">
          <Lock size={16} />
        </span>
        <div>
          <h3>Your privacy, your choice</h3>
          <p>Everything stays private until you choose to share it.</p>
        </div>
      </div>
      {[
        {
          key: 'publicProfile',
          title: 'Public profile',
          desc: 'Make your name, bio, links, and public profile visible.',
        },
        {
          key: 'publicProgress',
          title: 'Public learning progress',
          desc: 'Share progress for public courses only. Requires a public profile.',
        },
        {
          key: 'showCourses',
          title: 'Show courses',
          desc: 'List courses you individually mark as public.',
        },
        {
          key: 'showExamScores',
          title: 'Show exam scores',
          desc: 'Share scores and certificates for public courses. Requires public progress.',
        },
      ].map(({ key, title, desc }) => (
        <label className="toggle-row" key={key}>
          <div>
            <span>
              <strong>{title}</strong>
              <small>{desc}</small>
            </span>
          </div>
          <input
            type="checkbox"
            name={key}
            aria-label={title}
            defaultChecked={Boolean(user[key as keyof User])}
          />
        </label>
      ))}
      <div className="form-footer">
        <span className="muted">Google account: {user.email}</span>
        <Submit>
          <Save size={16} />
          Save settings
        </Submit>
      </div>
    </form>
  );
}
