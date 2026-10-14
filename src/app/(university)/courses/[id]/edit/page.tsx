import { BookCourseForm } from '@/components/book-forms';
import { VocabularyCourseForm } from '@/components/vocabulary-forms';
import { requireUser } from '@/lib/auth';
import { ownedCourse } from '@/lib/data';
import { PageTitle } from '@/components/ui';
import { CourseForm, DeleteCourseForm } from '@/components/forms';
export const metadata = { title: 'Edit course' };
export default async function EditCourse({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const course = await ownedCourse(user.id, (await params).id);
  return (
    <>
      <PageTitle
        title="Edit course"
        description="Update your syllabus. Change individual class times from each session page."
      />
      {course.kind === 'book' ? (
        <BookCourseForm course={course} />
      ) : course.kind === 'vocabulary' ? (
        <VocabularyCourseForm course={course} timezone={user.timezone} />
      ) : (
        <CourseForm course={course} today={course.startDate} />
      )}
      <div className="destructive-actions">
        <DeleteCourseForm course={course} />
      </div>
    </>
  );
}
