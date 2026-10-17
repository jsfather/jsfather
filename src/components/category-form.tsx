'use client';
import { useActionState } from 'react';
import { openCategory, generateCategoryExam } from '@/actions/categories';
import { CourseCategorySelect } from './course-category-select';
import { Feedback, Submit } from './forms';
export function CategoryForm() {
  const [state, action] = useActionState(openCategory, {});
  return (
    <form action={action} className="panel ui-stack" aria-label="Category questions and exams">
      <h2>Category questions & exams</h2>
      <p className="field-hint">
        Test yourself with questions from every course in a category, plus questions you add
        directly.
      </p>
      <label className="field">
        <span>Category</span>
        <CourseCategorySelect />
      </label>
      <Feedback state={state} />
      <div className="panel-actions">
        <Submit>Open category</Submit>
      </div>
    </form>
  );
}
export function CategoryExamButton({ id, disabled }: { id: string; disabled: boolean }) {
  const [state, action] = useActionState(generateCategoryExam.bind(null, id), {});
  return (
    <form action={action} className="ui-stack">
      <Feedback state={state} />
      <div className="panel-actions">
        <Submit disabled={disabled}>Test myself</Submit>
      </div>
    </form>
  );
}
