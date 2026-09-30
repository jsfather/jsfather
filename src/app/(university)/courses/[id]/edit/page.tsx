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
      <CourseForm course={course} today={course.startDate} />
      <DeleteCourseForm course={course} />
    </>
  );
}
