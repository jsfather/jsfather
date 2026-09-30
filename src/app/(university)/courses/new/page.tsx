import { requireUser } from '@/lib/auth';
import { PageTitle } from '@/components/ui';
import { CourseForm } from '@/components/forms';
import { formatInTimeZone } from 'date-fns-tz';
export const metadata = { title: 'Create a course' };
export default async function NewCourse() {
  const user = await requireUser();
  return (
    <>
      <PageTitle
        eyebrow="A NEW CHAPTER"
        title="Create a course"
        description="Decide what to learn. Give it a time and a place."
      />
      <CourseForm
        timezone={user.timezone}
        today={formatInTimeZone(new Date(), user.timezone, 'yyyy-MM-dd')}
      />
    </>
  );
}
